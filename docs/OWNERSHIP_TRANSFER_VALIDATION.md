# GitHub Reminders — Ownership Transfer Verification Protocol

Status: **prepared, not executed**. This document does not authorize a repository transfer or any CEOS authority-state change.

## Immutable release baseline

- Repository before transfer: `cserranno85-jpg/GitHub-reminders`
- Intended destination: `caivra-tech/GitHub-reminders`
- Repository ID: `1365976453` (must remain unchanged)
- Published tag: `v1.0.0`
- Reviewed release commit: `a98d0af72b02ffa5b11d6599cdafa09036041afe`
- No `v1` tag exists as of 2026-10-28; use `v1.0.0` or the exact commit SHA.
- Preserve the existing release and tag; do not retag, re-release, or mutate history.

## Before the transfer

1. Confirm `main` and `v1.0.0` SHA through GitHub refs, repository ID, repository visibility, `action.yml`, and existing CI status.
2. Search documented and live consumers for references to `cserranno85-jpg/GitHub-reminders`. The CEOS Infrastructure supply-chain assurance document records an immutable reference to this Action; treat that record as historical evidence, not proof of a current workflow.
3. Record exact active consumer paths and expected SHA. Never update CEOS authority-bearing files without separately authorized governance and current-state inspection.
4. Check the destination name does not conflict with an existing repository and confirm organization Actions policy permits use of `caivra-tech/GitHub-reminders`.
5. Review GitHub transfer warnings, including compatibility of `uses:` references. Do not assume old owner references redirect reliably in GitHub Actions.

## After the transfer

1. Confirm the repository ID remains `1365976453`, owner is `caivra-tech`, and public visibility and administrator access remain intact.
2. Confirm `v1.0.0` still resolves to `a98d0af72b02ffa5b11d6599cdafa09036041afe`, and inspect GitHub release assets and `action.yml`.
3. Check the Action can be resolved from a disposable consumer repository via
   `uses: caivra-tech/GitHub-reminders@a98d0af72b02ffa5b11d6599cdafa09036041afe`
   (or `@v1.0.0` for ordinary version-pinned installation). Do not rely solely on an HTTP redirect from the old owner.
4. In a disposable issue: issue `/remind in 15 minutes Smoke test after transfer`; confirm a persisted reminder marker and one due-delivery comment. Scheduled GitHub Actions can be delayed, so this tests eventual delivery, not a strict 15-minute SLA.
5. Also test `/reminders`, owned `/remind cancel <id>`, and a pull-request conversation. Ensure other users cannot cancel someone else's reminder, unauthorized mentions are neutralized, and a second scheduler run does not generate duplicate delivery.
6. Verify expected workflow permissions remain scoped to `contents: read`, `issues: write`, and (if PR workflows need it) `pull-requests: write`; confirm no external secrets or paid services are required.
7. Verify tests and syntax with `npm test` and `npm run check`; observe CI on the exact post-transfer `main` SHA.
8. Update current installation references and maintained links to `caivra-tech/GitHub-reminders`, while preserving historical issue/release/commit identities and archival records.
9. Confirm any known active consumers are explicitly updated and tested. Public GitHub search cannot prove the absence of private or unindexed consumers.

## Failure handling

If Action resolution or comment delivery fails, stop publishing migration assurances. Preserve the existing release tag and immutable source commit. Record the exact failing run, repository, permission context, and observed error. Repair the consumer `uses:` reference or organization policy in a reviewed change and retest. Do not recreate the old repository path, silently rewrite history, or claim successful migration based only on GitHub URL redirects.

## Completion criteria

Mark the transfer validated only when repository identity, immutable release SHA, CI, disposable Action resolution, issue/PR command behavior, idempotent delivery, and known-consumer remediation are individually observed and recorded.
