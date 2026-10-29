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

Delivery is **at-least-once, duplicate-resistant**, not exactly-once. The supplied workflow serializes runs per repository with GitHub Actions concurrency and `queue: max` (up to 100 pending; additional runs may be cancelled), and a trusted delivery marker suppresses sequential retries after a delivery has been observed. If delivery succeeds but the source-marker update fails, the next serialized scan repairs that state without intentionally posting again. An API timeout can still leave a post outcome unknown, and GitHub offers no transaction across comment creation and marker update; exactly-once delivery is not claimed.

GitHub Actions scheduling is not real-time. The Action therefore makes no deadline-grade delivery guarantee.

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
