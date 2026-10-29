# Security Policy

## Reporting a vulnerability

Please do not disclose a suspected security vulnerability in a public issue.

Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is unavailable, contact the repository owner through an appropriate private channel.

## Security model

GitHub Reminders is designed to run with repository-scoped `GITHUB_TOKEN` permissions limited to read-only contents plus write access to issues and pull requests. It has no external backend and no external database in V1.

Do not place secrets, credentials, personal data, or other sensitive information in reminder text. Reminder metadata is persisted in GitHub comments and follows the repository's visibility and retention characteristics.

## Reminder-marker trust boundary

Hidden markers inside ordinary issue/PR comments are untrusted input. GitHub Reminders only accepts markers in comments whose GitHub API actor and App provenance identify `github-actions[bot]`, whose original comment timestamp matches the marker creation timestamp, and whose issue/repository association and reminder schema validate. This blocks markers injected directly by ordinary issue commenters and common stale-comment replays.

**This is not cryptographic, workflow-specific authentication.** All workflows with sufficient `GITHUB_TOKEN` permission in the same repository can post with the generic GitHub Actions bot identity. A compromised or malicious privileged workflow can create, modify, or replay apparently authentic metadata. Protect workflow files, limit `issues: write` / `pull-requests: write` grants, require review for workflow changes, and treat maintainers and repository-writable automation as part of the trusted computing base. A dedicated App identity with isolated signing/credential permissions would be needed to strengthen this boundary; it is not configured by this PR.

New reminders use 128-bit random identifiers; existing 8-hex-character identifiers remain supported. To avoid ambiguous state updates, duplicate IDs within an issue are not eligible for cancellation or scheduled delivery until investigated. New delivery markers are keyed to the source GitHub comment ID; existing eight-character reminders retain their historical marker format. Neither marker scheme provides cryptographic origin authentication.

New metadata enforces bounded, ordered timestamps and strict state-specific fields. Existing GitHub comment storage contains the latest mutable state only: it cannot independently prove the full transition history or prevent a privileged actor from rewriting a trusted comment. Reminder delivery remains subject to the distinct concurrency and at-least-once limitations documented in the reliability hardening PR.
