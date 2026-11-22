/**
 * Application state.
 *   store.D  - data: { source, students[], drives[], apps[], notifRead{}, prepDone{} }
 *   store.UI - view state: current tab, selections, filters, the running quiz round
 *
 * store.D lives in memory and is mirrored to the Supabase database. Code changes store.D and
 * calls saveState(); js/db/sync.js works out what changed and sends only that.
 * Loading happens once at start-up in main.js (loadFromDb).
 */
import { buildSample } from "./sample.js";
import { scheduleSync } from "../db/sync.js";

export function createUiState() {
  return {
    view: "dashboard",
    portalSid: null,
    selS: null,
    selD: null,
    sq: "",
    sb: "All",
    ss: "All",
    dq: "",
    ds: "All",
    quiz: null,
    practiceSid: null,
    /** Student portal: demo date override (null = real today), open prep plan ("closed" hides it), alert list expanded. */
    today: null,
    prepDid: null,
    notifAll: false,
  };
}

export function emptyData() {
  return { source: null, students: [], drives: [], apps: [], notifRead: {}, prepDone: {} };
}

export const store = { D: emptyData(), UI: createUiState() };

/** Call after changing store.D: the change is sent to the database a moment later. */
export function saveState() {
  scheduleSync(() => store.D);
}

/** Replace every record, in the database too, with a freshly generated sample cohort. */
export function resetToSample() {
  store.D = buildSample();
  store.UI.selS = null;
  store.UI.selD = null;
  store.UI.prepDid = null;
  saveState();
}
