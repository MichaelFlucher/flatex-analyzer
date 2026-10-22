# Auth/ORM security follow-up — 2026-10-22

## Decision

Production-source base: `coolify` commit `8627a93b4083df221c031514ded93322c883e0bb`. Patch Better Auth to **1.6.33**, Drizzle ORM to **0.45.4**, and compatible Drizzle Kit to **0.31.11**, all exact pins. Better Auth 1.6.33 supports Next 15 and Drizzle >=0.45.2 / Kit >=0.31.4. Use the patched 1.6 maintenance line rather than the unrelated latest 1.7 line. Keep Next 15.5.28 and the existing auth configuration/schema/migrations unchanged.

Primary advisory checks (GitHub API and npm audit, 2026-10-22):

- [Drizzle identifier escaping GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9): stable fix 0.45.2.
- [Better Auth pre-account hijacking GHSA-qq9h-g4jm-xgf3](https://github.com/advisories/GHSA-qq9h-g4jm-xgf3): 1.6 fix 1.6.22. Magic-link/email-OTP not configured here.
- [Better Auth stale sessions GHSA-2vg6-77g8-24mp](https://github.com/advisories/GHSA-2vg6-77g8-24mp): fix 1.6.11. Admin/anonymous/SCIM plugins not configured here.
- Current npm audit includes no Better Auth/Drizzle ORM vulnerability after these pins. This is not a claim that every historical optional-plugin advisory was exploitable in this application.

Actual auth surface is email/password with user deletion. No OAuth/OIDC/organization/OTP/2FA/admin plugins, cookie cache or custom ID configuration. App queries use static Drizzle tables/columns and bound `eq` values; nevertheless the ORM package is patched.

## Disposable PostgreSQL regression

`scripts/security-auth-regression.ts` tests the **actual application auth instance and route handlers**, not a mock adapter. It refuses non-loopback connections, any database name except `flatex_security_regression`, and any nonempty public schema. Set `DATABASE_URL` only to a newly created disposable database owned by a disposable role, then run:

```sh
DATABASE_URL=postgresql://DISPOSABLE_USER:DISPOSABLE_PASSWORD@127.0.0.1:5432/flatex_security_regression npx tsx scripts/security-auth-regression.ts
```

The script sets its own test-only auth secret/base URL; never reuse those in deployment. It applies all four existing migrations to an empty PostgreSQL database, then verifies:

- Email/password signup/login, incorrect-password rejection, real session lookup, anonymous/forged-session rejection.
- User-config and encrypted raw-data isolation between two users, including another user attempting deletion.
- Injection-shaped stored ID round-trip and embedded-quote SQL identifier execution without altering the user table.
- Wrong-password rejection for user deletion, successful password-protected deletion, invalidation of both existing sessions, account/session/config/raw-data cascades, preservation of the other user.

PASS on Node24.22.1 / PostgreSQL15 inside the managed capped sandbox. Existing migrations and schema suffice: no production migration needed or performed. The test leaves its disposable DB populated for inspection; recreate that DB explicitly before repeating. No production database/service or paused development stack was accessed.

## Residual tooling findings

The full audit still reports **10 package findings (1 critical, 1 high, 8 moderate)**. Do not label this a clean audit:

- Old `tar` under locked `@tailwindcss/oxide@4.1.8`: critical archive extraction advisories. Build installation/tooling path, not application-upload archive handling.
- `postcss` under Tailwind and bundled by Next15.5.28: high CSS serialization/source-map parsing advisories. This app does not compile user-submitted CSS. Next pins its version; a framework-major update/override is outside this bounded patch.
- `postcss-selector-parser` under typography: moderate CPU complexity; stylesheet build path.
- DrizzleKit legacy `@esbuild-kit/*` / `esbuild` dev-server advisory: migration/build tooling, no such dev server exposed by this change.
- `next` and `@mui/material-nextjs` aggregate the PostCSS dependency finding; this is not a new Next RSC version regression.

A separate tooling refresh may address these. No `npm audit fix --force`, unrelated Next major, schema change, production push/deploy or Docker image build/push was performed by this preparation worker. Parent must review/integrate and verify the production rollout.
