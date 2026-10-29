import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { encodeMarker } from "../src/reminders.mjs";

const id = "a".repeat(32);

function invoke({ actor, command }) {
  const dir = mkdtempSync(join(tmpdir(), "reminder-noncreator-"));
  try {
    const eventFile = join(dir, "event.json");
    const logFile = join(dir, "api-writes.jsonl");
    const mockFile = join(dir, "mock.mjs");
    const createdAt = new Date(Date.now() - 30_000).toISOString();
    const source = {
      id: 9001,
      issue_url: "https://api.github.com/repos/owner/repo/issues/2",
      created_at: createdAt.replace(/\.\d{3}Z$/, "Z"),
      user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
      performed_via_github_app: { id: 15368, slug: "github-actions" },
      body: encodeMarker({
        id, creator: "owner", issueNumber: 2,
        createdAt, dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        text: "Do not allow another user to cancel or list", status: "active"
      })
    };
    writeFileSync(eventFile, JSON.stringify({
      action: "created", issue: { number: 2 },
      comment: { user: { login: actor, type: "User" }, body: command }
    }));
    const fixture = [
      'import { appendFileSync } from "node:fs";',
      "const source = " + JSON.stringify(source) + ";",
      "globalThis.fetch = async (url, options = {}) => {",
      '  const method = options.method ?? "GET";',
      '  if (method === "GET") {',
      '    if (!String(url).includes("/repos/owner/repo/issues/2/comments?")) throw new Error("Unexpected GET");',
      '    return new Response(JSON.stringify([source]), {status: 200});',
      "  }",
      '  const body = JSON.parse(options.body).body;',
      '  appendFileSync(process.env.TEST_API_LOG, JSON.stringify({ method, url: String(url), body }) + "\\n");',
      '  return new Response("{}", {status: method === "POST" ? 201 : 200});',
      "};"
    ].join("\n");
    writeFileSync(mockFile, fixture);
    const res = spawnSync(process.execPath, ["--import", mockFile, resolve("src/index.mjs")], {
      encoding: "utf8",
      env: { ...process.env,
        GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "owner/repo",
        GITHUB_EVENT_NAME: "issue_comment", GITHUB_EVENT_PATH: eventFile,
        TEST_API_LOG: logFile
      }
    });
    assert.equal(res.status, 0, res.stderr);
    const writes = existsSync(logFile)
      ? readFileSync(logFile, "utf8").trim().split("\n").map(JSON.parse)
      : [];
    return writes;
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

test("second authenticated actor cannot cancel another creator's trusted reminder", () => {
  const writes = invoke({ actor: "outsider", command: "/remind cancel " + id });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, "POST");
  assert.match(writes[0].body, /does not belong to you/);
  assert.ok(!writes.some((w) => w.method === "PATCH"));
});

test("second actor cannot list another creator's active reminder", () => {
  const writes = invoke({ actor: "outsider", command: "/reminders" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, "POST");
  assert.match(writes[0].body, /no active reminders/);
  assert.ok(!writes[0].body.includes(id));
});

test("original creator can cancel the same trusted reminder", () => {
  const writes = invoke({ actor: "owner", command: "/remind cancel " + id });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].method, "PATCH");
  assert.match(writes[0].url, /\/issues\/comments\/9001$/);
  assert.match(writes[0].body, /"status":"cancelled"/);
  assert.equal(writes[1].method, "POST");
  assert.match(writes[1].body, /cancelled/);
});
