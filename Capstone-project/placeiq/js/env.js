/**
 * Supabase connection settings. Fill in the two values from your Supabase project:
 *   Project Settings > API > Project URL, and the "anon" "public" key.
 * The anon key is meant to be public (it ships to every browser). NEVER put the
 * "service_role" key here: it bypasses all security.
 *
 * Tests and previews can set window.PLACEIQ_ENV = { url, key } before the app loads instead.
 */
const FROM_PAGE = typeof window !== "undefined" ? window.PLACEIQ_ENV : null;

export const ENV = FROM_PAGE || {
  url: "https://YOUR-PROJECT-ID.supabase.co",
  key: "YOUR-ANON-PUBLIC-KEY",
};

export function isConfigured(env = ENV) {
  if (!env.url || !env.key || /YOUR-/i.test(env.url + env.key)) return false;
  return /^https?:\/\//i.test(env.url);
}
