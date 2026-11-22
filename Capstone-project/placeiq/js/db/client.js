/**
 * Minimal Supabase client: talks to the PostgREST API with fetch, so there is no library to
 * install, bundle or keep up to date. Only the four calls the app needs.
 */
import { ENV } from "../env.js";
import { TABLES } from "./mapping.js";

const PAGE = 1000; // Supabase returns at most 1000 rows per request
const CHUNK = 400; // rows per write request

function headers(extra) {
  return Object.assign({ apikey: ENV.key, Authorization: "Bearer " + ENV.key, "Content-Type": "application/json" }, extra);
}

async function call(method, path, body, extra) {
  let res;
  try {
    res = await fetch(ENV.url.replace(/\/$/, "") + "/rest/v1/" + path, { method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new Error("Cannot reach the database. Check your internet connection and the URL in js/env.js.");
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j.message || j.hint || "";
    } catch (e) {
      /* no JSON body */
    }
    if (res.status === 404 && /relation|schema cache|Could not find/i.test(msg)) msg = "The tables do not exist yet. Run db/schema.sql in the Supabase SQL Editor.";
    if (res.status === 401 || res.status === 403) msg = msg || "The database refused the key. Check the anon key in js/env.js and the policies from db/schema.sql.";
    throw new Error(msg || "Database error " + res.status);
  }
  return res;
}

const quote = (v) => '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

/** All rows of a table, fetched page by page. */
export async function selectAll(table) {
  const order = TABLES[table].pk.join(",");
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await call("GET", table + "?select=*&order=" + order + "&limit=" + PAGE + "&offset=" + offset);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Insert or update rows by primary key. */
export async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await call("POST", table + "?on_conflict=" + TABLES[table].pk.join(","), rows.slice(i, i + CHUNK), { Prefer: "resolution=merge-duplicates,return=minimal" });
  }
}

/** Delete rows by primary key. Rows are grouped so one request removes many: all but the last key column are matched with eq, the last with in(...). */
export async function remove(table, rows) {
  const pk = TABLES[table].pk;
  const prefixCols = pk.slice(0, -1);
  const last = pk[pk.length - 1];
  const groups = new Map();
  rows.forEach((r) => {
    const g = prefixCols.map((c) => r[c]).join("\u0001");
    if (!groups.has(g)) groups.set(g, { prefix: prefixCols.map((c) => c + "=eq." + encodeURIComponent(r[c])), values: [] });
    groups.get(g).values.push(r[last]);
  });
  for (const g of groups.values()) {
    for (let i = 0; i < g.values.length; i += 100) {
      const list = g.values.slice(i, i + 100).map(quote).join(",");
      const q = g.prefix.concat(last + "=in.(" + encodeURIComponent(list) + ")").join("&");
      await call("DELETE", table + "?" + q, undefined, { Prefer: "return=minimal" });
    }
  }
}
