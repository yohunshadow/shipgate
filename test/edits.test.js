import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEdits, applyEdits } from "../src/agents/edits.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "sg-"));

test("applies SEARCH/REPLACE blocks, tolerant of indentation", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "a.js"), "function f() {\n    return 1 + '1';\n}\n");
  const edits = parseEdits("fix:\nFILE: a.js\n<<<<<<< SEARCH\nreturn 1 + '1';\n=======\nreturn 1 + 1;\n>>>>>>> REPLACE\n");
  const r = applyEdits(edits, d);
  assert.equal(r.applied.length, 1);
  assert.equal(fs.readFileSync(path.join(d, "a.js"), "utf8"), "function f() {\n    return 1 + 1;\n}\n");
});

test("falls back to whole-file answers", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "a.js"), "const x = 1;\nconst y = 2;\n");
  const r = applyEdits(parseEdits("FILE: a.js\n```js\nconst x = 1;\nconst y = 3;\n```"), d);
  assert.equal(r.applied.length, 1);
  assert.equal(fs.readFileSync(path.join(d, "a.js"), "utf8"), "const x = 1;\nconst y = 3;\n");
});

test("never lets the agent edit tests or escape the project", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "cart_test.md"), "## Step\nVerify $7.50\n");
  const r = applyEdits([
    { file: "cart_test.md", search: "Verify $7.50", replace: "Verify anything" },
    { file: "../evil.js", search: "", replace: "x" },
  ], d);
  assert.equal(r.applied.length, 0);
  assert.equal(r.rejected.length, 2);
});
