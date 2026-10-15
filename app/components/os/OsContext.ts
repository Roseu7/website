import { createContext, useContext, type MouseEvent } from "react";
import type { OsApp } from "~/utils/os";
import type { ConsoleReply } from "~/utils/console";

export const OsPageContext = createContext(false);
export const OsWindowActiveContext = createContext(true);
export const OsCloseAppContext = createContext<(() => void) | undefined>(undefined);
export const OsOpenAppContext = createContext<((app: OsApp, event: MouseEvent<HTMLAnchorElement>) => void) | undefined>(undefined);
export const useOsPage = () => useContext(OsPageContext);
export type OsEditorDocument = { path: string; text: string; save: (path: string, text: string) => Promise<ConsoleReply> };
export const OsEditorContext = createContext<{ document: OsEditorDocument | null; open: (document: OsEditorDocument) => boolean; setDirty: (dirty: boolean) => void }>({ document: null, open: () => false, setDirty: () => {} });
export const OsDeveloperContext = createContext<{
  presses: number; pressBuild: () => void;
  command: { id: number; text: string; operation?: "developer" } | null; runCommand: (text: string, operation?: "developer") => void; consumeCommand: (id: number) => void;
  registration: string | null; register: (ticket: string | null) => void;
}>({ presses: 0, pressBuild: () => {}, command: null, runCommand: () => {}, consumeCommand: () => {}, registration: null, register: () => {} });
