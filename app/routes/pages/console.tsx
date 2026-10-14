import { useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { OsCloseAppContext, OsWindowActiveContext } from "~/components/os/OsContext";
import { useLoaderData, useNavigate } from "~/framework/navigation";
import { CONSOLE_COMMAND_LIMIT, type ConsoleCompletion, type ConsoleReply } from "~/utils/console";
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
  const sessionId = useRef(initial.sessionId).current;
  const navigate = useNavigate();
  const active = useContext(OsWindowActiveContext);
  const close = useContext(OsCloseAppContext);
  const [cwd, setCwd] = useState(initial.cwd);
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState([{ id: 0, text: initial.greeting }]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const history = useRef<string[]>([]);
  const cursor = useRef(0);
  const draft = useRef("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const completion = useRef<(ConsoleCompletion & { command: string; caret: number; index: number }) | null>(null);
  const completionRequest = useRef<{ controller: AbortController; offset: number } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); resetCompletion(); };
  }, []);
  useEffect(() => {
    if (active) formRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries, active]);

  function resetCompletion() {
    completion.current = null;
    completionRequest.current?.controller.abort();
    completionRequest.current = null;
  }

  function appendOutput(text: string) {
    const entry = { id: ++sequence.current, text };
    setEntries(current => {
      const next = [...current, entry];
      let size = next.reduce((total, item) => total + item.text.length, 0);
      while (size > 64 * 1024 && next.length > 1) size -= next.shift()!.text.length;
      return next;
    });
  }

  async function complete(direction: number) {
    const input = inputRef.current;
    if (!input || inFlight.current) return;
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
      cursor.current = history.current.length;
    };
    if (cached?.command === command && cached.caret === caret && input.selectionEnd === caret) {
      if (cached.candidates.length) apply({ ...cached, index: (cached.index + direction + cached.candidates.length) % cached.candidates.length });
      return;
    }
    if (completionRequest.current) { completionRequest.current.offset += direction; return; }
    completion.current = null;
    const request = { controller: new AbortController(), offset: direction > 0 ? 0 : -1 };
    completionRequest.current = request;
    try {
      const response = await fetch("/api/console", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "complete", command, sessionId, cursor: caret }), signal: request.controller.signal });
      if (!response.ok) {
        if (mounted.current && completionRequest.current === request) appendOutput(response.status === 429 ? "\nToo many commands. Try again in 60 seconds.\n" : response.status === 410 ? "\nSession expired. Reopen the command prompt.\n" : `\nCompletion service error (${response.status}). Try again.\n`);
        return;
      }
      const result = await response.json() as ConsoleCompletion;
      if (!mounted.current || completionRequest.current !== request || input.value !== command || input.selectionStart !== caret) return;
      const state = { ...result, command, caret, index: result.candidates.length ? ((request.offset % result.candidates.length) + result.candidates.length) % result.candidates.length : 0 };
      completion.current = state;
      if (result.candidates.length) apply(state);
    } catch {
      if (!request.controller.signal.aborted && mounted.current && completionRequest.current === request) appendOutput("\nThe completion service is unavailable. Try again.\n");
    } finally {
      if (completionRequest.current === request) completionRequest.current = null;
    }
  }

  function recall(delta: number) {
    if (inFlight.current) return;
    resetCompletion();
    if (cursor.current === history.current.length) draft.current = command;
    cursor.current = Math.max(0, Math.min(history.current.length, cursor.current + delta));
    setCommand(cursor.current === history.current.length ? draft.current : history.current[cursor.current]);
    inputRef.current?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !command.trim()) return;
    resetCompletion();
    const submitted = command;
    inFlight.current = true; setBusy(true); setCommand("");
    history.current = [...history.current, submitted].slice(-100);
    cursor.current = history.current.length; draft.current = "";
    controller.current = new AbortController();
    let result: ConsoleReply;
    try {
      const response = await fetch("/api/console", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: submitted, sessionId }), signal: controller.current.signal });
      if (!response.ok) {
        result = { cwd, output: response.status === 429 ? "Too many commands. Try again in 60 seconds." : response.status === 410 ? "Session expired. Reopen the command prompt." : `Command service error (${response.status}). Try again.` };
      } else result = await response.json() as ConsoleReply;
    } catch {
      result = { cwd, output: "The command service is unavailable. Try again." };
    }
    if (!mounted.current) return;
    setCwd(result.cwd);
    if (result.effect === "clear") setEntries([]);
    else if (result.effect === "exit") close?.();
    else {
      appendOutput(`${cwd}>${submitted}\n${result.output}\n`);
      if (result.launch) void navigate(result.launch);
    }
    inFlight.current = false; setBusy(false);
  }

  return <PageLayout contentClassName="os-console-page">
    <div className="os-console-surface" onClick={event => {
      if (active && !(event.target as Element).closest("button, input") && !window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
    }}>
      <div className="os-console-output" role="log" aria-label="コマンドの出力" aria-live="polite" aria-relevant="additions">
        {entries.map(entry => <pre key={entry.id}>{entry.text}</pre>)}
      </div>
      <form ref={formRef} className="os-console-command" onSubmit={submit} aria-busy={busy}>
        <div className="os-console-line">
        <span className="os-console-prompt">{cwd}&gt;</span>
        <input ref={inputRef} className="os-console-input" aria-label="コマンド" value={command} maxLength={CONSOLE_COMMAND_LIMIT} readOnly={busy} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" onChange={event => { resetCompletion(); setCommand(event.target.value); cursor.current = history.current.length; }} onPointerDown={resetCompletion} onBlur={resetCompletion} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); void complete(event.shiftKey ? -1 : 1); return; }
          if (event.key !== "Shift") resetCompletion();
          if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); recall(event.key === "ArrowUp" ? -1 : 1); }
        }} />
        </div>
        <div className="os-console-actions" data-ui-actions>
          <ConsoleAction label="前のコマンド" disabled={busy} onClick={() => recall(-1)}><ArrowUp size={20} aria-hidden="true" /></ConsoleAction>
          <ConsoleAction label="次のコマンド" disabled={busy} onClick={() => recall(1)}><ArrowDown size={20} aria-hidden="true" /></ConsoleAction>
          <ConsoleAction label="実行" disabled={busy}><CornerDownLeft size={20} aria-hidden="true" /></ConsoleAction>
        </div>
      </form>
    </div>
  </PageLayout>;
}
