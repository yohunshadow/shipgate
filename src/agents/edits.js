// SEARCH/REPLACE edit blocks: the patch format the built-in agent asks the model for.
import fs from "node:fs";
import path from "node:path";

const BLOCK = /FILE:\s*(\S+)\s*\n+(?:```[\w-]*\n)?<{5,}\s*SEARCH\s*\n([\s\S]*?)\n={5,}\s*\n([\s\S]*?)\n?>{5,}\s*REPLACE/g;

export function parseEdits(text) {
  const edits = [];
  let m;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(text))) edits.push({ file: m[1].replace(/^[`'"]|[`'"]$/g, ""), search: m[2], replace: m[3] });
  if (edits.length) return edits;
  // Fallback: models often answer "FILE: path" + a fenced full file instead.
  const WHOLE = /FILE:\s*(\S+)\s*\n+```[\w-]*\n([\s\S]*?)\n```/g;
  while ((m = WHOLE.exec(text))) edits.push({ file: m[1].replace(/^[`'"]|[`'"]$/g, ""), whole: m[2].replace(/\s*$/, "\n") });
  return edits;
}

function fuzzyReplace(src, search, replace) {
  if (src.includes(search)) return src.replace(search, () => replace);
  // Whitespace-tolerant: match line by line ignoring indentation / trailing spaces.
  const norm = (s) => s.trim().replace(/\s+/g, " ");
  const srcLines = src.split("\n");
  const want = search.split("\n").map(norm).filter((l, i, a) => !(l === "" && (i === 0 || i === a.length - 1)));
  for (let i = 0; i + want.length <= srcLines.length; i++) {
    let ok = true;
    for (let j = 0; j < want.length; j++) if (norm(srcLines[i + j]) !== want[j]) { ok = false; break; }
    if (ok) {
      const indent = (srcLines[i].match(/^\s*/) || [""])[0];
      const repl = replace.split("\n").map((l, k) => (k === 0 || !l.trim() ? l : l)).join("\n");
      const firstIndent = (replace.split("\n")[0].match(/^\s*/) || [""])[0];
      const reindented = firstIndent === "" && indent ? repl.split("\n").map((l) => (l.trim() ? indent + l : l)).join("\n") : repl;
      return [...srcLines.slice(0, i), reindented, ...srcLines.slice(i + want.length)].join("\n");
    }
  }
  return null;
}

/** Apply edits inside root. Refuses to touch *_test.md or paths outside root. */
export function applyEdits(edits, root, { protect = [/_test\.md$/] } = {}) {
  const applied = [];
  const rejected = [];
  for (const e of edits) {
    const abs = path.resolve(root, e.file);
    if (!abs.startsWith(path.resolve(root) + path.sep)) { rejected.push({ ...e, why: "outside project" }); continue; }
    if (protect.some((re) => re.test(abs))) { rejected.push({ ...e, why: "tests are read-only for the agent" }); continue; }
    if (!fs.existsSync(abs)) {
      if (e.whole != null) { rejected.push({ ...e, why: "file not found" }); continue; }
      if (e.search.trim() === "") { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, e.replace); applied.push(e); }
      else rejected.push({ ...e, why: "file not found" });
      continue;
    }
    const src = fs.readFileSync(abs, "utf8");
    if (e.whole != null) {
      if (e.whole.trim().length < src.trim().length * 0.5) { rejected.push({ ...e, why: "full-file rewrite looks truncated" }); continue; }
      fs.writeFileSync(abs, e.whole); applied.push(e); continue;
    }
    const out = fuzzyReplace(src, e.search, e.replace);
    if (out == null) { rejected.push({ ...e, why: "SEARCH text not found" }); continue; }
    fs.writeFileSync(abs, out);
    applied.push(e);
  }
  return { applied, rejected };
}
