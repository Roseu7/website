import { createContext, useContext, type MouseEvent } from "react";
import type { OsApp } from "~/utils/os";

export const OsPageContext = createContext(false);
export const OsWindowActiveContext = createContext(true);
export const OsCloseAppContext = createContext<(() => void) | undefined>(undefined);
export const OsOpenAppContext = createContext<((app: OsApp, event: MouseEvent<HTMLAnchorElement>) => void) | undefined>(undefined);
export const useOsPage = () => useContext(OsPageContext);
