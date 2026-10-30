import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createReminder,
  encodeMarker,
  decodeMarker,
  parseCommand,
  validateReminder,
  trustedReminderFromComment,
  deliveryMarker,
  reminderDeliveryMarker,
  dueReminderBody
} from "../src/reminders.mjs";

const now = new Date("2026-10-29T01:00:00.000Z");
const base = {
  id: "abcdef12", creator: "owner", issueNumber: 1,
  dueAt: "2026-10-29T00:10:00.000Z", text: "safe reminder",
  status: "active", createdAt: "2026-10-29T00:00:00.000Z"
};
const trusted = (reminder = base, extras = {}) => ({
  id: 41234,
  created_at: "2026-10-29T00:00:01Z",
  issue_url: "https://api.github.com/repos/owner/repo/issues/1",
  body: encodeMarker(reminder),
  user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
  performed_via_github_app: { id: 15368, slug: "github-actions" },
  ...extras
});

test("new identifiers provide 128-bit entropy while legacy cancellation remains valid", () => {
  const newer = createReminder({ creator: "owner", issueNumber: 1, dueAt: "2030-01-01T00:00:00.000Z", text: "new", now });
  assert.match(newer.id, /^[a-f0-9]{32}$/);
  assert.deepEqual(parseCommand("/remind cancel " + newer.id, now), { kind: "cancel", id: newer.id });
  assert.deepEqual(parseCommand("/remind cancel deadbeef", now), { kind: "cancel", id: "deadbeef" });
  assert.equal(validateReminder(base, 1, now)?.id, base.id);
});

test("new delivery marker binds to immutable source-comment ID; legacy marker remains readable", () => {
  const newer = { ...base, id: "c".repeat(32) };
  assert.equal(reminderDeliveryMarker(newer, 41234), "<!-- github-reminders:delivered-source:41234 -->");
  assert.match(dueReminderBody(newer, 41234), /delivered-source:41234/);
  assert.equal(reminderDeliveryMarker(base, 41234), deliveryMarker(base.id));
});

test("provenance requires the exact GitHub bot actor, App and issue binding", () => {
  assert.deepEqual(trustedReminderFromComment(trusted(), 1, "owner/repo", now), base);
  const cases = [
    { user: { id: 0, login: "owner", type: "User" } },
    { user: { id: 41898282, login: "a-different-bot", type: "Bot" } },
    { performed_via_github_app: null },
    { performed_via_github_app: { id: 15368, slug: "other" } },
    { performed_via_github_app: { id: 0, slug: "github-actions" } },
    { issue_url: "https://api.github.com/repos/owner/repo/issues/2" },
    { issue_url: "https://api.github.com/repos/other/repo/issues/1" },
    { issue_url: "not-a-url" },
    { id: null },
    { created_at: "2026-10-29T00:08:00.000Z" }
  ];
  for (const change of cases) {
    assert.equal(trustedReminderFromComment(trusted(base, change), 1, "owner/repo", now), null, JSON.stringify(change));
  }
});

test("new marker does not accept replayed comment creation time", () => {
  assert.equal(trustedReminderFromComment(trusted(base, { created_at: "2026-11-01T00:00:00.000Z" }), 1, "owner/repo", now), null);
  assert.equal(decodeMarker(encodeMarker(base) + "\n" + encodeMarker(base)), null);
});

