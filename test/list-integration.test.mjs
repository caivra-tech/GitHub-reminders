import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { encodeMarker, sanitizeMentions } from "../src/reminders.mjs";

// Comment fixtures include all fields required by PR #8's provenance validator:
// numeric id, GitHub second-resolution created_at, issue_url, bot/App actor,
// and canonical schema-valid reminder metadata. This test MUST fail in an
// integrated build if the fixture is rejected before listing is rendered.
const tick = String.fromCharCode(96);
const cases = [
  ["single user mention", "hello @other"],
  ["teams and special notification-like names", "@org/team @everyone @here @all"],
  ["multiple mentions", "Notify @alpha then @beta and @gamma"],
  ["multiline text and blockquote", "first line @person\n> second line @group/team"],
  ["Markdown link and email", "View [@dev](https://example.org/a@b) or mail me@example.org"],
  ["backticks and code fence", "Code " + tick + "@runner" + tick + " then\n" + tick.repeat(3) + "\n@engine\n" + tick.repeat(3)],
  ["Unicode and zero-width sequence", "é @café and @\u200balready-neutralized"],
  ["punctuation adjacency", "(@one),[@two]; /@three"]
];

test("trusted-list integration neutralizes mentions across adversarial text", () => {
  const dir = mkdtempSync(join(tmpdir(), "reminders-list-"));
  try {
    const eventPath = join(dir, "event.json");
    const resultPath = join(dir, "post.json");
    const mockPath = join(dir, "mock.mjs");
    const createdAt = new Date(Date.now() - 30_000).toISOString();
    const dueAt = new Date(Date.now() + 3_600_000).toISOString();
    const githubCreatedAt = createdAt.replace(/\.\d{3}Z$/, "Z");
    const comments = cases.map(([name, text], index) => {
      const reminder = {
        id: (index + 1).toString(16).padStart(8, "0"),
        creator: "owner",
        issueNumber: 1,
        dueAt,
        text,
        status: "active",
        createdAt
      };
      return {
        id: 70001 + index,
        issue_url: "https://api.github.com/repos/owner/repo/issues/1",
        created_at: githubCreatedAt,
        user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
        performed_via_github_app: { id: 15368, slug: "github-actions" },
        body: encodeMarker(reminder)
      };
    });
    writeFileSync(eventPath, JSON.stringify({
      action: "created",
      issue: { number: 1 },
      comment: { user: { login: "owner", type: "User" }, body: "/reminders" }
    }));
    const mockLines = [
      'import { writeFileSync } from "node:fs";',
      "const comments = " + JSON.stringify(comments) + ";",
      "globalThis.fetch = async (url, options = {}) => {",
      '  if (options.method === "POST") {',
      '    writeFileSync(process.env.TEST_OUTPUT, options.body);',
      '    return new Response("{}", {status: 201});',
      "  }",
      '  if (options.method === "PATCH") throw new Error("Unexpected PATCH");',
      '  if (!String(url).includes("/repos/owner/repo/issues/1/comments?")) throw new Error("Unexpected GET");',
      "  return new Response(JSON.stringify(comments), {status: 200});",
      "};"
    ].join("\n");
    writeFileSync(mockPath, mockLines);
    const result = spawnSync(process.execPath, ["--import", mockPath, resolve("src/index.mjs")], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_TOKEN: "test",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_EVENT_NAME: "issue_comment",
        GITHUB_EVENT_PATH: eventPath,
        TEST_OUTPUT: resultPath
      }
    });
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(readFileSync(resultPath, "utf8")).body;
    assert.match(body, /^⏰ Active reminders for @owner:/);
    assert.doesNotMatch(body, /no active reminders/);
    const lines = body.split("\n").filter((line) => /^- \*\*[a-f0-9]{8}\*\* — /.test(line));
    assert.equal(lines.length, cases.length, "Every schema-valid comment must reach the list renderer");
    for (const [name, text] of cases) {
      const sanitized = sanitizeMentions(text);
      assert.ok(body.includes(sanitized), "Expected escaped output for case: " + name);
      if (text.includes("@")) assert.ok(!body.includes(text), "Unexpected unescaped text in case: " + name);
    }
    assert.equal((body.match(/@\u200b/g) || []).length,
      cases.reduce((count, [, text]) => count + (text.match(/@/g) || []).length, 0));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mention sanitizer is deterministic for arbitrary reminder text", () => {
  for (const [name, text] of cases) {
    const escaped = sanitizeMentions(text);
    assert.equal(escaped, text.replaceAll("@", "@\u200b"), name);
    assert.ok(!/@(?!\u200b)/u.test(escaped), name);
  }
});
