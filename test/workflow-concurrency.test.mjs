import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const example = readFileSync(new URL("../examples/reminders.yml", import.meta.url), "utf8");
const install = readFileSync(new URL("../docs/INSTALLATION.md", import.meta.url), "utf8");
const architecture = readFileSync(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

function concurrency(source) {
  const block = source.match(/^concurrency:\r?\n((?:[ \t]+[^\r\n]*\r?\n)+)/m);
  assert.ok(block, "Top-level concurrency block must be present");
  const settings = new Map();
  for (const raw of block[1].trimEnd().split(/\r?\n/)) {
    const match = raw.match(/^  ([a-z-]+):\s*(.*?)\s*$/);
    assert.ok(match, "Expected a two-space-indented concurrency key: " + raw);
    assert.ok(!settings.has(match[1]), "Repeated concurrency key " + match[1]);
    settings.set(match[1], match[2]);
  }
  return Object.fromEntries(settings);
}

test("consumer workflow serializes all triggers in one uniquely named, bounded concurrency group", () => {
  const expected = {
    group: "caivra-tech-reminders-v1-$" + "{{ github.repository }}-$" + "{{ github.workflow }}",
    "cancel-in-progress": "false",
    queue: "max"
  };
  assert.deepEqual(concurrency(example), expected);
  assert.match(example, /^\s+issue_comment:\s*$/m);
  assert.match(example, /^\s+schedule:\s*$/m);
  assert.match(example, /^\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(expected.group, /github\.ref|github\.event_name|github\.run_id/);
  assert.match(example, /^\s+- uses: caivra-tech\/GitHub-reminders@v1\.0\.1\s*$/m);
});

test("installation example matches the shipped workflow's concurrency configuration", () => {
  assert.deepEqual(concurrency(install), concurrency(example));
  assert.match(install, /100 pending runs/);
  assert.match(install, /no bot reply|no bot acknowledgement/i);
  assert.match(install, /not a durable command queue/i);
  assert.match(install, /second copy|second reminder workflow/i);
  assert.match(install, /creation command can create duplicates/i);
  assert.match(install, /GitHub-reminders@v1\.0\.1/);
  assert.match(install, /best-effort and duplicate-resistant/);
  assert.doesNotMatch(install, /documented guarantee is[^\n]*at-least-once/i);
});

test("README and architecture avoid unsupported delivery guarantees", () => {
  assert.match(readme, /best-effort, duplicate-resistant delivery/);
  assert.match(readme, /without a bot acknowledgement/);
  assert.match(readme, /GitHub-reminders@v1\.0\.1/);
  assert.match(architecture, /does \*\*not\*\* guarantee at-least-once delivery/);
  assert.match(architecture, /queue overflow/);
  assert.match(architecture, /no guaranteed FIFO order/);
});
