# Installation

GitHub Reminders is a free GitHub Action maintained by **Caivra Tech LLC**.

## Requirements

- A GitHub repository with GitHub Actions enabled.
- Permission to add a workflow under `.github/workflows/`.
- No external database, server, account, or paid service is required.

## Install

Create `.github/workflows/reminders.yml` in the repository where reminders should work:

```yaml
name: GitHub Reminders

on:
  issue_comment:
    types: [created]
  schedule:
    - cron: "*/15 * * * *"
  workflow_dispatch:

concurrency:
  group: caivra-tech-reminders-v1-${{ github.repository }}-${{ github.workflow }}
  cancel-in-progress: false
  queue: max

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  reminders:
    if: github.event_name != 'issue_comment' || startsWith(github.event.comment.body, '/remind')
    runs-on: ubuntu-latest
    steps:
      - uses: caivra-tech/GitHub-reminders@v1.0.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Delivery serialization

Keep the example `concurrency` block, including `queue: max`. All triggers of **this one workflow** (issue comments, schedules, manual dispatch) use the same group: the project prefix, repository, and `github.workflow` name. Do **not** append `github.event_name`, `github.ref`, or a run ID: that would split the group and permit competing scans. Use a unique workflow name, and do not install a second copy of the reminder workflow; two different workflows are not a supported coordination model. An unrelated workflow configured with the **identical group value** would still interfere, because concurrency groups share a repository-wide namespace.

GitHub retains at most **100 pending runs** with `queue: max` and `cancel-in-progress: false`. When full, **additional runs are cancelled rather than durably stored**. A `/remind`, `/reminders`, or `/remind cancel` comment can therefore fail to be processed, with no bot reply. This configuration is **not a durable command queue** and does not guarantee that commands are acknowledged, processed exactly once, or processed in creation order. Inspect GitHub Actions for cancelled/failed/queued runs during busy periods. A command's existence as a human comment is not evidence it executed. Look for the Action's acknowledgement, and reconcile currently active reminders before retrying: blindly reposting a creation command can create duplicates if an earlier run completed late. For critical workflows, use an external durable queue or independently authenticated persistent command ledger instead.

The Action records a delivery marker only after a successful API response. If the delivery comment succeeds but updating the source marker fails, the next serialized scan detects the trusted delivery marker and repairs the source state without intentionally posting a second comment. A network outcome that is unknown to the client can still be ambiguous; GitHub's comment API does not provide a transaction spanning comment creation and marker update. Therefore delivery is **best-effort and duplicate-resistant**, not guaranteed at-least-once or exactly-once. GitHub may skip or delay scheduled executions, cancel excess queued commands, and return ambiguous API results.

## Permissions

GitHub Reminders requests only the permissions required to read repository content and create/update issue or pull-request comments:

- `contents: read`
- `issues: write`
- `pull-requests: write`

No custom secret is required. The workflow uses GitHub's repository-scoped `GITHUB_TOKEN`.

## Version pinning

This release-preparation branch targets **v1.0.1**, which is **not published yet**. Do not install `@v1.0.1` until the maintainer explicitly authorizes publication and the tag exists. The existing `v1.0.0` tag (commit `a98d0af72b02ffa5b11d6599cdafa09036041afe`) must remain immutable; it predates the new security and reliability fixes and should not be presented as the hardened version. For higher assurance after release, pin to the exact reviewed v1.0.1 release commit SHA. A repository ownership transfer requires checking and updating the owner portion of `uses:` references and verifying a workflow execution against the destination repository.

## Scheduling behavior

The example scans every 15 minutes. GitHub scheduled workflows can run later than the nominal cron time, so reminders are approximate and should not be used for safety-critical or deadline-critical alerting.
