# Changelog

All notable changes to GitHub Reminders are documented here.

## [1.0.1] — Release prepared October 30, 2026

### Security and reliability

- Move the GitHub Action runtime to Node.js 24 while testing the source on Node 20 and Node 24.
- Neutralize user-controlled `@` mentions in `/reminders` list output; retain the intentional mention of the requesting user.
- Reject ordinary user-authored forged reminder markers by validating GitHub Actions bot/App provenance, comment identity, issue/repository binding, timestamp consistency, and strict reminder metadata.
- Use 128-bit identifiers for newly created reminders, retain 8-hex-character legacy IDs, and reject ambiguous duplicate IDs.
- Bind new delivery markers to the originating comment ID, preserving legacy delivery-marker compatibility.
- Serialize all triggers of one reminder workflow with a project/repository/workflow-scoped GitHub Actions concurrency group (`queue: max`, `cancel-in-progress: false`).
- Add adversarial security, retry and ambiguous-HTTP failure-injection tests; clarify that delivery is best-effort, not a durable, FIFO or exactly-once service.

### Final integration and validation

- Consolidated PR #10 was squash-merged to `main` at `92f5019923cc0b5ae885c65803459904bbf21c1c`, with code identical to the live-tested integrated Action runtime.
- Post-merge CI run `41015695619`: all 27 tests passed under each of Node 20 and Node 24, including syntax checks.
- Genuine private-consumer `event=schedule` runs `40969564778` and `40991032041` both succeeded. The second was an independent scheduled execution; no second delivery comment was created, and the source remained `sent`.
- Synthetic noncreator cancellation checks passed separately; a live independently authenticated second-account test was not performed. The maintainer explicitly accepted that coverage gap before integration.

### Known limitations

- The generic GitHub Actions bot identity is not cryptographic workflow-specific authentication. Privileged workflows remain trusted.
- GitHub scheduled executions can be delayed or skipped; the bounded pending queue can cancel events without bot acknowledgement.
- Reminder delivery is best-effort and duplicate-resistant, not guaranteed at-least-once or exactly-once. No 100+ pending-run saturation test was performed.
- The historical `v1.0.0` tag remains immutable. The new `v1.0.1` tag must refer only to the final CI-verified publication commit.

## [1.0.0] — 2026-09-11

### Added

- Repository-native reminder creation for issues and pull requests.
- Relative reminder syntax for minutes, hours, days, and weeks.
- Absolute ISO-8601 reminder syntax.
- Active-reminder listing.
- Creator-only cancellation.
- Scheduled GitHub Actions delivery.
- Versioned hidden metadata persistence in GitHub comments.
- Idempotent delivery markers to prevent intentional duplicate re-firing.
- Reminder-text mention neutralization.
- 500-character reminder text limit.
- Maximum ten-year reminder horizon.
- Node.js 20 test and syntax-check workflow.
- Installation, usage, architecture, stewardship, security, and contribution documentation.
- MIT license with Caivra Tech LLC as copyright holder.
- Live end-to-end smoke testing on canonical `main`.

### Validated

- Reminder creation.
- Reminder listing.
- Reminder cancellation.
- Scheduled delivery.
- Terminal `sent` transition.
- Duplicate-delivery protection behavior.

### Notes

- Scheduled delivery is approximate because GitHub Actions cron execution can be delayed.
- GitHub Reminders is an independent Caivra Tech LLC open-source project and is not an official GitHub product.