test("invalid timestamps, metadata and lifecycle states are rejected", () => {
  const changed = [
    { dueAt: base.createdAt }, // due must strictly follow creation
    { dueAt: "2026-01-01T00:00:00.000Z" },
    { dueAt: "2040-01-01T00:00:00.000Z" },
    { createdAt: "2026-10-30T00:00:00.000Z" },
    { createdAt: "2026-01-01T00:00:00.000Z", dueAt: "2026-01-01T00:00:00.000Z" },
    { createdAt: "not-a-date" },
    { status: "unexpected" },
    { status: "sent" }, // sent requires sentAt
    { status: "active", sentAt: "2026-10-29T00:10:00.000Z" },
    { status: "sent", sentAt: "2026-10-29T00:05:00.000Z" },
    { status: "sent", sentAt: "2026-11-01T00:00:00.000Z" },
    { text: " " }, { text: " padded " },
    { creator: "@owner" }, { issueNumber: 2 },
    { id: "not-hex" }, { id: "a".repeat(16) },
    { unexpected: "field" }
  ];
  for (const value of changed) {
    assert.equal(validateReminder({ ...base, ...value }, 1, now), null, JSON.stringify(value));
  }
  assert.equal(validateReminder({ ...base, status: "sent", sentAt: "2026-10-29T00:10:00.000Z" }, 1, now)?.status, "sent");
  assert.equal(validateReminder({ ...base, status: "cancelled" }, 1, now)?.status, "cancelled");
});

function runAction(eventName, command, comments) {
  const dir = mkdtempSync(join(tmpdir(), "reminders-security-"));
  try {
    const eventPath = join(dir, "event.json");
    const writesPath = join(dir, "writes.jsonl");
    const mockPath = join(dir, "mock.mjs");
    writeFileSync(eventPath, JSON.stringify(eventName === "issue_comment"
      ? { action: "created", issue: { number: 1 }, comment: { user: { login: "owner", type: "User" }, body: command } }
      : {}));
    const mock = [
      'import { appendFileSync } from "node:fs";',
      "const data = " + JSON.stringify(comments) + ";",
      "globalThis.fetch = async (url, options = {}) => {",
      '  if (options.method === "POST" || options.method === "PATCH") {',
      '    appendFileSync(process.env.TEST_WRITES, JSON.stringify({method:options.method,url:String(url),body:JSON.parse(options.body).body}) + "\\n");',
      '    return new Response("{}", {status:200});',
      "  }",
      "  return new Response(JSON.stringify(data), {status:200});",
      "};"
    ].join("\n");
    writeFileSync(mockPath, mock);
    const result = spawnSync(process.execPath, ["--import", mockPath, resolve("src/index.mjs")], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_TOKEN: "test", GITHUB_REPOSITORY: "owner/repo",
        GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath, TEST_WRITES: writesPath }
    });
    const writes = existsSync(writesPath) ? readFileSync(writesPath, "utf8").trim().split("\n").map(JSON.parse) : [];
    assert.equal(result.status, 0, result.stderr);
    return writes;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("duplicate legacy IDs across trusted comments cannot be listed or cancelled ambiguously", () => {
  const comments = [
    trusted(base),
    trusted({ ...base, creator: "another", text: "collision" }, { id: 41235 })
  ];
  const listing = runAction("issue_comment", "/reminders", comments);
  assert.equal(listing.length, 1);
  assert.match(listing[0].body, /no active reminders/);
  const cancel = runAction("issue_comment", "/remind cancel abcdef12", comments);
  assert.equal(cancel.filter((item) => item.method === "PATCH").length, 0);
  assert.match(cancel[0].body, /Ambiguous reminder/);
});

test("duplicate source reminders are not delivered", () => {
  const due = [trusted(base), trusted({ ...base, creator: "another" }, { id: 41235 })];
  assert.equal(runAction("workflow_dispatch", "", due).length, 0);
});

test("new reminder delivery marker uses source comment identity and repairs retry", () => {
  const newer = { ...base, id: "a".repeat(32) };
  const original = trusted(newer);
  const first = runAction("workflow_dispatch", "", [original]);
  assert.equal(first.length, 2);
  assert.match(first[0].body, /delivered-source:41234/);
  assert.match(first[1].body, /"status":"sent"/);
  const delivered = trusted(newer, {
    id: 41236, created_at: "2026-10-29T00:12:00.000Z",
    body: "<!-- github-reminders:delivered-source:41234 -->\nDelivered"
  });
  const retry = runAction("workflow_dispatch", "", [original, delivered]);
  assert.equal(retry.filter((item) => item.method === "POST").length, 0);
  assert.equal(retry.filter((item) => item.method === "PATCH").length, 1);
});
