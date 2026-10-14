import { CONSOLE_COMMAND_LIMIT, CONSOLE_SESSION_DURATION, isSensitiveConsoleInput } from "./console";

const prefix = "ros3u.console.";
const validInput = (value: unknown): value is string => typeof value === "string" && value.length <= CONSOLE_COMMAND_LIMIT
  && !/[\x00-\x08\x0a-\x1f\x7f]/.test(value) && !isSensitiveConsoleInput(value);

export type ConsoleWorkspace = { sessionId: string; resumeTicket: string };

export function loadConsoleStorage(storage: Storage) {
  const historyValue = storage.getItem(prefix + "history");
  let history: string[] = [];
  try {
    const value: unknown = historyValue && historyValue.length > 100 * (2 * CONSOLE_COMMAND_LIMIT + 8) ? [] : JSON.parse(historyValue ?? "[]");
    if (Array.isArray(value)) history = value.filter(validInput).slice(-100);
  } catch { storage.removeItem(prefix + "history"); }
  if (historyValue !== null && historyValue !== JSON.stringify(history)) saveConsoleHistory(storage, history);
  const text = storage.getItem(prefix + "draft");
  const draft = validInput(text) ? text : "";
  if (text && !draft) storage.removeItem(prefix + "draft");
  let workspace: ConsoleWorkspace | null = null;
  try {
    const value = JSON.parse(storage.getItem(prefix + "workspace") ?? "null");
    if (value && typeof value.sessionId === "string" && /^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.sessionId)
      && typeof value.resumeTicket === "string" && value.resumeTicket.length <= 1024
      && Number(value.sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION > Date.now()) {
      workspace = { sessionId: value.sessionId, resumeTicket: value.resumeTicket };
    }
  } catch { /* A damaged saved identifier starts a fresh Guest workspace. */ }
  if (!workspace) storage.removeItem(prefix + "workspace");
  return { history, draft, workspace };
}

export function saveConsoleWorkspace(storage: Storage, workspace: ConsoleWorkspace) {
  storage.setItem(prefix + "workspace", JSON.stringify({ sessionId: workspace.sessionId, resumeTicket: workspace.resumeTicket }));
}

export function saveConsoleHistory(storage: Storage, history: string[]) {
  storage.setItem(prefix + "history", JSON.stringify(history.filter(validInput).slice(-100)));
}

export function saveConsoleDraft(storage: Storage, draft: string, password: boolean) {
  if (password || !draft || !validInput(draft)) storage.removeItem(prefix + "draft");
  else storage.setItem(prefix + "draft", draft);
}
