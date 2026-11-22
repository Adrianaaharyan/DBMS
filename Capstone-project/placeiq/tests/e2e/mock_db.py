"""
A tiny in-memory stand-in for the Supabase REST API (PostgREST), used by the browser test so it
needs no real project, account or network. It implements only what PlaceIQ calls:
GET (with limit/offset), POST upsert (on_conflict) and DELETE with eq / in(...) filters.
"""
import json
import re
from urllib.parse import urlparse, parse_qs

PK = {
    "students": ["id"],
    "drives": ["id"],
    "applications": ["student_id", "drive_id"],
    "notif_read": ["student_id", "alert_id"],
    "prep_done": ["student_id", "drive_id", "step_id"],
    "app_settings": ["key"],
}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
}


class MockDb:
    def __init__(self):
        self.tables = {t: [] for t in PK}
        self.fail = False  # when True every data request answers 500, to test the "Not saved" path
        self.requests = 0

    def key(self, table, row):
        return tuple(str(row[c]) for c in PK[table])

    def matches(self, row, filters):
        for col, expr in filters.items():
            if expr.startswith("eq."):
                if str(row[col]) != expr[3:]:
                    return False
            elif expr.startswith("in."):
                vals = re.findall(r'"((?:[^"\\]|\\.)*)"', expr[3:])
                if str(row[col]) not in vals:
                    return False
        return True

    def handle(self, route, request):
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=CORS)
        self.requests += 1
        if self.fail:
            return route.fulfill(status=500, headers=CORS, content_type="application/json", body=json.dumps({"message": "mock outage"}))
        u = urlparse(request.url)
        table = u.path.rsplit("/", 1)[-1]
        q = parse_qs(u.query)
        if table not in PK:
            return route.fulfill(status=404, headers=CORS, content_type="application/json", body=json.dumps({"message": "Could not find the table"}))
        rows = self.tables[table]
        if request.method == "GET":
            off, lim = int(q.get("offset", ["0"])[0]), int(q.get("limit", ["1000"])[0])
            return route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps(rows[off:off + lim]))
        if request.method == "POST":
            for r in json.loads(request.post_data):
                k = self.key(table, r)
                for i, old in enumerate(rows):
                    if self.key(table, old) == k:
                        rows[i] = r
                        break
                else:
                    rows.append(r)
            return route.fulfill(status=201, headers=CORS)
        if request.method == "DELETE":
            filters = {k: v[0] for k, v in q.items()}
            gone = [r for r in rows if self.matches(r, filters)]
            self.tables[table] = [r for r in rows if r not in gone]
            if table == "students":  # on delete cascade
                ids = {r["id"] for r in gone}
                for t in ("applications", "notif_read", "prep_done"):
                    self.tables[t] = [r for r in self.tables[t] if r["student_id"] not in ids]
            if table == "drives":
                ids = {r["id"] for r in gone}
                for t in ("applications", "prep_done"):
                    self.tables[t] = [r for r in self.tables[t] if r["drive_id"] not in ids]
            return route.fulfill(status=204, headers=CORS)
        return route.fulfill(status=405, headers=CORS)

    def install(self, context):
        context.add_init_script("window.PLACEIQ_ENV = { url: 'https://test.supabase.co', key: 'test-anon-key-123456' };")
        context.route("https://test.supabase.co/**", self.handle)
