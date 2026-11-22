import { test } from "node:test";
import assert from "node:assert/strict";
import { toRows, fromRows, diffRows, rowKey, TABLES } from "../../js/db/mapping.js";
import { buildSample } from "../../js/core/sample.js";
import { isConfigured } from "../../js/env.js";

const TODAY = "2026-11-10";

test("rows: state to rows and back is lossless", () => {
  const D = buildSample(undefined, TODAY);
  D.notifRead = { s1: ["offer:d1", "drive:d11:Applied:3"] };
  D.prepDone = { "s1|d11": ["apply", "skill:Python"] };
  const back = fromRows(toRows(D));
  assert.deepEqual(back.students, D.students);
  assert.deepEqual(back.drives, D.drives);
  assert.deepEqual(back.notifRead, D.notifRead);
  assert.deepEqual(back.prepDone, D.prepDone);
  assert.equal(back.source, "sample");
  const key = (a) => a.sid + "|" + a.did;
  assert.deepEqual(back.apps.map(key).sort(), D.apps.map(key).sort());
  assert.equal(back.apps.length, D.apps.length);
});

test("rows: column names match db/schema.sql", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");
  const rows = toRows(buildSample(undefined, TODAY));
  rows.notif_read.push({ student_id: "s1", alert_id: "a" });
  rows.prep_done.push({ student_id: "s1", drive_id: "d1", step_id: "x" });
  Object.keys(TABLES).forEach((t) => {
    const block = sql.split("create table if not exists " + t + " (")[1].split(");")[0];
    assert.ok(rows[t].length, t + " has rows to check");
    Object.keys(rows[t][0]).forEach((col) => assert.ok(new RegExp("\\b" + col + "\\b").test(block), t + "." + col + " missing from schema.sql"));
  });
});

test("rows: empty database gives empty state and no source", () => {
  const D = fromRows({});
  assert.deepEqual([D.students, D.drives, D.apps, D.source], [[], [], [], null]);
});

test("diff: only changed, new and removed rows are reported", () => {
  const D = buildSample(undefined, TODAY);
  const before = toRows(D);
  assert.deepEqual(diffRows("students", before.students, toRows(D).students), { upserts: [], deletes: [] });

  D.students[0].aptitude = 99;
  D.students.pop();
  D.apps[0].stage = "Offered";
  D.apps.push({ sid: "s1", did: "d20", stage: "Applied" });
  const after = toRows(D);
  const s = diffRows("students", before.students, after.students);
  assert.equal(s.upserts.length, 1);
  assert.equal(s.upserts[0].aptitude, 99);
  assert.equal(s.deletes.length, 1);
  const a = diffRows("applications", before.applications, after.applications);
  assert.ok(a.upserts.some((r) => r.drive_id === "d20"));
  assert.equal(rowKey("applications", a.upserts[0]).split("\u0001").length, 2);
});

test("diff: unticking a prep step deletes exactly that row", () => {
  const D = buildSample(undefined, TODAY);
  D.prepDone = { "s1|d11": ["apply", "research"] };
  const before = toRows(D);
  D.prepDone["s1|d11"] = ["apply"];
  const d = diffRows("prep_done", before.prep_done, toRows(D).prep_done);
  assert.deepEqual(d.deletes, [{ student_id: "s1", drive_id: "d11", step_id: "research" }]);
  assert.equal(d.upserts.length, 0);
});

test("env: placeholders count as not configured", () => {
  assert.equal(isConfigured({ url: "https://YOUR-PROJECT-ID.supabase.co", key: "YOUR-ANON-PUBLIC-KEY" }), false);
  assert.equal(isConfigured({ url: "", key: "" }), false);
  assert.equal(isConfigured({ url: "https://abcdefgh.supabase.co", key: "eyJhbGciOiJIUzI1NiJ9.example" }), true);
});
