// Built-in agent: any OpenAI-compatible chat endpoint (Ollama, LM Studio, vLLM,
// OpenAI, Groq, OpenRouter, ...). Reads the project sources, gets the Kane
// re-prompt, answers with SEARCH/REPLACE blocks that Ship Gate applies.
import fs from "node:fs";
import path from "node:path";
import { parseEdits, applyEdits } from "./edits.js";
import { log } from "../log.js";

const TEXT_EXT = new Set([".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".json", ".vue", ".svelte", ".py", ".md"]);

export function collectSources(cfg, limitBytes = 60000) {
  const base = path.resolve(cfg.root, cfg.agent.include || (cfg.preview && cfg.preview.static) || ".");
  const files = [];
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name.startsWith("output-") || e.name === "dist") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (TEXT_EXT.has(path.extname(e.name)) && !e.name.endsWith("_test.md") && e.name !== "package-lock.json") {
        const body = fs.readFileSync(p, "utf8");
        if (total + body.length > limitBytes) continue;
        total += body.length;
        files.push({ rel: path.relative(cfg.root, p), body });
      }
    }
  };
  walk(base);
  return files;
}

const SYSTEM = `You are a senior engineer fixing a web app so that its end-to-end tests pass.
Kane CLI (an AI browser tester) ran the user flows and reported a failure. Find the real root cause in the code and fix it.
Never edit *_test.md files and never hard-code expected values.

Reply with a one-sentence diagnosis, then one or more edit blocks in EXACTLY this format:

FILE: relative/path/to/file.js
<<<<<<< SEARCH
exact lines copied from the current file
=======
the replacement lines
>>>>>>> REPLACE

SEARCH must match the current file text exactly (copy it). Keep edits minimal.`;

export async function builtinFix(cfg, repromptMd, { attemptDir }) {
  const base = (process.env.SHIPGATE_LLM_BASE_URL || cfg.agent.baseUrl || "http://localhost:11434/v1").replace(/\/$/, "");
  const model = process.env.SHIPGATE_LLM_MODEL || cfg.agent.model || "qwen2.5-coder:7b";
  const key = process.env.SHIPGATE_LLM_API_KEY || process.env.OPENAI_API_KEY || "ollama";
  const files = collectSources(cfg);
  const user = `${repromptMd}\n\n---\n\n# Project files\n\n` + files.map((f) => `FILE: ${f.rel}\n\`\`\`\n${f.body}\n\`\`\``).join("\n\n");
  log.agent(`builtin → ${model} @ ${base.replace(/\/\/[^@]*@/, "//")} (${files.length} files in context)`);
  const t0 = Date.now();
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`LLM endpoint answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || "";
  fs.writeFileSync(path.join(attemptDir, "agent-prompt.md"), `<!-- system -->\n${SYSTEM}\n\n<!-- user -->\n${user}`);
  fs.writeFileSync(path.join(attemptDir, "agent-response.md"), text);
  const edits = parseEdits(text);
  const { applied, rejected } = applyEdits(edits, cfg.root);
  const diagnosis = text.split("\n").find((l) => l.trim() && !l.startsWith("FILE:")) || "";
  log.agent(`${((Date.now() - t0) / 1000).toFixed(1)}s · ${diagnosis.slice(0, 120)}`);
  for (const e of applied) log.agent(`edited ${e.file}`);
  for (const e of rejected) log.agent(`rejected edit to ${e.file}: ${e.why}`);
  return { agent: `builtin:${model}`, applied: applied.length, rejected: rejected.length, diagnosis, usage: data.usage };
}
