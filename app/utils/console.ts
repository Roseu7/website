export const CONSOLE_COMMAND_LIMIT = 512;

export type ConsoleReply = {
  cwd: string;
  output: string;
  effect?: "clear" | "exit";
};
