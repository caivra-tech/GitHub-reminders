# GitHub Reminders

**Free, open-source reminders for GitHub issues and pull requests — built and maintained by Caivra Tech LLC.**

GitHub Reminders is an independent, repository-native GitHub Action that lets people schedule reminders directly from issue and pull-request conversations and receive a GitHub mention when the reminder becomes due.

No hosted backend. No external database. No separate account. No subscription.

> **Independent project notice:** GitHub Reminders is not an official GitHub product and is not affiliated with or endorsed by GitHub, Inc.

## Why this exists

GitHub makes it easy to subscribe to issue and pull-request activity, but it does not provide a simple general-purpose per-conversation reminder command. GitHub Reminders fills that gap with a small, transparent, low-permission Action designed to remain free and easy to adopt.

## Quick start

Add the workflow from [`examples/reminders.yml`](examples/reminders.yml) to your repository as `.github/workflows/reminders.yml`, then use commands like:

```text
/remind in 7 days Revisit this before deleting the branch
/remind in 3 hours Check CI again
/remind at 2026-10-15T16:00:00Z Review the release candidate
/reminders
/remind cancel deadbeef
```

A reminder belongs to the GitHub user who created it. `/reminders` lists that user's active reminders on the current issue or PR, and only the creator can cancel one through the command interface.

## How it works

GitHub itself is the durable reminder store. When a reminder is created, the Action posts a confirmation comment containing a small hidden versioned metadata marker. A scheduled workflow scans repository comments for due markers and posts the reminder back to the original issue or pull request.

```text
issue/PR comment -> GitHub Action -> hidden reminder marker -> scheduled scan -> GitHub mention
```

Delivery comments include a trusted idempotency marker. The supplied workflow serializes **one named reminder workflow per repository** with a bounded queue (up to 100 pending runs) and suppresses ordinary repeated posts. Queue overflow may cancel incoming runs **without a bot acknowledgement**, including creation and cancellation commands. GitHub scheduled scans may be late or skipped; this is **best-effort, duplicate-resistant delivery**, not guaranteed at-least-once or exactly-once delivery. GitHub comment creation and marker updates are not transactional. Check for a bot acknowledgement, and inspect GitHub Actions when commands receive no response. Do not blindly repeat creation commands without checking for delayed processing.

## Install

Copy [`examples/reminders.yml`](examples/reminders.yml) into your repository as `.github/workflows/reminders.yml`.

The workflow needs only:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

See the full [Installation Guide](docs/INSTALLATION.md).

For the published v1.0.1 maintenance release, pin the Action to:

```yaml
uses: caivra-tech/GitHub-reminders@v1.0.1
```

For higher assurance, pin to the exact reviewed v1.0.1 release commit SHA `2b98349b0dadd9014e997bcf54197de7755e4001` instead of the version tag. The existing v1.0.0 tag remains a historical release and predates the new trust and serialization protections.

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Usage](docs/USAGE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Project Stewardship](docs/PROJECT_STEWARDSHIP.md)
- [Release Notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Timing

Scheduled GitHub Actions are not real-time schedulers. The example checks every 15 minutes, but GitHub may delay scheduled runs during periods of load. Treat reminder times as approximate rather than deadline-grade guarantees.

All absolute V1 reminder times use explicit ISO-8601 timestamps. Example:

```text
/remind at 2026-10-15T16:00:00Z Check this again
```

Relative reminders use the time the command is processed by GitHub Actions.

## Privacy and safety

- Reminder data stays in the repository's GitHub issue/PR comments.
- V1 does not send reminder content to an external service.
- Reminder delivery always mentions the creator; V1 does not provide arbitrary recipient targeting.
- `@` characters inside reminder text are neutralized on delivery to prevent stored reminder text from unexpectedly pinging third parties.
- Reminder text is limited to 500 characters.
- Reminder times must be in the future and no more than 10 years away.

Because reminder metadata is stored in comments, anyone who can read the repository conversation may be able to inspect it. Do not put secrets or sensitive information in reminder text.

## Current V1 scope

Included:

- relative reminders in minutes, hours, days, and weeks;
- explicit ISO-8601 reminders;
- listing active reminders on the current issue/PR;
- creator-only cancellation;
- scheduled GitHub-native delivery;
- serialized, best-effort duplicate-resistant delivery (bounded queue, no exact or at-least-once guarantee);
- no runtime dependencies;
- Node.js built-in test suite;
- end-to-end live smoke testing on canonical `main`.

Not included yet:

- recurring reminders;
- natural-language date parsing such as "next Friday";
- user timezone profiles;
- Slack, SMS, or external push integrations;
- conditional reminders based on branch/PR state;
- a dashboard or hosted service.

Those features should only be added if they preserve the project's small, free, low-permission character.

## Development

Requires Node.js 20 or later.

```bash
npm test
npm run check
```

The implementation intentionally has no npm runtime dependencies.

## About Caivra Tech LLC

**Caivra Tech LLC** is the project steward and copyright holder for GitHub Reminders. This project is maintained as a free contribution to the developer community and as part of Caivra Tech LLC's public engineering portfolio.

GitHub Reminders demonstrates a simple design philosophy: solve a real workflow gap with minimal infrastructure, minimal permissions, transparent behavior, and no unnecessary subscription layer.

## Stewardship and license

Copyright © 2026 **Caivra Tech LLC**.

Released under the [MIT License](LICENSE), which permits broad use, modification, redistribution, sublicensing, and commercial use subject to its terms.

See [Project Stewardship](docs/PROJECT_STEWARDSHIP.md) for the ownership and contribution model.

---

**Built with care by Caivra Tech LLC — free for the GitHub community.**
