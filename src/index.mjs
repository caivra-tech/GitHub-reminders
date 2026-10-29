import fs from "node:fs";
import {
  parseCommand,
  createReminder,
  confirmationBody,
  cancelledBody,
  sentMarkerBody,
  dueReminderBody,
  reminderDeliveryMarker,
  isDue,
  trustedReminderFromComment,
  isGitHubActionsComment,
  formatGitHubTime
} from "./reminders.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const eventName = process.env.GITHUB_EVENT_NAME;
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!token || !repository || !eventName || !eventPath) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_NAME and GITHUB_EVENT_PATH are required.");
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const [owner, repo] = repository.split("/");
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${options.method || "GET"} ${path} failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function getIssueComments(issueNumber) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function postComment(issueNumber, body) {
  return api(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

async function updateComment(commentId, body) {
  return api(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

async function handleCommentCommand() {
  if (event.action !== "created" || !event.comment || !event.issue) return;
  if (event.comment.user?.type === "Bot") return;

  let command;
  try {
    command = parseCommand(event.comment.body, new Date());
  } catch (error) {
    await postComment(event.issue.number, `⚠️ ${error.message}`);
    return;
  }
  if (command.kind === "ignore") return;

  const actor = event.comment.user.login;
  const comments = command.kind === "create" ? [] : await getIssueComments(event.issue.number);
  const trusted = comments
    .map((comment) => ({ comment, reminder: trustedReminderFromComment(comment, event.issue.number, repository) }))
    .filter(({ reminder }) => reminder);
  const owned = trusted.filter(({ reminder }) => reminder.creator.toLowerCase() === actor.toLowerCase());
  const uniqueOwned = owned.filter(({ reminder }) => trusted.filter((entry) => entry.reminder.id === reminder.id).length === 1);

  if (command.kind === "create") {
    const reminder = createReminder({ creator: actor, issueNumber: event.issue.number, dueAt: command.dueAt, text: command.text });
    await postComment(event.issue.number, confirmationBody(reminder));
    return;
  }

  if (command.kind === "list") {
    const active = uniqueOwned.filter(({ reminder }) => reminder.status === "active");
    const body = active.length
      ? `⏰ Active reminders for @${actor}:\n\n${active.map(({ reminder }) => `- **${reminder.id}** — ${formatGitHubTime(reminder.dueAt)} — ${reminder.text}`).join("\n")}`
      : `@${actor}, you have no active reminders on this issue or pull request.`;
    await postComment(event.issue.number, body);
    return;
  }

  if (command.kind === "cancel") {
    const matching = trusted.filter(({ reminder }) => reminder.id === command.id);
    if (matching.length > 1) {
      await postComment(event.issue.number, "⚠️ Ambiguous reminder identifier detected. Cancellation refused; request maintainer review.");
      return;
    }
    const match = uniqueOwned.find(({ reminder }) => reminder.id === command.id && reminder.status === "active");
    if (!match) {
      await postComment(event.issue.number, `⚠️ @${actor}, active reminder **${command.id}** was not found or does not belong to you.`);
      return;
    }
    await updateComment(match.comment.id, cancelledBody(match.reminder));
    await postComment(event.issue.number, `✅ @${actor}, reminder **${command.id}** cancelled.`);
  }
}

async function handleScheduledDelivery() {
  const now = new Date();
  for (let page = 1; ; page++) {
    const comments = await api(`/repos/${owner}/${repo}/issues/comments?sort=created&direction=asc&per_page=100&page=${page}`);
    for (const comment of comments) {
      const issueNumber = Number(comment.issue_url.split("/").pop());
      if (!Number.isSafeInteger(issueNumber)) continue;
      const reminder = trustedReminderFromComment(comment, issueNumber, repository);
      if (!isDue(reminder, now)) continue;

      const issueComments = await getIssueComments(issueNumber);
      const matching = issueComments.filter((item) => trustedReminderFromComment(item, issueNumber, repository)?.id === reminder.id);
      // Refuse ambiguous or replayed IDs, even when the creator differs.
      if (matching.length !== 1 || matching[0].id !== comment.id) continue;
      const marker = reminderDeliveryMarker(reminder, comment.id);
      const alreadyDelivered = issueComments.some((item) => isGitHubActionsComment(item) && String(item.body ?? "").includes(marker));
      if (!alreadyDelivered) await postComment(issueNumber, dueReminderBody(reminder, comment.id));
      await updateComment(comment.id, sentMarkerBody(reminder));
    }
    if (comments.length < 100) break;
  }
}

if (eventName === "issue_comment") await handleCommentCommand();
else if (eventName === "schedule" || eventName === "workflow_dispatch") await handleScheduledDelivery();
