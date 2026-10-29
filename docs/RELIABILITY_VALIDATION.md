# Reliability validation and operational boundaries

This plan applies to PR #9's consumer workflow configuration, not to an unlimited-lossless command system. The production `v1.0.0` tag stays unchanged. The private validation consumer is `caivra-tech/github-reminders-validation`. No mass workflow dispatch is authorized by this document.

## Verified or locally automatable

1. `test/workflow-concurrency.test.mjs` checks the exact top-level concurrency stanza in the example and installation guide, including `cancel-in-progress: false`, `queue: max`, and a project/repository/workflow group constant across command and scheduler events. This is a **static regression test** only.
2. `test/delivery-retry.integration.test.mjs` simulates a successful delivery POST followed by a failed source-marker PATCH; a subsequent run observes the delivery marker and repairs the source without reposting.
3. `test/delivery-ambiguous-post.integration.test.mjs` simulates HTTP 504 after a delivery comment was actually created, **and** a 504 with no comment created. When a later GET can observe the posted comment, the retry suppresses duplicates; otherwise the retry attempts a new POST. This validates recovery in the simulated observable-state cases, not a real GitHub API's eventual consistency.
4. Private consumer workflow at `.github/workflows/reminders.yml` uses the distinct project/repository/workflow group; successful issue-comment run [40925057742](https://github.com/caivra-tech/github-reminders-validation/actions/runs/40925057742) verifies the configured workflow can execute and respond. It does not establish queue-saturation, schedule-event or duplicate-delivery behavior under high load.

## Remaining live validation gates

- **Scheduled trigger:** Check the validation repository's Actions history for a real `event: schedule` run using the default-branch workflow. Record the workflow run URL, trigger, current workflow SHA, original reminder ID, any delivery comment, and absence of duplicate delivery on a later scan. A `workflow_dispatch` run does **not** count. GitHub warns that scheduled runs can be delayed or dropped under load. Do not falsify a schedule event.
- **Low-load overlap:** Create two or three harmless `/reminders` commands close together in the existing private consumer. Compare each run's actual job start/end times and bot acknowledgments. Confirm no observed overlapping reminder steps with the same concurrency group. This verifies an ordinary overlap, not the maximum queue limit.
- **Post-merge integration:** Once independently reviewed PRs #6, #7, #8 and #9 are reconciled, update the private consumer to the exact integrated candidate SHA and retest creation, listing, delivery, repeat, cancellation, forged comments, and mention sanitization. PR #9 alone does not include the updated PR #8 source-code changes on its own branch.
- **Independent-user cancellation:** Requires a separate authenticated GitHub identity; a fabricated webhook actor does not substitute for a live identity test.

## Queue saturation and durability limits

GitHub Actions documents a maximum of **100 pending runs per group** with `queue: max`. Runs beyond that limit can be cancelled or rejected without a reminder bot acknowledgment; run scheduling is not strictly ordered by original comment time. Also, queued runs can time out, and schedules can be delayed or dropped. This design is **best-effort and duplicate-resistant**, not guaranteed at-least-once, exactly-once, FIFO, or lossless processing.

A live 100+ run test is intentionally **not part of ordinary CI or automatic validation**. It could consume substantial runner resources, trigger platform rate limits, block actual testing, and manufacture avoidable alerts. Perform such a test only in a separately authorized disposable environment with a defined usage limit, controlled holding job, evidence capture, and cleanup. The documented GitHub provider limit may instead be accepted as a known non-release-blocking limitation for this free, repository-native utility.

**User recovery:** A command comment without a bot response must be treated as unconfirmed. Check the Actions run and active reminders, avoid blindly repeating creations, and retry only after reconciling whether the prior attempt executed.

## Failure cases not proven

If a POST creates a comment but the next read is stale or the delivery comment is externally changed, a retry may still duplicate. Mutable comments cannot provide a transactional state store. Neither this PR nor the isolated simulator proves recovery for arbitrary API timeouts, repository outages, or malicious privileged workflows. Stronger guarantees require durable state, event replay/reconciliation, or separately authenticated infrastructure.

GitHub references:
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
