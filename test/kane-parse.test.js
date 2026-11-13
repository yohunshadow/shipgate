import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseTestmdEvents } from "../src/kane.js";

const load = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));

test("parses a real failed Kane testmd run (wrong app on the port)", () => {
  const r = parseTestmdEvents(load("wrong-target.ndjson"), "order_total_test.md");
  assert.equal(r.status, "failed");
  assert.equal(r.failedStep.heading, "Open the menu");
  assert.equal(r.runEnd.reasonCode, "assertion_error.step_not_achievable");
  assert.ok(r.credits > 0);
  assert.match(r.shareUrl, /^https:\/\/test-manager\.lambdatest\.com\//);
  assert.equal(r.bug.category, "config_issue");
});
