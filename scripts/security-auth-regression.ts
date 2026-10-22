import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";

// Never run against a remote or existing application DB. This test owns its database.
async function main() {
  const connection = process.env.DATABASE_URL;
  assert(connection, "DATABASE_URL must identify the disposable regression database");
  const url = new URL(connection);
  assert(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/flatex_security_regression");
  process.env.BETTER_AUTH_SECRET = "disposable-regression-secret-not-for-production-20261022";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  const pool = new Pool({ connectionString: connection });
  const existing = await pool.query("select count(*)::int as count from information_schema.tables where table_schema = $1", ["public"]);
  assert.equal(existing.rows[0].count, 0, "test requires a fresh empty database");
  for (const file of ["0000_faithful_piledriver.sql", "0001_user-config.sql", "0002_data-persist.sql", "0003_price-history-cache.sql"]) {
    await pool.query(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const { auth } = await import("../src/lib/auth");
  const { db } = await import("../src/db");
  const config = await import("../src/app/api/user-config/route");
  const raw = await import("../src/app/api/raw-data/route");
  const password = "Disposable-test-password-12345!";
  const origin = { origin: "http://localhost:3000" };
  const request = (path: string, cookie = "", method = "GET", body?: unknown) => new NextRequest(`http://localhost:3000/api/${path}`, { method, headers: { ...origin, cookie, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  async function call(path: string, body: unknown, cookie = "") {
    return auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, { method: "POST", headers: { ...origin, cookie, "content-type": "application/json" }, body: JSON.stringify(body) }));
  }
  async function signup(email: string) {
    const response = await call("sign-up/email", { name: "Regression", email, password });
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).user.id as string;
  }
  async function login(email: string) {
    const response = await call("sign-in/email", { email, password });
    assert.equal(response.status, 200, await response.clone().text());
    const cookies = response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    assert(cookies.includes("session_token"));
    return cookies;
  }
  const alice = await signup("alice@example.test");
  const bob = await signup("bob@example.test");
  const a = await login("alice@example.test");
  const aSecond = await login("alice@example.test");
  const b = await login("bob@example.test");
  assert.equal((await auth.api.getSession({ headers: new Headers({ cookie: a }) }))?.user.id, alice);
  assert.equal((await call("sign-in/email", { email: "alice@example.test", password: "incorrect-password" })).status, 401);
  assert.equal((await config.GET(request("user-config"))).status, 401);
  assert.equal((await raw.GET(request("raw-data"))).status, 401);
  assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: "better-auth.session_token=forged.invalid" }) }), null);
  assert.equal((await config.PATCH(request("user-config", a, "PATCH", { dataPersistenceMode: "server" }))).status, 204);
  assert.deepEqual(await (await config.GET(request("user-config", b))).json(), { dataPersistenceMode: "none" });
  const maliciousId = `quoted\"; DROP TABLE \"user\"; --`;
  const payload = { depot: [{ id: maliciousId, encryptedData: "ciphertext-alice", fileName: "private.csv", timestamp: new Date().toISOString() }], account: [] };
  assert.equal((await raw.POST(request("raw-data", a, "POST", payload))).status, 200);
  assert.deepEqual(await (await raw.GET(request("raw-data", b))).json(), { depot: [], account: [] });
  assert.equal((await (await raw.GET(request("raw-data", a))).json()).depot[0].id, maliciousId);
  assert.equal((await raw.DELETE(request("raw-data", b, "DELETE"))).status, 200);
  assert.equal((await (await raw.GET(request("raw-data", a))).json()).depot.length, 1);
  // GHSA-gpj5-g38j-94v9: identifiers must be quoted, not executable SQL.
  const identifier = `probe\"; DROP TABLE \"user\"; --`;
  const result = await db.execute(sql`select 1 as ${sql.identifier(identifier)}`);
  assert.equal(result.rows[0][identifier], 1);
  assert.equal((await pool.query("select count(*)::int as n from public.\"user\"")).rows[0].n, 2);
  assert.equal((await call("delete-user", { password: "incorrect-password" }, a)).status, 400);
  const deletion = await call("delete-user", { password }, a);
  assert.equal(deletion.status, 200, await deletion.clone().text());
  for (const cookie of [a, aSecond]) assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null);
  for (const table of ["session", "account", "raw_depot_data_set", "raw_account_data_set", "user_config"]) {
    assert.equal((await pool.query(`select count(*)::int as n from "${table}" where user_id = $1`, [alice])).rows[0].n, 0, table);
  }
  assert.equal((await auth.api.getSession({ headers: new Headers({ cookie: b }) }))?.user.id, bob);
  assert.equal((await config.GET(request("user-config", a))).status, 401);
  await db.$client.end();
  await pool.end();
  console.log("PASS: existing migrations; email signup/login; wrong credentials/forged/anonymous rejection; session lookup; per-user config and raw-data isolation; quoted identifiers/injection-shaped values; password-protected deletion; all sessions invalidated; cascades; other user preserved.");
}
main().catch(error => { console.error(error); process.exit(1); });
