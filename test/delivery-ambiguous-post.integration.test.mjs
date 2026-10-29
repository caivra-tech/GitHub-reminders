import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Deterministic simulations of an unknown GitHub API POST outcome.
 * These tests verify later reconciliation when a comment is observable;
 * they do not prove recovery from arbitrary permanent network failures.
 */
for (const mode of ["created-then-504", "not-created-then-504"]) {
  test("reconciles ambiguous delivery POST: " + mode, () => {
    const dir = mkdtempSync(join(tmpdir(), "reminders-ambiguous-"));
    try {
      const stateFile = join(dir, "state.json");
      const eventFile = join(dir, "event.json");
      const mockFile = join(dir, "mock.mjs");
      const createdAt = new Date(Date.now() - 120_000).toISOString();
      const dueAt = new Date(Date.now() - 60_000).toISOString();
      const reminder = {
        id: "a1b2c3d4", creator: "owner", issueNumber: 1, dueAt,
        createdAt, text: "simulate ambiguous response", status: "active"
      };
      const original = {
        id: 481, issue_url: "https://api.github.com/repos/owner/repo/issues/1",
        created_at: createdAt.replace(/\.\d{3}Z$/, "Z"),
        user: { id: 41898282, login: "github-actions[bot]", type: "Bot" },
        performed_via_github_app: { id: 15368, slug: "github-actions" },
        body: "<!-- github-reminders:v1\n" + JSON.stringify(reminder) + "\n-->"
      };
      writeFileSync(stateFile, JSON.stringify({
        mode, comments: [original], postAttempts: 0, deliveries: 0,
        patchCount: 0, injected: false
      }));
      writeFileSync(eventFile, "{}");
      const mock = [
        'import { readFileSync, writeFileSync } from "node:fs";',
        'const path = process.env.TEST_STATE_FILE;',
        'const state = JSON.parse(readFileSync(path, "utf8"));',
        'const persist = () => writeFileSync(path, JSON.stringify(state));',
        'globalThis.fetch = async (url, options = {}) => {',
        '  const method = options.method || "GET";',
        '  if (method === "GET") {',
        '    if (!String(url).includes("/issues/comments?") && !String(url).includes("/issues/1/comments?")) throw new Error("Unexpected GET");',
        '    return new Response(JSON.stringify(state.comments), {status: 200});',
        '  }',
        '  if (method === "POST") {',
        '    state.postAttempts++;',
        '    const failThisTime = !state.injected;',
        '    if (failThisTime) state.injected = true;',
        '    if (!failThisTime || state.mode === "created-then-504") {',
        '      state.deliveries++;',
        '      state.comments.push({',
        '        id: 800 + state.deliveries,',
        '        issue_url: "https://api.github.com/repos/owner/repo/issues/1",',
        '        user: {id: 41898282, login: "github-actions[bot]", type: "Bot"},',
        '        performed_via_github_app: {id: 15368, slug: "github-actions"},',
        '        body: JSON.parse(options.body).body',
        '      });',
        '    }',
        '    persist();',
        '    return failThisTime ? new Response("gateway timeout", {status: 504}) : new Response("{}", {status: 201});',
        '  }',
        '  if (method === "PATCH") {',
        '    state.patchCount++;',
        '    state.comments[0].body = JSON.parse(options.body).body;',
        '    persist();',
        '    return new Response("{}", {status: 200});',
        '  }',
        '  throw new Error("Unexpected fetch method: " + method);',
        '};'
      ].join("\n");
      writeFileSync(mockFile, mock);
      function scan() {
        return spawnSync(process.execPath, ["--import", mockFile, resolve("src/index.mjs")], {
          encoding: "utf8",
          env: { ...process.env, GITHUB_TOKEN: "test",
            GITHUB_REPOSITORY: "owner/repo", GITHUB_EVENT_NAME: "workflow_dispatch",
            GITHUB_EVENT_PATH: eventFile, TEST_STATE_FILE: stateFile }
        });
      }
      const first = scan();
      assert.notEqual(first.status, 0, "Expected first attempt to report 504");
      assert.match(first.stderr, /POST .* failed: 504/);
      let state = JSON.parse(readFileSync(stateFile, "utf8"));
      assert.equal(state.postAttempts, 1);
      assert.equal(state.deliveries, mode === "created-then-504" ? 1 : 0);
      assert.equal(state.patchCount, 0);

      const second = scan();
      assert.equal(second.status, 0, second.stderr);
      state = JSON.parse(readFileSync(stateFile, "utf8"));
      assert.equal(state.deliveries, 1, "Exactly one observed delivery after retry");
      assert.equal(state.postAttempts, mode === "created-then-504" ? 1 : 2);
      assert.equal(state.patchCount, 1, "Reconciled source reminder to sent");
      assert.match(state.comments[0].body, /"status":"sent"/);

      const third = scan();
      assert.equal(third.status, 0, third.stderr);
      state = JSON.parse(readFileSync(stateFile, "utf8"));
      assert.equal(state.deliveries, 1);
      assert.equal(state.postAttempts, mode === "created-then-504" ? 1 : 2);
      assert.equal(state.patchCount, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
