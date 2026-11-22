/** Entry point: connect to the database, load the records, wire events and routing, draw the first view. */
import { store } from "./core/store.js";
import { initEvents } from "./events.js";
import { route, render } from "./app.js";
import { isConfigured } from "./env.js";
import { loadFromDb, onStatus, hasPending, changeCount, retry } from "./db/sync.js";
import { esc, $ } from "./ui/dom.js";

const view = () => $("#view");

let ready = false;

function panel(title, body) {
  view().innerHTML = '<div class="panel setup" style="margin-top:14px"><h2>' + title + "</h2>" + body + "</div>";
}

function showSetup() {
  panel(
    "Connect the database",
    '<div class="sub">PlaceIQ stores its records in a Supabase (PostgreSQL) database. It has not been connected yet.</div><ol>' +
      "<li>Create a free project at supabase.com.</li>" +
      "<li>Open <b>SQL Editor</b>, paste the contents of <code>db/schema.sql</code> and run it.</li>" +
      "<li>Open <b>Project Settings &gt; API</b> and copy the Project URL and the <code>anon public</code> key.</li>" +
      "<li>Paste both into <code>js/env.js</code>, commit and push. Vercel redeploys on its own.</li></ol>" +
      '<div class="sub" style="margin-top:8px">Full steps with screenshots of where to click: <code>docs/SUPABASE_SETUP.md</code>.</div>'
  );
}

function showError(message) {
  panel(
    "Could not load the records",
    '<div class="sub" style="color:var(--bad)">' + esc(message) + '</div><div style="margin-top:12px"><button class="btn pri" id="reload-db">Try again</button></div>'
  );
  $("#reload-db").addEventListener("click", start);
}

function setStatus(state, message) {
  const el = $("#dbstatus");
  if (!el) return;
  el.classList.toggle("err", state === "error");
  if (state === "saving") el.textContent = "Saving…";
  else if (state === "saved") el.textContent = "All changes saved to the database";
  else el.innerHTML = "Not saved: " + esc(message || "unknown error") + ' <button class="btn sm" id="retry-save">Retry</button>';
  if (state === "error") $("#retry-save").addEventListener("click", retry);
}

async function start() {
  if (!isConfigured()) return showSetup();
  view().innerHTML = '<div class="panel" style="margin-top:14px"><div class="sub" role="status">Loading records from the database…</div></div>';
  try {
    store.D = await loadFromDb();
  } catch (e) {
    return showError(e.message);
  }
  ready = true;
  route();
}

initEvents();
onStatus(setStatus);
window.addEventListener("hashchange", () => {
  if (ready) route();
});
window.addEventListener("beforeunload", (e) => {
  if (hasPending()) e.preventDefault(); // a save is still in flight
});
// Pick up other people's changes when the tab comes back into view, unless the user has edited since.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !ready || hasPending()) return;
  const seen = changeCount();
  try {
    const D = await loadFromDb();
    if (changeCount() === seen && !hasPending()) {
      store.D = D;
      render();
    }
  } catch (e) {
    /* offline: keep what is on screen */
  }
});
start();
