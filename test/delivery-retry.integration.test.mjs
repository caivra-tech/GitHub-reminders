import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("a successful delivery POST followed by a failed state PATCH is not reposted on retry", () => {
  const dir = mkdtempSync(join(tmpdir(), "reminders-failure-injection-"));
  try {
    const stateFile = join(dir, "state.json");
    const eventFile = join(dir, "event.json");
    const mockFile = join(dir, "mock.mjs");
    const createdAt = new Date(Date.now() - 120_000).toISOString();
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const reminder = {
      id: "abcdef12", creator: "owner", issueNumber: 1, dueAt,
      text: "failure injection", status: "active", createdAt
    };
    const original = {
      id: 411,
      issue_url: "https://api.github.com/repos/owner/repo/issues/1",
      created_at: createdAt.replace(/\.\d{3}Z$/, "Z"),
      user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
      performed_via_github_app: { id: 15368, slug: "github-actions" },
      body: "<!-- github-reminders:v1\n" + JSON.stringify(reminder) + "\n-->"
    };
    writeFileSync(stateFile, JSON.stringify({ comments: [original], failPatch: true, postCount: 0, patchCount: 0 }));
    writeFileSync(eventFile, "{}");
    const mock = String.raw`
import { readFileSync, writeFileSync } from "node:fs";
const path = process.env.TEST_STATE_FILE;
const state = JSON.parse(readFileSync(path, "utf8"));
function persist() { writeFileSync(path, JSON.stringify(state)); }
globalThis.fetch = async (url, options = {}) => {
  const method = options.method || "GET";
  if (method === "GET") {
    if (String(url).includes("/issues/comments?") || String(url).includes("/issues/1/comments?")) {
      return new Response(JSON.stringify(state.comments), { status: 200 });
    }
  }
  if (method === "POST") {
    state.postCount++;
    state.comments.push({
      id: 900 + state.postCount,
      issue_url: "https://api.github.com/repos/owner/repo/issues/1",
      user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
      performed_via_github_app: { id: 15368, slug: "github-actions" },
      body: JSON.parse(options.body).body
    });
    persist();
    return new Response("{}", { status: 201 });
  }
  if (method === "PATCH") {
    if (state.failPatch) {
      state.failPatch = false;
      persist();
      return new Response("injected failure", { status: 503 });
    }
    state.patchCount++;
    state.comments[0].body = JSON.parse(options.body).body;
    persist();
    return new Response("{}", { status: 200 });
  }
  throw new Error("Unexpected fetch " + method + " " + url);
};
`;
    writeFileSync(mockFile, mock);
    function run() {
      return spawnSync(process.execPath, ["--import", mockFile, resolve("src/index.mjs")], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_TOKEN: "test",
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_EVENT_PATH: eventFile,
          TEST_STATE_FILE: stateFile
        }
      });
    }
    const first = run();
    assert.notEqual(first.status, 0, "First run should fail when PATCH returns HTTP 503");
    let state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.postCount, 1, "Delivery comment was created once");
    assert.match(state.comments[1].body, /github-reminders:delivered:abcdef12/);
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.postCount, 1, "Retry must find the prior delivery comment");
    assert.equal(state.patchCount, 1, "Retry repairs the original marker");
    assert.match(state.comments[0].body, /"status":"sent"/);
    const third = run();
    assert.equal(third.status, 0, third.stderr);
    state = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(state.postCount, 1, "Further scans should not re-deliver");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
