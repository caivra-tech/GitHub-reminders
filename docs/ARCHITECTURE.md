# Architecture

GitHub Reminders is intentionally designed as a small, repository-native GitHub Action.

## V1 design

```text
issue/PR comment
  -> issue_comment workflow
  -> command parser
  -> confirmation comment + hidden reminder metadata
  -> scheduled workflow scan
  -> due reminder detection
  -> idempotent delivery marker
  -> reminder comment mentioning creator
```

## Storage

V1 uses GitHub issue and pull-request comments as the durable reminder store. No external database is required.

The hidden marker is versioned so future releases can evolve the format deliberately rather than silently reinterpret historical reminder data.

## Reliability

Reminder delivery is **best-effort and duplicate-resistant** when the consumer installs the supplied concurrency configuration. It is not exactly-once, and the overall system does **not** guarantee at-least-once delivery: GitHub scheduled runs can be delayed, skipped, or cancelled, and queue overflow can cancel command events. The `queue: max` group serializes actual runs of the same named reminder workflow; at most 100 runs can wait, with overflow cancelled and no guaranteed FIFO order. The group name includes the project prefix, repository, and workflow name to reduce accidental cross-workflow interference. A second reminder workflow, or another workflow using the same group, is not coordinated safely. When a serialized scan runs and sees a due reminder, it tries to deliver it; a trusted delivery marker suppresses ordinary repeated posts. If delivery succeeds but updating the source marker fails, a later scan that executes can repair that state without intentionally posting again. Ambiguous API timeouts leave the delivery result uncertain: GitHub has no transaction spanning the comment creation and source-marker update. Users must inspect Actions results and bot acknowledgements during bursts. Stronger guarantees would require durable processing state or a dedicated backend.

GitHub Actions scheduling is not real-time. The Action therefore makes no deadline-grade or guaranteed-delivery claim. Issue-comment command acknowledgment itself is best-effort under GitHub Actions queue and availability limits.

## Security boundary

The Action uses the repository-scoped `GITHUB_TOKEN` and requires only:

- read access to contents;
- write access to issue comments;
- write access to pull-request comments.

V1 has no external network dependency beyond GitHub's own API, no runtime npm dependencies, no credential store, and no hosted control plane.

## Project principles

1. Free and open source.
2. Minimal permissions.
3. No mandatory hosted backend.
4. No user tracking or advertising.
5. No unnecessary dependencies.
6. Preserve understandable repository-local behavior.
7. Add complexity only when a real use case justifies it.

## Stewardship

GitHub Reminders is an open-source project from **Caivra Tech LLC**. The software is released under the MIT License; Caivra Tech LLC remains the named copyright holder for the original project code while granting the broad rights defined by that license.
