import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";

export interface DraftValue { title: string; summary: string; body: JSONContent }
export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
export type PublishMode = { kind: "first"; status: "unlisted" | "published" } | { kind: "update" };

interface Backup extends DraftValue { baseRevision: number; version: number; savedAt: number }
export interface StoredBackup { key: string; backup: Backup }
interface WriteOk { revision: number; updatedAt: number; hasUnpublishedChanges: boolean }
interface Snapshot { draft: DraftValue; version: number }

const AUTOSAVE_DELAY = 3000;
const RETRY_DELAY = 10000;
// 控えは記事と編集画面（タブ）の組で分ける。記事だけで分けると、別のタブの保存成功が
// このタブの未送信の控えを消してしまう。
const backupPrefix = (id: string) => `article-backup:${id}:`;

// localStorageは使えない環境（プライベートモードなど）があるので、読めなくても編集は続けられるようにする。
export function findBackup(id: string, exceptKey?: string): StoredBackup | null {
  try {
    let found: StoredBackup | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(backupPrefix(id)) || key === exceptKey) continue;
      const backup = JSON.parse(localStorage.getItem(key) ?? "null") as Backup | null;
      if (backup && (!found || backup.savedAt > found.backup.savedAt)) found = { key, backup };
    }
    return found;
  } catch {
    return null;
  }
}
export function removeStoredBackup(key: string) {
  try { localStorage.removeItem(key); } catch { /* 消せなくても次に開いたときに選び直せる */ }
}

export function useArticleSaver({ id, initialRevision, getDraft, onWritten }: {
  id: string;
  initialRevision: number;
  getDraft: () => DraftValue;
  onWritten: (result: WriteOk) => void;
}) {
  const [state, setState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [backupFailed, setBackupFailed] = useState(false);
  const ownKey = useRef("");
  const revision = useRef(initialRevision);
  const conflictRevision = useRef<number | null>(null);
  // 編集のたびに増やす端末内の版番号。保存の応答が、どの編集までを含むかを判定する。
  const version = useRef(0);
  const savedVersion = useRef(0);
  const leaving = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ getDraft, onWritten });
  latest.current = { getDraft, onWritten };
  const stateRef = useRef(state);
  stateRef.current = state;
  if (!ownKey.current && typeof crypto !== "undefined") ownKey.current = `${backupPrefix(id)}${crypto.randomUUID()}`;

  const setSaveState = useCallback((next: SaveState) => { stateRef.current = next; setState(next); }, []);
  const hasUnsent = () => version.current > savedVersion.current;

  const writeBackup = useCallback(() => {
    const backup: Backup = { ...latest.current.getDraft(), baseRevision: revision.current, version: version.current, savedAt: Date.now() };
    try {
      localStorage.setItem(ownKey.current, JSON.stringify(backup));
      setBackupFailed(false);
    } catch {
      setBackupFailed(true);
    }
  }, []);

  const send = useCallback((op: "save" | "publish", extra: Record<string, unknown> = {}, snapshot?: Snapshot) => {
    const retryLater = (text: string) => {
      setSaveState("error");
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void send("save"), RETRY_DELAY);
    };
    const run = async (): Promise<boolean> => {
      if (stateRef.current === "conflict") return false;
      const draft = snapshot?.draft ?? latest.current.getDraft();
      const sentVersion = snapshot?.version ?? version.current;
      if (op === "save" && sentVersion <= savedVersion.current) return true;
      setSaveState("saving");
      let response: Response;
      try {
        response = await fetch(`/admin/api/articles/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ op, revision: revision.current, ...draft, ...extra }),
        });
      } catch {
        retryLater("保存できませんでした。通信が戻ったら自動でやり直します。");
        return false;
      }
      const result = await response.json().catch(() => null) as (Partial<WriteOk> & { error?: { code?: string; message?: string } }) | null;
      if (response.status === 409 && typeof result?.revision === "number") {
        conflictRevision.current = result.revision;
        setSaveState("conflict");
        setMessage("ほかの画面で先に保存されています。");
        return false;
      }
      if (response.status >= 500 || response.status === 429) {
        retryLater(`保存できませんでした（HTTP ${response.status}）。少ししたら自動でやり直します。`);
        return false;
      }
      if (!response.ok || !result || typeof result.revision !== "number") {
        // 入力の誤りや公開状態の食い違いは、やり直しても通らないので再試行しない。
        setSaveState("error");
        setMessage(result?.error?.message ?? `保存できませんでした（HTTP ${response.status}）。`);
        return false;
      }
      revision.current = result.revision;
      savedVersion.current = Math.max(savedVersion.current, sentVersion);
      latest.current.onWritten(result as WriteOk);
      setMessage("");
      if (hasUnsent()) {
        // 送信中に書き足した分は控えに残し、もとにする版番号だけ進める。
        writeBackup();
        setSaveState("dirty");
      } else {
        removeStoredBackup(ownKey.current);
        setSaveState("saved");
      }
      return true;
    };
    // 保存の順番が入れ替わると古い原稿で上書きしうるので、送信は1本ずつ並べる。
    const next = queue.current.then(run, run);
    queue.current = next;
    return next;
  }, [id, setSaveState, writeBackup]);

  const markChanged = useCallback(() => {
    version.current += 1;
    writeBackup();
    if (stateRef.current === "conflict") return;
    if (stateRef.current !== "error") setSaveState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void send("save"), AUTOSAVE_DELAY);
  }, [send, setSaveState, writeBackup]);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    return send("save");
  }, [send]);

  // 公開は、押した時点の原稿で行う。押したあとに書き足した分は、公開されずに下書きに残る。
  const publish = useCallback((mode: PublishMode) => {
    clearTimeout(timer.current);
    const snapshot = { draft: latest.current.getDraft(), version: version.current };
    const extra = mode.kind === "first" ? { mode: "first", status: mode.status } : { mode: "update" };
    return send("publish", extra, snapshot);
  }, [send]);

  const overwriteAfterConflict = useCallback(() => {
    if (conflictRevision.current === null) return Promise.resolve(false);
    revision.current = conflictRevision.current;
    conflictRevision.current = null;
    savedVersion.current = -1;
    setSaveState("dirty");
    return send("save");
  }, [send, setSaveState]);

  // 自分の原稿を捨ててサーバーの版を読み込む。離脱の警告を出さずに読み直す。
  const discardAndReload = useCallback(() => {
    leaving.current = true;
    clearTimeout(timer.current);
    removeStoredBackup(ownKey.current);
    window.location.reload();
  }, []);

  // 戻した控えは、控えを作ったときの版番号をもとに保存する。サーバーが先に進んでいれば競合として扱う。
  const restoreFrom = useCallback((baseRevision: number) => {
    revision.current = baseRevision;
    markChanged();
  }, [markChanged]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && hasUnsent() && stateRef.current !== "conflict") void saveNow();
    };
    const warn = (event: BeforeUnloadEvent) => { if (!leaving.current && hasUnsent()) event.preventDefault(); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", warn);
      clearTimeout(timer.current);
    };
  }, [saveNow]);

  return { state, message, backupFailed, ownBackupKey: ownKey.current, markChanged, saveNow, publish, overwriteAfterConflict, discardAndReload, restoreFrom };
}
