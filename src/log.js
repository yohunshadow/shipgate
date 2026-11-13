// Tiny zero-dependency terminal styling.
const tty = process.stderr.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const color = {
  dim: c(2), bold: c(1), red: c(31), green: c(32), yellow: c(33), blue: c(34), magenta: c(35), cyan: c(36), lime: c("38;5;191"),
};

let quiet = false;
export function setQuiet(v) { quiet = v; }

function out(line) { if (!quiet) process.stderr.write(line + "\n"); }

export const log = {
  banner(title) {
    out("");
    out(color.lime(color.bold("▌ship gate")) + color.dim("  ·  ") + title);
    out(color.dim("─".repeat(60)));
  },
  step(msg) { out(color.cyan("›") + " " + msg); },
  info(msg) { out(color.dim("  " + msg)); },
  ok(msg) { out(color.green("✔") + " " + msg); },
  warn(msg) { out(color.yellow("!") + " " + msg); },
  fail(msg) { out(color.red("✖") + " " + msg); },
  kane(msg) { out(color.magenta("  kane") + color.dim(" │ ") + msg); },
  agent(msg) { out(color.blue("  agent") + color.dim(" │ ") + msg); },
  raw(msg) { out(msg); },
};
