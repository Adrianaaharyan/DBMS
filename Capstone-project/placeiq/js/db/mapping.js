/**
 * Pure translation between the app's state (store.D) and database rows. No DOM, no network,
 * so it is unit-tested in Node. Column names are snake_case in the database, camelCase in the app.
 *
 * Every table lists its primary-key columns; the sync code uses them to work out what changed.
 */

export const TABLES = {
  students: { pk: ["id"] },
  drives: { pk: ["id"] },
  applications: { pk: ["student_id", "drive_id"] },
  notif_read: { pk: ["student_id", "alert_id"] },
  prep_done: { pk: ["student_id", "drive_id", "step_id"] },
  app_settings: { pk: ["key"] },
};

/** Parents before children when writing; the reverse when deleting. */
export const WRITE_ORDER = ["students", "drives", "applications", "notif_read", "prep_done", "app_settings"];
export const DELETE_ORDER = ["prep_done", "notif_read", "applications", "drives", "students", "app_settings"];

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** App state to rows, with a fixed key order so rows compare equal as JSON strings. */
export function toRows(D) {
  const notif_read = [];
  Object.keys(D.notifRead || {}).forEach((sid) => {
    (D.notifRead[sid] || []).forEach((alert_id) => notif_read.push({ student_id: sid, alert_id }));
  });
  const prep_done = [];
  Object.keys(D.prepDone || {}).forEach((key) => {
    const i = key.indexOf("|");
    (D.prepDone[key] || []).forEach((step_id) => prep_done.push({ student_id: key.slice(0, i), drive_id: key.slice(i + 1), step_id }));
  });
  return {
    students: D.students.map((s) => ({
      id: s.id,
      name: s.name,
      roll: s.roll || "",
      branch: s.branch,
      cgpa: num(s.cgpa),
      backlogs: num(s.backlogs),
      skills: s.skills || [],
      aptitude: num(s.aptitude),
      projects: num(s.projects),
      internships: num(s.internships),
    })),
    drives: D.drives.map((d) => ({
      id: d.id,
      company: d.company,
      role: d.role,
      ctc: num(d.ctc),
      min_cgpa: num(d.minCgpa),
      max_back: num(d.maxBack),
      branches: d.branches || [],
      skills: d.skills || [],
      drive_date: d.date,
      status: d.status,
    })),
    applications: D.apps.map((a) => ({ student_id: a.sid, drive_id: a.did, stage: a.stage })),
    notif_read,
    prep_done,
    app_settings: D.source ? [{ key: "source", value: D.source }] : [],
  };
}

/** Rows to app state. Rows may be in any order; ids like "s12" and "d3" sort numerically. */
export function fromRows(rows) {
  const byId = (a, b) => (parseInt(String(a.id).replace(/\D/g, ""), 10) || 0) - (parseInt(String(b.id).replace(/\D/g, ""), 10) || 0);
  const D = {
    source: null,
    students: (rows.students || []).slice().sort(byId).map((r) => ({
      id: r.id,
      name: r.name,
      roll: r.roll,
      branch: r.branch,
      cgpa: num(r.cgpa),
      backlogs: num(r.backlogs),
      skills: r.skills || [],
      aptitude: num(r.aptitude),
      projects: num(r.projects),
      internships: num(r.internships),
    })),
    drives: (rows.drives || []).slice().sort(byId).map((r) => ({
      id: r.id,
      company: r.company,
      role: r.role,
      ctc: num(r.ctc),
      minCgpa: num(r.min_cgpa),
      maxBack: num(r.max_back),
      branches: r.branches || [],
      skills: r.skills || [],
      date: String(r.drive_date).slice(0, 10),
      status: r.status,
    })),
    apps: (rows.applications || []).slice().sort((a, b) => String(a.student_id).localeCompare(String(b.student_id), undefined, { numeric: true }) || String(a.drive_id).localeCompare(String(b.drive_id), undefined, { numeric: true })).map((r) => ({ sid: r.student_id, did: r.drive_id, stage: r.stage })),
    notifRead: {},
    prepDone: {},
  };
  (rows.notif_read || []).forEach((r) => {
    (D.notifRead[r.student_id] = D.notifRead[r.student_id] || []).push(r.alert_id);
  });
  (rows.prep_done || []).forEach((r) => {
    const k = r.student_id + "|" + r.drive_id;
    (D.prepDone[k] = D.prepDone[k] || []).push(r.step_id);
  });
  const src = (rows.app_settings || []).find((r) => r.key === "source");
  D.source = src ? src.value : D.students.length || D.drives.length ? "imported" : null;
  return D;
}

export function rowKey(table, row) {
  return TABLES[table].pk.map((c) => String(row[c])).join("\u0001");
}

/** What to send so the database matches `next`, given the rows it is known to hold (`prev`). */
export function diffRows(table, prev, next) {
  const before = new Map(prev.map((r) => [rowKey(table, r), JSON.stringify(r)]));
  const upserts = [];
  const seen = new Set();
  next.forEach((r) => {
    const k = rowKey(table, r);
    seen.add(k);
    if (before.get(k) !== JSON.stringify(r)) upserts.push(r);
  });
  const deletes = prev.filter((r) => !seen.has(rowKey(table, r)));
  return { upserts, deletes };
}
