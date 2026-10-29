import crypto from "node:crypto";

export const MARKER_PREFIX = "github-reminders:v1";
const GITHUB_ACTIONS_BOT_ID = 41898282;
const GITHUB_ACTIONS_APP_ID = 15368;
const MAX_TEXT = 500;
const MAX_DELAY_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function parseCommand(body, now = new Date()) {
  const input = String(body ?? "").trim();
  if (input === "/reminders") return { kind: "list" };

  const cancel = input.match(/^\/remind\s+cancel\s+([a-f0-9]{8})\s*$/i);
  if (cancel) return { kind: "cancel", id: cancel[1].toLowerCase() };

  const relative = input.match(/^\/remind\s+in\s+(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks)\s+([\s\S]+)$/i);
  if (relative) {
    const count = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const text = validateText(relative[3]);
    const unitMs = unit.startsWith("minute") ? 60_000 : unit.startsWith("hour") ? 3_600_000 : unit.startsWith("day") ? 86_400_000 : 604_800_000;
    const delayMs = count * unitMs;
    if (!Number.isSafeInteger(count) || count <= 0 || delayMs > MAX_DELAY_MS) throw new Error("Relative reminder must be between 1 minute and 10 years.");
    return { kind: "create", dueAt: new Date(now.getTime() + delayMs).toISOString(), text };
  }

  const absolute = input.match(/^\/remind\s+at\s+(\S+)\s+([\s\S]+)$/i);
  if (absolute) {
    const due = new Date(absolute[1]);
    if (Number.isNaN(due.getTime())) throw new Error("Use an ISO-8601 timestamp, for example 2026-10-15T16:00:00Z.");
    const delayMs = due.getTime() - now.getTime();
    if (delayMs <= 0 || delayMs > MAX_DELAY_MS) throw new Error("Reminder time must be in the future and no more than 10 years away.");
    return { kind: "create", dueAt: due.toISOString(), text: validateText(absolute[2]) };
  }

  if (input.startsWith("/remind")) {
    throw new Error("Usage: `/remind in 7 days message`, `/remind at 2026-10-15T16:00:00Z message`, `/reminders`, or `/remind cancel <id>`." );
  }
  return { kind: "ignore" };
}

export function createReminder({ creator, issueNumber, dueAt, text, now = new Date() }) {
  return {
    id: crypto.randomBytes(4).toString("hex"),
    creator,
    issueNumber,
    dueAt,
    text,
    status: "active",
    createdAt: now.toISOString()
  };
}

export function encodeMarker(reminder) {
  const json = JSON.stringify(reminder).replaceAll("-->", "--\\u003e");
  return `<!-- ${MARKER_PREFIX}\n${json}\n-->`;
}

export function decodeMarker(body) {
  const text = String(body ?? "");
  const match = text.match(/<!--\s+github-reminders:v1\n([\s\S]*?)\n-->/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    if (!value || typeof value !== "object" || typeof value.id !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

/** A marker is data, not authority. GitHub API actor and App provenance decide trust. */
export function trustedReminderFromComment(comment, expectedIssueNumber) {
  if (!isGitHubActionsComment(comment)) return null;
  return validateReminder(decodeMarker(comment.body), expectedIssueNumber);
}

export function isGitHubActionsComment(comment) {
  const actor = comment?.user;
  const app = comment?.performed_via_github_app;
  return actor?.id === GITHUB_ACTIONS_BOT_ID
    && actor?.login === "github-actions[bot]"
    && actor?.type === "Bot"
    && app?.id === GITHUB_ACTIONS_APP_ID
    && app?.slug === "github-actions";
}

export function validateReminder(value, expectedIssueNumber) {
  if (!value || typeof value !== "object") return null;
  if (!/^[a-f0-9]{8}$/.test(value.id ?? "")) return null;
  if (!/^[A-Za-z0-9-]+$/.test(value.creator ?? "")) return null;
  if (!Number.isSafeInteger(value.issueNumber) || value.issueNumber <= 0 || value.issueNumber !== expectedIssueNumber) return null;
  if (!isCanonicalIso(value.dueAt) || !isCanonicalIso(value.createdAt)) return null;
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > MAX_TEXT) return null;
  if (!["active", "cancelled", "sent"].includes(value.status)) return null;
  if (value.status === "sent" && !isCanonicalIso(value.sentAt)) return null;
  if (value.status !== "sent" && value.sentAt !== undefined) return null;
  return value;
}

export function confirmationBody(reminder) {
  return `${encodeMarker(reminder)}\n⏰ Reminder **${reminder.id}** set for ${formatGitHubTime(reminder.dueAt)}. I’ll mention @${reminder.creator} here when it’s due.`;
}

export function cancelledBody(reminder) {
  const cancelled = { ...reminder, status: "cancelled" };
  return `${encodeMarker(cancelled)}\n~~⏰ Reminder **${reminder.id}** for ${formatGitHubTime(reminder.dueAt)}~~ — cancelled by @${reminder.creator}.`;
}

export function sentMarkerBody(reminder) {
  const sent = { ...reminder, status: "sent", sentAt: new Date().toISOString() };
  return `${encodeMarker(sent)}\n✅ Reminder **${reminder.id}** delivered ${formatGitHubTime(sent.sentAt)}.`;
}

export function deliveryMarker(id) {
  return `<!-- github-reminders:delivered:${id} -->`;
}

export function dueReminderBody(reminder) {
  return `${deliveryMarker(reminder.id)}\n⏰ @${reminder.creator}, reminder **${reminder.id}** is due now:\n\n> ${sanitizeMentions(reminder.text)}`;
}

export function isDue(reminder, now = new Date()) {
  return reminder?.status === "active" && Date.parse(reminder.dueAt) <= now.getTime();
}

export function sanitizeMentions(text) {
  return String(text).replaceAll("@", "@\u200b");
}

export function formatGitHubTime(iso) {
  return `<t:${Math.floor(Date.parse(iso) / 1000)}:F>`;
}

function isCanonicalIso(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validateText(text) {
  const value = String(text).trim();
  if (!value) throw new Error("Reminder text cannot be empty.");
  if (value.length > MAX_TEXT) throw new Error(`Reminder text must be ${MAX_TEXT} characters or fewer.`);
  return value;
}
