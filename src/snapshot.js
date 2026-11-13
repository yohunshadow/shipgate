// Content fingerprint + before/after diffs of the files the agent may touch.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { collectSources } from "./agents/builtin.js";

export function fingerprint(cfg) {
  const h = crypto.createHash("sha256");
  for (const f of collectSources(cfg, Infinity).sort((a, b) => a.rel.localeCompare(b.rel))) h.update(f.rel + "\0" + f.body + "\0");
  return h.digest("hex").slice(0, 16);
}

export function snapshot(cfg) {
  return new Map(collectSources(cfg, Infinity).map((f) => [f.rel, f.body]));
}

/** Unified diff between a snapshot and the current tree. */
export function diffSince(cfg, before) {
  const now = snapshot(cfg);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shipgate-"));
  let out = "";
  for (const rel of new Set([...before.keys(), ...now.keys()])) {
    const a = before.get(rel) ?? "";
    const b = now.get(rel) ?? "";
    if (a === b) continue;
    const pa = path.join(tmp, "a"); const pb = path.join(tmp, "b");
    fs.writeFileSync(pa, a); fs.writeFileSync(pb, b);
    const r = spawnSync("git", ["diff", "--no-index", "--no-color", "--", pa, pb], { encoding: "utf8" });
    out += (r.stdout || "").replaceAll(`a${pa}`, `a/${rel}`).replaceAll(`b${pb}`, `b/${rel}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
