import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("listing neutralizes mentions embedded in reminder text", () => {
  const dir = mkdtempSync(join(tmpdir(), "reminders-list-"));
  try {
    const event = join(dir, "event.json");
    const output = join(dir, "post.json");
    const mock = join(dir, "mock.mjs");
    writeFileSync(event, JSON.stringify({ action: "created", issue: { number: 1 }, comment: { user: { login: "owner", type: "User" }, body: "/reminders" } }));
    const marker = '<!-- github-reminders:v1\n' + JSON.stringify({ id: "abcdef12", creator: "owner", issueNumber: 1, dueAt: "2030-01-01T00:00:00Z", text: "hello @other", status: "active" }) + '\n-->';
    writeFileSync(mock, `import { writeFileSync } from "node:fs";
const marker = ${JSON.stringify(marker)};
globalThis.fetch = async (_url, options = {}) => {
  if (options.method === "POST") {
    writeFileSync(process.env.TEST_OUTPUT, options.body);
    return new Response("{}", {status: 200});
  }
  return new Response(JSON.stringify([{body: marker}]), {status: 200});
};`);
    const result = spawnSync(process.execPath, ["--import", mock, resolve("src/index.mjs")], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "owner/repo", GITHUB_EVENT_NAME: "issue_comment", GITHUB_EVENT_PATH: event, TEST_OUTPUT: output }
    });
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(readFileSync(output, "utf8")).body;
    assert.match(body, /hello @\u200bother/);
    assert.ok(!body.includes("hello @other"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
