# Changelog

All notable changes to GitHub Reminders are documented here.

## [1.0.1] — UNRELEASED (candidate prepared October 29, 2026)

### Security and reliability

- Move the GitHub Action runtime to Node.js 24 while testing the source on Node 20 and Node 24.
- Neutralize user-controlled `@` mentions in `/reminders` list output; retain the intentional mention of the requesting user.
- Reject ordinary user-authored forged reminder markers by validating GitHub Actions bot/App provenance, comment identity, issue/repository binding, timestamp consistency, and strict reminder metadata.
- Use 128-bit identifiers for newly created reminders, retain 8-hex-character legacy IDs, and reject ambiguous duplicate IDs.
- Bind new delivery markers to the originating comment ID, preserving legacy delivery-marker compatibility.
- Serialize all triggers of one reminder workflow with a project/repository/workflow-scoped GitHub Actions concurrency group (`queue: max`, `cancel-in-progress: false`).
- Add adversarial security, retry and ambiguous-HTTP failure-injection tests; clarify that delivery is best-effort, not a durable, FIFO or exactly-once service.

### Release gates

- This entry is **not a publication announcement**. The v1.0.1 tag must not be created or moved without explicit maintainer authorization.
- The generic GitHub Actions bot identity is not cryptographic workflow-specific authentication. Privileged workflows remain trusted.
- A real `event=schedule` run on the exact integrated candidate and independently authenticated second-account authorization remain unverified at the preparation checkpoint; the latter may be accepted explicitly as residual coverage risk.
- GitHub scheduled executions can be delayed or skipped, and the bounded pending queue can cancel command events without bot acknowledgement.

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
