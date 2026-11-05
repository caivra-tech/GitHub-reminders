# Creation replay repair — review evidence (2026-11-04)

## Observed trigger
Consumer test issue [#1](https://github.com/cserranno85-jpg/caivra-tech-github-reminders-test/issues/1) contains one `/remind` source command and two different bot-authored active confirmations. The exact second execution cause is not established by available workflow-run evidence.

## Patch boundary
- Source comment identity (`repository + issue number + source comment ID`) produces a stable 32-hex reminder ID.
- Relative due time and creation time derive from immutable source comment `created_at`, not replay wall time.
- A source-linked marker is optional to preserve compatibility with legacy records.
- Existing trusted GitHub bot provenance remains required.
- The handler reads for a matching source record before posting; on POST error it re-reads and **does not blindly retry**.
- An ambiguous duplicate source is rejected rather than silently treated as success.

## Important limitations
This is **not** an exactly-once transaction. GitHub issue-comment POST lacks an atomic conditional-create primitive. A read-before-write sequence alone cannot prevent two independent simultaneous writers from both passing the check. The published example workflow uses a single repository/workflow concurrency group; consumers using additional independent workflows or bypassing that serialization are not protected. GitHub's concurrency settings are orchestration controls, not durable distributed locks.

A lost POST response followed by a temporarily stale GitHub read remains an **unknown outcome**. The handler fails closed rather than retrying; operator reconciliation may be required. Creation after a process crash before POST, or after an unobserved successful POST, likewise needs replay with authoritative visibility.

The source's existing scheduled-delivery path is unchanged and must be validated independently. No v1.0.1 tag, release, or production workflow was modified.

## Required falsification before merge
1. Exact-head Node 20 and Node 24 CI; `npm test` and `npm run check`.
2. Replay the **same** issue-comment event twice; exactly one confirmation and stable due timestamp.
3. Simulate a successful POST followed by timeout; confirm readback avoids another POST.
4. Simulate timeout plus stale read; ensure failure without blind retry.
5. Simulate two concurrent writers with no shared lock; document the remaining race (expected limitation, not a pass).
6. Legacy active/cancelled/sent markers still decode and validate.
7. Confirm cancellation and scheduled delivery work on source-linked records, including restart.
8. Confirm bot identity, source comment ID, timestamp, issue number and repository are validated.
9. Test repeated and overlapping workflow runs under actual consumer GitHub Actions configuration.
10. Obtain owner review before merge, release, or consumer pin change.
