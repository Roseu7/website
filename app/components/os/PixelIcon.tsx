import type { OsApp } from "~/utils/os";

export function PixelIcon({ kind }: { kind: OsApp["icon"] | "system" | "info" }) {
  return (
    <svg className={`os-pixel-icon os-pixel-icon--${kind}`} viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {kind === "console" && <>
        <path fill="#5022c4" d="M2 3h20v18H2z" />
        <path fill="#fff8ff" d="M3 4h18v3H3z" />
        <path fill="#211536" d="M3 8h18v12H3z" />
        <path fill="#bff3f3" d="M5 10h2v1h1v1h1v1H8v1H7v1H5v-1h2v-1H6v-1H5zM10 15h6v1h-6z" />
      </>}
      {kind === "info" && <>
        <path fill="currentColor" fillRule="evenodd" d="M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4zM8 4v2H6v2H4v8h2v2h2v2h8v-2h2v-2h2V8h-2V6h-2V4z" />
        <path fill="currentColor" d="M11 6h2v2h-2zM10 10h3v7h1v1h-4v-1h1v-5h-1z" />
      </>}
      {kind === "settings" && <>
        <path fill="#5022c4" d="M9 1h6v3h2V3h2v2h2v2h-1v2h3v6h-3v2h1v2h-2v2h-2v-1h-2v3H9v-3H7v1H5v-2H3v-2h1v-2H1V9h3V7H3V5h2V3h2v1h2z" />
        <path fill="#ad8bd2" d="M8 5h8v1h2v2h1v8h-1v2h-2v1H8v-1H6v-2H5V8h1V6h2zM10 2h4v4h-4zM10 18h4v4h-4zM2 10h4v4H2zM18 10h4v4h-4zM5 4h2v1h1v3H5V7H4V5h1zM17 4h2v1h1v2h-1v1h-3V5h1zM5 16h3v3H7v1H5v-1H4v-2h1zM16 16h3v1h1v2h-1v1h-2v-1h-1z" />
        <path fill="#fff8ff" d="M10 2h4v1h-3v2h-1zM5 4h2v1H5zM4 5h1v2H4zM8 5h2v1H8zM6 6h2v1H7v1H6zM5 8h1v2H5zM2 10h3v1H3v3H2z" />
        <path fill="#7957aa" d="M19 10h3v4h-1v-3h-2zM18 14h1v2h-1zM17 16h1v2h-2v-1h1zM17 19h2v1h-2zM19 17h1v2h-1zM14 18h2v1h-2zM10 21h3v-2h1v3h-4z" />
        <path fill="#5022c4" d="M10 8h4v1h1v1h1v4h-1v1h-1v1h-4v-1H9v-1H8v-4h1V9h1z" />
        <path fill="#bff3f3" d="M10 9h4v1h1v4h-1v1h-4v-1H9v-4h1z" />
        <path fill="#fff8ff" d="M10 10h4v4h-4z" />
      </>}
      {kind === "folder" && <>
        <path fill="#5022c4" d="M2 5h8v2h12v14H2z" />
        <path fill="#eeabe7" d="M3 6h6v2h12v12H3z" />
        <path fill="#fff8ff" d="M3 8h18v1H4v10H3z" />
        <path fill="#bff3f3" d="M5 10h14v8H5z" />
      </>}
      {kind === "pdf" && <>
        <path fill="#5022c4" d="M5 2h14v20H5z" />
        <path fill="#fff8ff" d="M6 3h12v18H6z" />
        <path fill="#a2c8f1" d="M7 4h1v16H7zM8 20h9v1H8z" />
        <path fill="#eeabe7" d="M15 3h3v4h-3z" />
        <path fill="#942b54" d="M3 10h18v7H3z" />
        <path fill="#fff8ff" d="M5 11h3v3H6v2H5zM9 11h2v1h1v3h-1v1H9zM13 11h4v1h-3v1h2v1h-2v2h-1z" />
        <path fill="#942b54" d="M6 12h1v1H6zM10 12h1v3h-1z" />
      </>}
      {kind === "profile" && <path fill="#5022c4" d="M9 2h6v1h2v2h1v5h-1v2h-2v2h-1v2h3v1h2v2h2v3H3v-3h2v-2h2v-1h3v-2H9v-2H7v-2H6V5h1V3h2z" />}
      {kind === "game" && <>
        <path fill="#5022c4" d="M5 5h14v1h2v2h1v11h-1v1h-4v-2H7v2H3v-1H2V8h1V6h2z" />
        <path fill="#bff3f3" d="M5 6h14v1h2v11h-3v-2H6v2H3V8h2z" />
        <path fill="#fff8ff" d="M5 6h14v1H6v1H4v7H3V8h2z" />
        <path fill="#5022c4" d="M6 9h2v2h2v2H8v2H6v-2H4v-2h2zM10 15h4v1h-4z" />
        <path fill="#ed65be" d="M16 9h2v2h-2zM18 12h2v2h-2z" />
      </>}
      {kind === "tools" && <>
        <path fill="#5022c4" d="M6 2h3v5h6V2h3v8h-2v2h-2v9h-1v1h-2v-1h-1v-9H8v-2H6z" />
        <path fill="#bff3f3" d="M7 3h1v5h8V3h1v6h-2v2h-2v9h-2v-9H9V9H7z" />
        <path fill="#fff8ff" d="M7 3h1v5H7zM7 9h2v2H8v-1H7zM11 12h1v7h-1z" />
        <path fill="#eeabe7" d="M12 12h1v7h-1z" />
      </>}
      {kind === "document" && <>
        <path fill="#5022c4" d="M3 2h18v1h1v18h-1v1H3v-1H2V3h1z" />
        <path fill="#eeabe7" d="M3 3h18v18H3z" />
        <path fill="#fff8ff" d="M3 3h18v1H4v17H3z" />
        <path fill="#5022c4" d="M6 5h12v15H6z" />
        <path fill="#fff8ff" d="M7 6h10v13H7z" />
        <path fill="#a2c8f1" d="M8 7h8v2H8z" />
        <path fill="#5022c4" d="M8 11h8v1H8zM8 14h8v1H8zM8 17h5v1H8z" />
      </>}
      {kind === "mail" && <>
        <path fill="#5022c4" d="M3 5h18v1h1v13h-1v1H3v-1H2V6h1z" />
        <path fill="#bff3f3" d="M3 6h18v13H3z" />
        <path fill="#fff8ff" d="M3 6h18v1H4v11H3z" />
        <path fill="#eeabe7" d="M4 7h16v2h-2v2h-2v2H8v-2H6V9H4z" />
        <path fill="#5022c4" d="M3 6h2v2h2v2h2v2h6v-2h2V8h2V6h2v2h-2v2h-2v2h-2v2H9v-2H7v-2H5V8H3z" />
        <path fill="#a2c8f1" d="M4 17h16v1H4z" />
      </>}
      {kind === "system" && <>
        <path fill="#5022c4" d="M2 3h20v15h-7v2h3v2H6v-2h3v-2H2z" />
        <path fill="#eeabe7" d="M3 4h18v13H3z" />
        <path fill="#fff8ff" d="M4 5h16v11H4z" />
        <path fill="#a2c8f1" d="M5 6h6v4H5z" />
        <path fill="#ed65be" d="M13 6h6v4h-6z" />
        <path fill="#bff3f3" d="M5 11h6v4H5z" />
        <path fill="#c4a5ee" d="M13 11h6v4h-6z" />
        <path fill="#a2c8f1" d="M10 18h4v2h-4zM7 20h10v1H7z" />
      </>}
    </svg>
  );
}
