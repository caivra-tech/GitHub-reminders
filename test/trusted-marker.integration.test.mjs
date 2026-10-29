import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { encodeMarker, createReminder, trustedReminderFromComment, validateReminder } from "../src/reminders.mjs";

const reminder = createReminder({ creator: "owner", issueNumber: 1, dueAt: "2030-01-01T00:00:00.000Z", text: "trusted marker", now: new Date("2026-10-29T00:00:00.000Z") });
const marker = encodeMarker(reminder);
const trusted = { id: 1234, created_at: "2026-10-29T00:00:01.000Z", body: marker, issue_url: "https://api.github.com/repos/owner/repo/issues/1", user: { id: 41898282, login: "github-actions[bot]", type: "Bot" }, performed_via_github_app: { id: 15368, slug: "github-actions" } };

test("requires authoritative GitHub Actions actor, App provenance, and schema", () => {
  assert.deepEqual(trustedReminderFromComment(trusted, 1), reminder);
  assert.equal(trustedReminderFromComment({ ...trusted, user: { id: 1, login: "owner", type: "User" } }, 1), null);
  assert.equal(trustedReminderFromComment({ ...trusted, performed_via_github_app: { id: 1, slug: "other" } }, 1), null);
  assert.equal(validateReminder({ ...reminder, issueNumber: 2 }, 1), null);
  assert.equal(validateReminder({ ...reminder, status: "sent" }, 1), null);
});

test("forged human metadata is neither listed nor delivered", () => {
  const dir = mkdtempSync(join(tmpdir(), "reminders-forged-"));
  try {
    const event = join(dir, "event.json"), output = join(dir, "post.json"), mock = join(dir, "mock.mjs");
    const forged = { ...trusted, user: { id: 1, login: "owner", type: "User" }, performed_via_github_app: null };
    writeFileSync(event, JSON.stringify({ action: "created", issue: { number: 1 }, comment: { user: { login: "owner", type: "User" }, body: "/reminders" } }));
    writeFileSync(mock, `import { writeFileSync } from "node:fs"; const forged = ${JSON.stringify(forged)}; globalThis.fetch = async (url, options = {}) => { if (options.method === "POST") { writeFileSync(process.env.TEST_OUTPUT, options.body); return new Response("{}", {status:200}); } if (options.method === "PATCH") throw new Error("forged marker must not be rewritten"); return new Response(JSON.stringify(String(url).includes("page=1") ? [forged] : []), {status:200}); };`);
    let result = spawnSync(process.execPath, ["--import", mock, resolve("src/index.mjs")], { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN:"test", GITHUB_REPOSITORY:"owner/repo", GITHUB_EVENT_NAME:"issue_comment", GITHUB_EVENT_PATH:event, TEST_OUTPUT:output } });
    assert.equal(result.status, 0, result.stderr); assert.match(JSON.parse(readFileSync(output, "utf8")).body, /no active reminders/);
    writeFileSync(event, "{}"); result = spawnSync(process.execPath, ["--import", mock, resolve("src/index.mjs")], { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN:"test", GITHUB_REPOSITORY:"owner/repo", GITHUB_EVENT_NAME:"workflow_dispatch", GITHUB_EVENT_PATH:event, TEST_OUTPUT:output } });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});
