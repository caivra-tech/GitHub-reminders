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
      - uses: caivra-tech/GitHub-reminders@v1.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Delivery serialization

Keep the example `concurrency` block, including `queue: max`. It serializes comment-command, manual-dispatch, and scheduled runs in one repository, preventing ordinary overlapping scans from racing through the read-then-post sequence. Without `queue: max`, GitHub's default single-pending-run behavior can replace pending `/remind` commands during bursts. With it, GitHub permits up to 100 pending runs in the group; additional queued runs may still be cancelled. This is bounded queueing and duplicate reduction, not guaranteed command processing under unlimited load or deadline-grade scheduling.

The Action records a delivery marker only after a successful API response. If the delivery comment succeeds but updating the source marker fails, the next serialized scan detects the trusted delivery marker and repairs the source state without intentionally posting a second comment. A network outcome that is unknown to the client can still be ambiguous; GitHub's comment API does not provide a transaction spanning comment creation and marker update. Therefore the documented guarantee is **at-least-once, duplicate-resistant delivery**, not exactly-once delivery.

## Permissions

GitHub Reminders requests only the permissions required to read repository content and create/update issue or pull-request comments:

- `contents: read`
- `issues: write`
- `pull-requests: write`

No custom secret is required. The workflow uses GitHub's repository-scoped `GITHUB_TOKEN`.

## Version pinning

The published V1 release tag is `v1.0.0` (not `v1`). For higher assurance, pin the Action to the reviewed immutable commit `a98d0af72b02ffa5b11d6599cdafa09036041afe`. A repository ownership transfer requires checking and updating the owner portion of `uses:` references and verifying a workflow execution against the destination repository.

## Scheduling behavior

The example scans every 15 minutes. GitHub scheduled workflows can run later than the nominal cron time, so reminders are approximate and should not be used for safety-critical or deadline-critical alerting.
