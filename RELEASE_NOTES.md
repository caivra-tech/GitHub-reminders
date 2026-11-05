# GitHub Reminders v1.0.2 — proposed patch release (NOT YET PUBLISHED)

Release candidate for the creation replay-resistance changes merged in PR #14. Release publication, tag creation, and consumer upgrades require separate authorization.

## Changes
- Bind new reminder identity to repository, issue, and originating source-comment ID; use stable 32-hex IDs.
- Derive relative due and creation times from the immutable source comment timestamp, not replay processing time.
- Reconcile an existing trusted source-linked confirmation before POST, and re-read after an uncertain POST outcome instead of blindly retrying.
- Fail closed on ambiguous duplicate source records or an unknown POST outcome with stale readback.
- Preserve legacy marker compatibility and the existing cancellation and scheduled-delivery paths.

## Validation evidence
- PR #14 merged as `38cd5920352cf6dd0063b733494501b515621a0e`.
- Merge-commit CI run 41963264708 passed `npm test` and `npm run check` under Node.js 20 and Node.js 24.
- This release-preparation commit requires its own exact-head CI verification before release authorization.

## Limitations
- No atomic exactly-once creation guarantee. Independent simultaneous issue-comment writers can race through read-before-write.
- Supported consumer contract: one designated serialized workflow per repository, shared concurrency group across triggers, `cancel-in-progress: false`; external writers are outside that serialization.
- Unknown POST outcomes with stale GitHub readback require operator reconciliation; do not blindly retry.
- Scheduled delivery is best-effort, may be delayed or skipped, and is not exactly-once or guaranteed at-least-once. Queue saturation can cancel unacknowledged commands.
- Existing cancellation acknowledgement and delivery-marker crash windows remain; this patch does not claim to repair them.

## Upgrade and rollback
Do not change consumer pins before a separately authorized release and controlled validation. The isolated consumer currently pins published v1.0.1 commit `2b98349b0dadd9014e997bcf54197de7755e4001`; retain it as the rollback reference. The proposed v1.0.2 tag must target the final, exact CI-verified release-preparation commit, not a moving branch.

---

# GitHub Reminders v1.0.1

**Caivra Tech LLC — maintenance release; final validation completed October 30, 2026.**

GitHub Reminders v1.0.1 is a security and reliability maintenance update for the repository-native GitHub Action. It remains best-effort and duplicate-resistant; it does not promise exactly-once delivery, guaranteed at-least-once delivery, strict FIFO order, or deadline-grade scheduling.

### Changes

- Run the Action on Node.js 24; maintain CI tests on both Node 20 and Node 24.
- Sanitize user-controlled @mentions in reminder-list output while preserving the intended recipient mention.
- Reject ordinary user-forged reminder metadata using GitHub Actions bot/App provenance, issue/repository binding, comment timestamp consistency, and strict marker schemas.
- Use 128-bit identifiers for newly created reminders while retaining legacy 8-character identifiers; reject ambiguous duplicate IDs.
- Bind new delivery markers to source-comment identity and preserve legacy delivery markers.
- Serialize triggers of the installed reminder workflow with a repository/workflow-scoped concurrency group, `cancel-in-progress: false`, and `queue: max` (bounded to 100 pending runs).
- Cover delivery retries and ambiguous HTTP outcomes with deterministic integration tests; describe limitations accurately.

### Verified release evidence

