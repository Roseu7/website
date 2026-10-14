export const CONSOLE_COMMAND_LIMIT = 512;

export type ConsoleShell = {
  cwd: string;
  env: Record<string, string>;
  errorlevel: number;
  echo: boolean;
  pending?: { command: string; question: string };
};

export function createConsoleShell(): ConsoleShell {
  const home = "C:\\Users\\Guest";
  return { cwd: home, errorlevel: 0, echo: true, env: {
    USERNAME: "Guest", USERPROFILE: home, HOMEDRIVE: "C:", HOMEPATH: "\\Users\\Guest", SYSTEMDRIVE: "C:", SYSTEMROOT: "C:\\ROS3U",
    COMSPEC: "C:\\ROS3U\\System32\\console.exe", PATH: "C:\\ROS3U\\System32;C:\\Apps", TEMP: home + "\\Temp", TMP: home + "\\Temp",
  } };
}

export function expandConsole(input: string, shell: ConsoleShell) {
  return input.replace(/%([^%]+)%/g, (whole, name: string) => {
    const key = name.toUpperCase();
    if (Object.hasOwn(shell.env, key)) return shell.env[key];
    return key === "CD" ? shell.cwd : key === "ERRORLEVEL" ? String(shell.errorlevel) : whole;
  });
}

// A single file-independent command is safe locally. Expanded operators and pending confirmations stay on the server.
export function executeLocalConsole(input: string, shells: ConsoleShell[], version: string): ConsoleReply | null {
  const shell = shells[shells.length - 1];
  if (shell.pending || /[&|<>^]/.test(input)) return null;
  const expanded = expandConsole(input, shell);
  if (/[&|<>^]/.test(expanded)) return null;
  const match = /^("[^"]+"|[^\s]+)(?:\s+([\s\S]*))?$/.exec(expanded.trimStart());
  if (!match) return null;
  const name = match[1].replaceAll('"', "").toLowerCase(), args = match[2] ?? "";
  if (!["set", "cls", "echo", "echo.", "ver", "exit"].includes(name)) return null;
  if (input.length > CONSOLE_COMMAND_LIMIT || expanded.length > 4096) {
    shell.errorlevel = 1;
    return { cwd: shell.cwd, output: "The input line is too long." };
  }
  return executeConsoleBuiltin(name, args, shells, version);
}

export function executeConsoleBuiltin(name: string, args: string, shells: ConsoleShell[], version: string): ConsoleReply | null {
  if (!["set", "cls", "echo", "echo.", "ver", "exit"].includes(name)) return null;
  const shell = shells[shells.length - 1], before = structuredClone(shells);
  let output = "", code = 0, effect: ConsoleReply["effect"];
  try {
    if (name === "echo.") output = args;
    else if (args.trim() === "/?") {
      output = { set: "SET [variable=[string]]  Displays, sets, or removes environment variables.", cls: "CLS                 Clears the screen.",
        echo: "ECHO [ON | OFF] [text]  Displays messages or changes command echoing.", ver: "VER                 Displays the OS version.",
        exit: "EXIT                Closes the current command interpreter." }[name] ?? args;
    } else if (name === "set") {
      if (args.startsWith("/")) throw Error("Invalid switch - " + args.split(/\s/)[0]);
      const equal = args.indexOf("=");
      if (equal >= 0) {
        const variable = args.slice(0, equal).toUpperCase(), value = args.slice(equal + 1);
        if (!variable || /[\x00-\x1f]/.test(variable)) throw Error("The syntax of the command is incorrect.");
        if (value) Object.defineProperty(shell.env, variable, { value, writable: true, enumerable: true, configurable: true });
        else delete shell.env[variable];
      } else {
        const entries = Object.entries(shell.env).filter(([variable]) => variable.startsWith(args.toUpperCase())).sort(([a], [b]) => a.localeCompare(b, "en"));
        output = entries.length ? entries.map(([key, value]) => `${key}=${value}`).join("\r\n") : args ? `Environment variable ${args} not defined` : "";
        code = entries.length || !args ? 0 : 1;
      }
    } else if (name === "echo" || name === "echo.") {
      if (name === "echo.") output = args;
      else if (/^(on|off)$/i.test(args.trim())) shell.echo = args.trim().toLowerCase() === "on";
      else output = args || `ECHO is ${shell.echo ? "on" : "off"}.`;
    } else {
      if (args.trim()) throw Error("The syntax of the command is incorrect.");
      if (name === "ver") output = version;
      if (name === "cls") effect = "clear";
      if (name === "exit") {
        code = shell.errorlevel;
        if (shells.length > 1) shells.pop();
        else effect = "exit";
      }
    }
    if (shells.some(item => Object.keys(item.env).length > 64 || JSON.stringify(item.env).length > 8192)) throw Error("There is not enough space on the disk.");
  } catch (cause) {
    shells.splice(0, shells.length, ...before);
    output = cause instanceof Error ? cause.message : "The syntax of the command is incorrect.";
    code = 1;
  }
  shells[shells.length - 1].errorlevel = code;
  return { cwd: shells[shells.length - 1].cwd, output, ...(effect ? { effect } : {}) };
}

export type ConsoleReply = {
  cwd: string;
  output: string;
  effect?: "clear" | "exit";
  launch?: string;
};

export type ConsoleCompletion = {
  start: number;
  end: number;
  candidates: string[];
};
