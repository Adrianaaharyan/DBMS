# Connecting the database (Supabase)

PlaceIQ keeps its records in a free Supabase project (PostgreSQL). The browser talks to it directly; there is no server of your own to run. Setup takes about ten minutes and is done once.

## 1. Create the project
1. Sign up at https://supabase.com and choose **New project**.
2. Name it (for example `placeiq`), set a database password (save it somewhere), pick the region nearest you (for India, Mumbai or Singapore), and wait about two minutes for it to start.

## 2. Create the tables
1. In the left menu open **SQL Editor** and choose **New query**.
2. Open `db/schema.sql` from this repository, copy everything, paste it into the editor and press **Run**. You should see "Success. No rows returned".
3. Open **Table Editor**. You should see six tables: `students`, `drives`, `applications`, `notif_read`, `prep_done` and `app_settings`.

The script can be run again safely.

## 3. Give the app the connection details
1. Go to **Project Settings > API**.
2. Copy the **Project URL** and the key labelled **anon** / **public**.
3. Paste them into `js/env.js`:
   ```js
   url: "https://abcdefghijkl.supabase.co",
   key: "eyJhbGciOi...",
   ```
4. Commit and push. Vercel redeploys by itself.

The anon key is meant to be public. **Never** paste the `service_role` key anywhere in this project.

## 4. First run
Open the site. The database is empty, so the app shows **"The database is connected and empty"** with a **Load sample data** button. Press it to write the 120 sample students, 20 drives and their applications into your database (check in Table Editor). From then on, every change (applying, changing a stage, ticking a prep step, reading an alert, importing a CSV, adding a drive) is saved to the database within a second; the header shows "All changes saved to the database". Another person opening the site sees the same records.

Run locally with `npm start`; it uses the same database as the deployed site.

## If something goes wrong
| What you see | Cause and fix |
|---|---|
| "Connect the database" panel | `js/env.js` still has the placeholders. Paste your URL and anon key and redeploy. |
| "The tables do not exist yet" | `db/schema.sql` was not run, or was run in a different project. |
| "The database refused the key" | Wrong or truncated anon key, or the policies from `schema.sql` did not apply. Run the script again. |
| "Cannot reach the database" | No internet, or a wrong Project URL. |
| "Not saved: ..." with a Retry button | A save failed. Your change is kept on the page; press Retry once the cause is fixed. Do not close the tab until it says saved. |
| Free project stopped | Supabase pauses free projects after about a week without activity. Open the dashboard and press **Restore**. |

## Before using real data
**There is no sign-in, so the database is open.** The policies in `db/schema.sql` allow anyone who has your site address (and can therefore read the anon key in `js/env.js`) to read, change or delete every record through Supabase's public API. That is acceptable for a demo with generated sample data. It is **not** acceptable for real students' names, roll numbers and CGPAs.

Before loading real records:
1. Turn on Supabase Auth (email or Google sign-in) and add a sign-in screen.
2. Add a `role` for each user (student or placement officer) and a link from a user to a student row.
3. Replace the open policies with role-based ones, for example: a student may read drives, and read and update only their own rows in `students`, `applications`, `notif_read` and `prep_done`; officers may read and write everything.
4. Remove the "Replace all records with sample data" button for non-officers, since it overwrites every record.

Student-facing alerts are still shown inside the app only. Sending them by email, WhatsApp or push needs a server-side job (for example a Supabase Edge Function on a schedule).
