# GitHub Reminders v1.0.1 — Release candidate (not yet published)

**Caivra Tech LLC — reviewed maintenance release preparation, October 29, 2026**

This section describes the **proposed** v1.0.1 security/reliability update. It does not establish publication or approval. The existing v1.0.0 tag is unchanged.

### Proposed fixes

- Node 24 GitHub Action runtime; Node 20/24 source compatibility tests.
- Protect `/reminders` output against user-controlled GitHub mention notifications.
- Reject forged markers posted by ordinary GitHub users; require GitHub Actions bot/App metadata and strict marker/issue/time validation.
- 128-bit IDs for new reminders, continued 8-character legacy-ID support, collision refusal, and source-comment-based delivery markers.
- Repository/workflow-group serialization with bounded `queue: max` behavior, documented command-drop risks, and stronger adversarial/retry tests.

### Validation checkpoint

- Individual draft PRs #6, #7, #8 and #9 received Copilot Chat recommendations for integration (not formal submitted PR approvals).
- Exact combined source commit `21aa111f9573f75828e890213ccc54a63264a419` passed Node 20/24 CI and a live private consumer's creation, listing, sanitization, creator cancellation, manual delivery and repeated-scan checks.
- The additional release-preparation branch changes version references, documentation and regression checks only; it does not change the Action implementation tested in that private consumer.
- Real scheduled-trigger delivery and real second-account authorization have not been observed; simulated noncreator authorization passed. The bounded queue and mutable GitHub comment trust boundary remain accepted constraints.

### Publication restriction

**DO NOT PUBLISH** until final gates are assessed and the repository maintainer explicitly approves the merge and release. No v1.0.1 tag or release is authorized by these notes.

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