- Consolidated [PR #10](https://github.com/caivra-tech/GitHub-reminders/pull/10) was squash-merged to `main` as `92f5019923cc0b5ae885c65803459904bbf21c1c`. The merged Git tree exactly matched the reviewed release-preparation candidate `f6077002c3335abef10fd5128fc00618190654df`.
- [Post-merge CI](https://github.com/caivra-tech/GitHub-reminders/actions/runs/41015695619) passed: 27/27 tests under Node 20 and 27/27 under Node 24, including `npm run check`.
- An access-restricted validation consumer pinned the Action to exact integrated source `21aa111f9573f75828e890213ccc54a63264a419`; the Action implementation and `action.yml` were blob-identical to the merged candidate.
- Two distinct genuine `event=schedule` runs on the validation consumer's `main` completed successfully: [run 40969564778](https://github.com/caivra-tech/github-reminders-validation/actions/runs/40969564778) on October 29, 2026 at 22:56:13 UTC, and [run 40991032041](https://github.com/caivra-tech/github-reminders-validation/actions/runs/40991032041) on October 30, 2026 at 02:19:43 UTC. The second run was an independent scheduler event (attempt 1), not a manual dispatch or rerun.
- The schedule-only test reminder ended in `sent`, and the two scheduled executions left exactly one authoritative delivery comment. An additional diagnostic rerun of the first scheduled job produced no duplicate but is not counted as the independent second schedule event.

### Accepted coverage gaps and operational limits

- A live cancellation/authorization attempt by a separately authenticated second GitHub user was not executed. Synthetic noncreator authorization checks passed on a separate validation branch, not as a live two-account test. The maintainer expressly accepted this bounded coverage gap before merging PR #10; it must not be represented as tested live.
- The 100-pending-run limit was documented, not exercised with a disruptive saturation test. Overflow can cancel unacknowledged commands.
- The GitHub Actions bot identity does not cryptographically identify a particular trusted workflow. Other privileged workflows with equivalent repository-write authority remain part of the trusted computing base.
- GitHub scheduling can be delayed or skipped. GitHub comment writes and metadata edits are not transactional; ambiguous API outcomes and stale reads can still produce duplicates.

### Release integrity

Published [GitHub Reminders v1.0.1](https://github.com/caivra-tech/GitHub-reminders/releases/tag/v1.0.1) on October 30, 2026. The published tag resolves to the final CI-verified commit `2b98349b0dadd9014e997bcf54197de7755e4001`. The original `v1.0.0` tag remains at `a98d0af72b02ffa5b11d6599cdafa09036041afe`. GitHub release immutability was not enabled at the November 2 closeout; stable refs must not be described as technically protected.

---

# GitHub Reminders v1.0.0

**Initial stable public release — Caivra Tech LLC**

GitHub Reminders v1.0.0 delivers a small, free, repository-native reminder capability for GitHub issues and pull requests without requiring a hosted backend, external database, separate account, or subscription.

## Highlights

- Create relative reminders with `/remind in ...`.
- Create absolute ISO-8601 reminders with `/remind at ...`.
- List active reminders with `/reminders`.
- Cancel owned reminders with `/remind cancel <id>`.
- Deliver due reminders through scheduled GitHub Actions.
- Store reminder state in versioned hidden GitHub comment metadata.
- Prevent intentional duplicate delivery with idempotency markers.
- Keep reminder delivery scoped to the creator.
- Neutralize embedded `@` mentions in reminder text.
- Run with minimal repository permissions and no runtime npm dependencies.

## Validation

The V1 release was validated through:

- Node.js syntax checks;
- automated unit tests;
- GitHub Actions CI on the merged implementation;
- live issue command creation;
- live reminder listing;
- live creator cancellation;
- scheduled reminder delivery on canonical `main`;
- confirmation that the delivered reminder transitioned to terminal `sent` state;
- duplicate-delivery inspection.

The end-to-end smoke-test issue was closed as completed after the scheduled delivery path executed successfully.

## Operational note

GitHub scheduled Actions are not deadline-grade schedulers. Reminder delivery is approximate and may be delayed by GitHub scheduler availability or repository activity characteristics.

## Project stewardship

GitHub Reminders is an independent open-source project built and maintained by **Caivra Tech LLC** and released under the MIT License.

Copyright © 2026 Caivra Tech LLC.

GitHub Reminders is not an official GitHub product and is not affiliated with or endorsed by GitHub, Inc.
