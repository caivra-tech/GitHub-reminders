# Usage

GitHub Reminders listens for reminder commands in GitHub issue and pull-request comments.

## Create a reminder

Relative time:

```text
/remind in 30 minutes Check the deploy result
/remind in 3 hours Review this PR
/remind in 7 days Revisit this issue
/remind in 2 weeks Check whether this branch is still needed
```

Absolute time:

```text
/remind at 2030-10-15T16:00:00Z Review the release candidate
```

Absolute V1 times must be explicit ISO-8601 timestamps.

## List reminders

```text
/reminders
```

This lists active reminders created by the requesting user on the current issue or pull request.

## Cancel a reminder

```text
/remind cancel <id>
```

Only the reminder creator can cancel it through the command interface.

## Delivery

When a reminder becomes due, GitHub Reminders posts a new comment and mentions the creator. Reminder text cannot be used to ping arbitrary third parties because embedded `@` characters are neutralized at delivery.

## Limits

- Reminder text: maximum 500 characters.
- Reminder time: must be in the future.
- Maximum horizon: 10 years.
- Delivery time is approximate because GitHub scheduled workflows may be delayed.

## Privacy

Reminder metadata is stored inside hidden markers in GitHub comments. Anyone who can read the repository conversation may be able to inspect that metadata. Do not place secrets, credentials, regulated data, or sensitive personal information in reminder text.
