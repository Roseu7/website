import { useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { OsCloseAppContext, OsWindowActiveContext, OsEditorContext, OsDeveloperContext } from "~/components/os/OsContext";
import { useLoaderData, useNavigate } from "~/framework/navigation";
import { CONSOLE_COMMAND_LIMIT, createConsoleShell, executeLocalConsole, expandConsole, isSensitiveConsoleInput, type ConsoleShell, type ConsoleCompletion, type ConsoleReply } from "~/utils/console";
import { loadConsoleStorage, saveConsoleWorkspace, saveConsoleHistory, saveConsoleDraft } from "~/utils/console-storage";
import { siteConfig } from "~/utils/site";
import type { loader } from "./console.server";

export const meta = () => [{ title: `コマンド プロンプト | ${siteConfig.fullName}` }];

function ConsoleAction({ label, children, disabled, onClick }: { label: string; children: ReactNode; disabled: boolean; onClick?: () => void }) {
  const id = useId();
  const [tooltip, setTooltip] = useState(false);
  return <span className="os-console-action" onPointerEnter={() => setTooltip(true)} onPointerLeave={() => setTooltip(false)} onBlur={() => setTooltip(false)} onKeyDown={event => { if (event.key === "Escape") setTooltip(false); }}>
    <button type={onClick ? "button" : "submit"} aria-label={label} aria-describedby={id} disabled={disabled} onFocus={event => { if (event.target.matches(":focus-visible")) setTooltip(true); }} onMouseDown={event => event.preventDefault()} onClick={() => { setTooltip(false); onClick?.(); }}>{children}</button>
    <span id={id} role="tooltip" className="os-console-tooltip" hidden={!tooltip}>{label}</span>
  </span>;
}

export default function ConsolePage() {
  const initial = useLoaderData<typeof loader>();
  const sessionId = useRef(initial.sessionId);
  const proof = useRef(initial.proof);
  const shells = useRef<ConsoleShell[]>([createConsoleShell()]);
  const version = useRef(initial.greeting.trim()).current;
  const navigate = useNavigate();
  const active = useContext(OsWindowActiveContext);
  const close = useContext(OsCloseAppContext);
  const editor = useContext(OsEditorContext);
  const developer = useContext(OsDeveloperContext);
  const registration = useRef(developer.registration);
  registration.current = developer.registration;
  const [cwd, setCwd] = useState(initial.cwd);
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<{ id: number; text: string; link?: string }[]>([{ id: 0, text: initial.greeting }]);
  const [busy, setBusy] = useState(true);
  const [inputMode, setInputMode] = useState<"command" | "password">("command");
  const passwordInput = useRef(false);
  const passwordChallenge = useRef<string | undefined>(undefined);
  const storage = useRef<Storage | null>(null);
  const storageError = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sequence = useRef(0);
  const inFlight = useRef(true);
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const draft = useRef("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const completion = useRef<(ConsoleCompletion & { command: string; caret: number; index: number; expires: number }) | null>(null);
  const completionRequest = useRef<{ controller: AbortController; offset: number } | null>(null);
  useEffect(() => {
    mounted.current = true;
    inFlight.current = true;
    setBusy(true);
    const restoreController = new AbortController();
    async function restore() {
      let ready = true;
      try {
        storage.current = window.localStorage;
        const saved = loadConsoleStorage(storage.current);
        history.current = saved.history;
        cursor.current = saved.history.length;
        setCommand(saved.draft);
        if (saved.workspace) {
          let response: Response;
          try {
            response = await fetch("/api/console", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operation: "resume", ...saved.workspace }), signal: restoreController.signal });
          } catch (cause) {
            if (restoreController.signal.aborted) return;
            ready = false;
            appendOutput("The Guest workspace could not be restored. Reopen the command prompt to try again.\n");
            return;
          }
          if (restoreController.signal.aborted || !mounted.current) return;
          if (response.ok) {
            let result: { proof?: unknown } | null;
            try { result = await response.json(); } catch { result = null; }
            if (!result || typeof result.proof !== "string" || result.proof.length > 1024) {
              ready = false;
              appendOutput("The Guest workspace service returned invalid data. Reopen the command prompt to try again.\n");
              return;
            }
            if (restoreController.signal.aborted || !mounted.current) return;
            sessionId.current = saved.workspace.sessionId;
            proof.current = result.proof;
            if (storage.current) saveConsoleWorkspace(storage.current, saved.workspace);
            return;
          }
          if (![403, 410].includes(response.status)) {
            ready = false;
            appendOutput(`Guest workspace service error (${response.status}). Reopen the command prompt to try again.\n`);
            return;
          }
        }
        if (!restoreController.signal.aborted && mounted.current) saveConsoleWorkspace(storage.current, { sessionId: initial.sessionId, resumeTicket: initial.resumeTicket });
      } catch { storageFailed(); }
      finally {
        if (ready && !restoreController.signal.aborted && mounted.current) { inFlight.current = false; setBusy(false); }
      }
    }
    void restore();
    const saveVisibleInput = () => { if (!inFlight.current) persistDraft(inputRef.current?.value ?? ""); };
    const onVisibility = () => { if (document.visibilityState === "hidden") saveVisibleInput(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveVisibleInput);
    return () => {
      mounted.current = false; restoreController.abort(); controller.current?.abort(); resetCompletion();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveVisibleInput);
    };
  }, []);
  useEffect(() => {
    if (active) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries, active]);
  useEffect(() => {
    if (!active || busy || !developer.command || inFlight.current) return;
    const requested = developer.command;
    developer.consumeCommand(requested.id);
    passwordInput.current = false; passwordChallenge.current = undefined; setInputMode("command");
    void runCommand(requested.text, requested.operation);
  }, [active, busy, developer.command]);

  function resetCompletion() {
    completion.current = null;
    completionRequest.current?.controller.abort();
    completionRequest.current = null;
  }

  function storageFailed() {
    storage.current = null;
    if (!storageError.current) { storageError.current = true; appendOutput("Local history storage is unavailable. Commands will be kept in memory.\n"); }
  }

  function persistDraft(value: string) {
    try { if (storage.current) saveConsoleDraft(storage.current, value, passwordInput.current || isSensitiveConsoleInput(expandConsole(value, shells.current[shells.current.length - 1]))); }
    catch { storageFailed(); }
  }

  function appendOutput(text: string, link?: string) {
    const entry = { id: ++sequence.current, text, ...(link ? { link } : {}) };
    setEntries(current => {
      const next = [...current, entry];
      let size = next.reduce((total, item) => total + item.text.length, 0);
      while (size > 64 * 1024 && next.length > 1) size -= next.shift()!.text.length;
      return next;
    });
  }

  async function requestConsole(body: { command: string; operation?: "complete" | "password" | "cancel" | "save" | "developer"; cursor?: number; challenge?: string; path?: string; text?: string }, signal: AbortSignal) {
    const send = () => fetch("/api/console", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, sessionId: sessionId.current, proof: proof.current, shells: shells.current, ...(registration.current ? { registration: registration.current } : {}) }), signal });
    const response = await send();
    if (response.status !== 401) return response;
    const renewal = await response.json() as { proof?: string };
    if (!renewal.proof || signal.aborted) return response;
    proof.current = renewal.proof;
    return send();
  }

  function needsRenewal() {
    // Decoding only schedules renewal; permissions always come from server signature checks.
    try {
      const claim = JSON.parse(atob(proof.current.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
      return claim.sub === "Roseu" && claim.exp <= Math.floor(Date.now() / 1000);
    } catch { return true; }
  }

  async function complete(direction: number) {
    const input = inputRef.current;
    if (!input || inFlight.current || passwordInput.current) return;
    const caret = input.selectionStart ?? command.length;
    const cached = completion.current;
    const apply = (state: NonNullable<typeof completion.current>) => {
      const candidate = state.candidates[state.index];
      const next = command.slice(0, state.start) + candidate + command.slice(state.end);
      const nextCaret = state.start + candidate.length;
      completion.current = { ...state, command: next, end: nextCaret, caret: nextCaret };
      // Move the caret before React's controlled-value update so cycling also works mid-line.
      input.value = next;
      input.setSelectionRange(nextCaret, nextCaret);
      setCommand(next);
      persistDraft(next);
      cursor.current = history.current.length;
    };
    if (!needsRenewal() && cached?.command === command && cached.caret === caret && input.selectionEnd === caret && cached.expires > Date.now()) {
      if (cached.candidates.length) apply({ ...cached, index: (cached.index + direction + cached.candidates.length) % cached.candidates.length });
      return;
    }
    if (completionRequest.current) { completionRequest.current.offset += direction; return; }
    completion.current = null;
    const request = { controller: new AbortController(), offset: direction > 0 ? 0 : -1 };
    completionRequest.current = request;
    try {
      const response = await requestConsole({ operation: "complete", command, cursor: caret }, request.controller.signal);
      if (!response.ok) {
        if (mounted.current && completionRequest.current === request) appendOutput(response.status === 429 ? "\nToo many commands. Try again in 60 seconds.\n" : response.status === 410 ? "\nSession expired. Reopen the command prompt.\n" : `\nCompletion service error (${response.status}). Try again.\n`);
        return;
      }
      const result = await response.json() as ConsoleCompletion & ConsoleReply & { proof: string; shells: ConsoleShell[] };
      if (!mounted.current || completionRequest.current !== request || input.value !== command || input.selectionStart !== caret) return;
      proof.current = result.proof;
      if (result.registration !== undefined) developer.register(result.registration);
      if (result.reset) {
        shells.current = result.shells; setCwd(result.cwd); setCommand(""); persistDraft("");
        appendOutput(result.output + "\n"); return;
      }
      const state = { ...result, command, caret, expires: Date.now() + 30_000, index: result.candidates.length ? ((request.offset % result.candidates.length) + result.candidates.length) % result.candidates.length : 0 };
      completion.current = state;
      if (result.candidates.length) apply(state);
    } catch {
      if (!request.controller.signal.aborted && mounted.current && completionRequest.current === request) appendOutput("\nThe completion service is unavailable. Try again.\n");
    } finally {
      if (completionRequest.current === request) completionRequest.current = null;
    }
  }

  function recall(delta: number) {
    if (inFlight.current || passwordInput.current) return;
    resetCompletion();
    if (cursor.current === history.current.length) draft.current = command;
    cursor.current = Math.max(0, Math.min(history.current.length, cursor.current + delta));
    const next = cursor.current === history.current.length ? draft.current : history.current[cursor.current];
    setCommand(next);
    persistDraft(next);
    inputRef.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runCommand(command);
  }
  async function runCommand(submitted: string, operation?: "developer") {
    if (inFlight.current || (!operation && !passwordInput.current && !submitted.trim())) return;
    resetCompletion();
    const enteredPassword = passwordInput.current;
    const sensitive = passwordInput.current || isSensitiveConsoleInput(submitted) || isSensitiveConsoleInput(expandConsole(submitted, shells.current[shells.current.length - 1]));
    inFlight.current = true; setBusy(true); setCommand("");
    if (!sensitive && submitted.trim()) history.current = [...history.current, submitted].slice(-100);
    persistDraft("");
    try { if (storage.current) saveConsoleHistory(storage.current, history.current); } catch { storageFailed(); }
    cursor.current = history.current.length; draft.current = "";
    controller.current = new AbortController();
    let result: ConsoleReply;
    let reserved: Window | null = null;
    const token = /^\s*("[^"]+"|\S+)\s+\S/.exec(expandConsole(submitted, shells.current[shells.current.length - 1]));
    if (!enteredPassword && !operation && token && /^beacon(?:\.exe)?$/i.test(token[1].replaceAll('"', "").split("\\").at(-1)!)) {
      try { reserved = window.open("about:blank", "_blank"); if (reserved) reserved.opener = null; } catch { reserved?.close(); reserved = null; }
    }
    try {
      const local = passwordInput.current || operation || needsRenewal() ? null : executeLocalConsole(submitted, shells.current, version);
      if (local) result = local;
      else {
        const response = await requestConsole({ command: submitted, ...(operation ? { operation } : passwordInput.current ? { operation: "password", challenge: passwordChallenge.current } : {}) }, controller.current.signal);
        if (!response.ok) {
          result = { cwd, output: response.status === 429 ? "Too many commands. Try again in 60 seconds." : response.status === 410 ? "Session expired. Reopen the command prompt." : `Command service error (${response.status}). Try again.` };
        } else {
          const reply = await response.json() as ConsoleReply & { shells: ConsoleShell[]; proof: string };
          result = reply;
          if (mounted.current) { shells.current = reply.shells; proof.current = reply.proof; }
        }
      }
    } catch {
      result = { cwd, output: "The command service is unavailable. Try again." };
    }
    if (!mounted.current) { reserved?.close(); return; }
    let externalLink: string | undefined;
    if (result.external) {
      try {
        const url = new URL(result.external);
        if (url.origin !== "https://x.com" || url.pathname !== "/intent/tweet" || !url.search.startsWith("?text=") || url.searchParams.size !== 1 || url.hash) throw Error("Invalid external URL.");
        if (reserved && !reserved.closed) { reserved.location.replace(url.href); reserved = null; }
        else { externalLink = url.href; result.output = "Could not open a new tab. Open X here:"; }
      } catch { result.output = "Could not open a new tab."; }
    }
    reserved?.close();
    if (result.registration !== undefined) developer.register(result.registration);
    if (result.input) {
      passwordInput.current = result.input === "password";
      passwordChallenge.current = result.challenge;
      setInputMode(result.input);
      persistDraft("");
    } else if (!passwordInput.current) setInputMode("command");
    setCwd(result.cwd);
    if (result.effect === "clear") setEntries([]);
    else if (result.effect === "exit") close?.();
    else {
      const output = sensitive && !enteredPassword && submitted ? result.output.split(submitted).join("[redacted]") : result.output;
      appendOutput(sensitive || operation || result.reset ? `${output}\n` : `${cwd}>${submitted}\n${output}\n`, externalLink);
      let openEditor = true;
      if (result.editor) openEditor = editor.open({ ...result.editor, save: async (path, text) => {
        const response = await requestConsole({ command: "", operation: "save", path, text }, new AbortController().signal);
        if (!response.ok) return { cwd, output: `Editor service error (${response.status}). Try again.` };
        const saved = await response.json() as ConsoleReply & { shells: ConsoleShell[]; proof: string };
        proof.current = saved.proof;
        if (saved.reset) { resetCompletion(); shells.current = saved.shells; setCwd(saved.cwd); setCommand(""); persistDraft(""); }
        if (saved.registration !== undefined) developer.register(saved.registration);
        return saved;
      } });
      if (result.launch && openEditor) void navigate(result.launch);
    }
    inFlight.current = false; setBusy(false);
  }
  async function cancelPassword() {
    if (inFlight.current || !passwordInput.current || !passwordChallenge.current) return;
    inFlight.current = true; setBusy(true); setCommand(""); persistDraft("");
    try {
      const response = await requestConsole({ command: "", operation: "cancel", challenge: passwordChallenge.current }, new AbortController().signal);
      if (!response.ok) { appendOutput(`Password service error (${response.status}). Try again.\n`); return; }
      const reply = await response.json() as ConsoleReply & { proof: string; shells: ConsoleShell[] };
      passwordInput.current = false; passwordChallenge.current = undefined; setInputMode("command");
      proof.current = reply.proof; shells.current = reply.shells;
      if (reply.registration !== undefined) developer.register(reply.registration);
      setCwd(reply.cwd);
      if (reply.output) appendOutput(reply.output + "\n");
    } catch { appendOutput("The password service is unavailable. Try again.\n"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <PageLayout contentClassName="os-console-page">
    <div className="os-console-surface" onClick={event => {
      if (active && !(event.target as Element).closest("button, input") && !window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
    }}>
      <div className="os-console-output" role="log" aria-label="コマンドの出力" aria-live="polite" aria-relevant="additions">
        {entries.map(entry => <pre key={entry.id}>{entry.text}{entry.link && <><a href={entry.link} target="_blank" rel="noopener noreferrer">Open X</a>{"\n"}</>}</pre>)}
      </div>
      <form ref={formRef} className="os-console-command" onSubmit={submit} aria-busy={busy}>
        <div className="os-console-line">
        <span className="os-console-prompt">{inputMode === "password" ? "" : `${cwd}>`}</span>
        <input ref={inputRef} className="os-console-input" type={inputMode === "password" ? "password" : "text"} aria-label={inputMode === "password" ? "パスワード" : "コマンド"} value={command} maxLength={CONSOLE_COMMAND_LIMIT} readOnly={busy} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" onChange={event => { resetCompletion(); setCommand(event.target.value); persistDraft(event.target.value); cursor.current = history.current.length; }} onPointerDown={resetCompletion} onBlur={resetCompletion} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (passwordInput.current) { if (event.key === "Escape") { event.preventDefault(); void cancelPassword(); } return; }
          if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); void complete(event.shiftKey ? -1 : 1); return; }
          if (event.key !== "Shift") resetCompletion();
          if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); recall(event.key === "ArrowUp" ? -1 : 1); }
        }} />
        </div>
        <div className={`os-console-actions${inputMode === "password" ? " os-console-actions--password" : ""}`} data-ui-actions>
          {inputMode === "password" && <button type="button" className="os-console-cancel" disabled={busy} onClick={() => void cancelPassword()}>キャンセル</button>}
          {inputMode === "command" && <>
          <ConsoleAction label="前のコマンド" disabled={busy} onClick={() => recall(-1)}><ArrowUp size={20} aria-hidden="true" /></ConsoleAction>
          <ConsoleAction label="次のコマンド" disabled={busy} onClick={() => recall(1)}><ArrowDown size={20} aria-hidden="true" /></ConsoleAction>
          </>}
          <ConsoleAction label="実行" disabled={busy}><CornerDownLeft size={20} aria-hidden="true" /></ConsoleAction>
        </div>
      </form>
    </div>
  </PageLayout>;
}
