/**
 * Keeps the database and store.D in step.
 *   loadFromDb()      read every table and build the state object
 *   scheduleSync(fn)  called after any change: after a short pause, work out what differs from the
 *                     last known database contents and send only that (inserts, updates, deletes)
 * The app code never calls the database itself; it just changes store.D and calls saveState().
 */
import { selectAll, upsert, remove } from "./client.js";
import { TABLES, WRITE_ORDER, DELETE_ORDER, toRows, fromRows, diffRows } from "./mapping.js";

let snapshot = null; // rows the database is known to hold, in the same shape toRows() produces
let getData = null;
let timer = null;
let running = false;
let dirty = false;
let changes = 0; // bumps on every local change, so a slow reload never overwrites newer edits
let notify = () => {};

export function onStatus(fn) {
  notify = fn;
}

export function hasPending() {
  return dirty || running;
}

export function changeCount() {
  return changes;
}

export async function loadFromDb() {
  const rows = {};
  for (const t of Object.keys(TABLES)) rows[t] = await selectAll(t);
  const D = fromRows(rows);
  snapshot = toRows(D); // normalised the same way as local rows, so unchanged rows compare equal
  return D;
}

export function scheduleSync(getter) {
  getData = getter;
  dirty = true;
  changes++;
  notify("saving");
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

export async function flush() {
  if (running || !dirty || !snapshot) return;
  running = true;
  try {
    while (dirty) {
      dirty = false;
      const next = toRows(getData());
      const plan = {};
      WRITE_ORDER.forEach((t) => (plan[t] = diffRows(t, snapshot[t], next[t])));
      for (const t of DELETE_ORDER) if (plan[t].deletes.length) await remove(t, plan[t].deletes);
      for (const t of WRITE_ORDER) if (plan[t].upserts.length) await upsert(t, plan[t].upserts);
      snapshot = next;
    }
    notify("saved");
  } catch (e) {
    dirty = true; // keep the change; the next edit (or Retry) sends it again
    notify("error", e.message);
  } finally {
    running = false;
  }
}

/** Try again after a failed save. */
export function retry() {
  dirty = true;
  notify("saving");
  return flush();
}
