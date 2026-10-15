import { useContext, useEffect, useRef, useState } from "react";
import { OsEditorContext } from "~/components/os/OsContext";

export default function NotepadPage() {
  const { document, setDirty } = useContext(OsEditorContext);
  const [path, setPath] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const currentDocument = useRef(document);
  currentDocument.current = document;
  const saved = useRef({ path: "", text: "" });
  useEffect(() => {
    setPath(document?.path ?? ""); setText(document?.text ?? ""); setStatus(""); setBusy(false);
    saved.current = { path: document?.path ?? "", text: (document?.text ?? "").replace(/\r\n/g, "\n") };
    setDirty(false);
    textarea.current?.focus({ preventScroll: true });
  }, [document, setDirty]);
  const dirty = path !== saved.current.path || text.replace(/\r\n/g, "\n") !== saved.current.text;
  useEffect(() => { setDirty(dirty); }, [dirty, setDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!document || busy) return;
    const sourceDocument = document;
    if (!path.trim()) { setStatus("The filename is required."); return; }
    setBusy(true); setStatus("");
    const newline = document.text.includes("\r\n") || !document.text.includes("\n") ? "\r\n" : "\n";
    const normalized = text.replace(/\r\n/g, "\n");
    const content = normalized === document.text.replace(/\r\n/g, "\n") ? document.text : normalized.replace(/\n/g, newline);
    try {
      const result = await document.save(path, content);
      if (currentDocument.current !== sourceDocument) return;
      if (result.editor) {
        saved.current = { path: result.editor.path, text: result.editor.text.replace(/\r\n/g, "\n") };
        setPath(result.editor.path); setDirty(false); setStatus("保存しました");
      }
      else setStatus(result.output);
    } catch { if (currentDocument.current === sourceDocument) setStatus("The editor service is unavailable. Try again."); }
    finally { if (currentDocument.current === sourceDocument) setBusy(false); }
  }
  return <div className="os-page-content os-notepad-page" onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
  }}>
    <form className="os-notepad-toolbar" onSubmit={event => { event.preventDefault(); void save(); }} aria-busy={busy}>
      <label htmlFor="notepad-path">ファイル</label>
      <input id="notepad-path" value={path} onChange={event => setPath(event.target.value)} maxLength={260} disabled={busy || !document} autoComplete="off" spellCheck={false} />
      <button type="submit" className="btn site-button" disabled={busy || !document}>保存</button>
    </form>
    <textarea ref={textarea} className="os-notepad-text" aria-label="本文" value={text} onChange={event => setText(event.target.value)} maxLength={64 * 1024} readOnly={busy || !document} spellCheck={false} />
    <p className="os-notepad-status" role="status">{status}</p>
  </div>;
}
