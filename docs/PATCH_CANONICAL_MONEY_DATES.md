# STRICT PATCH — Canonical Money + Canonical Dates + Version Stamp

## Summary

- **Canonical dates:** Accept only ISO `YYYY-MM-DD` / `YYYY-MM`. New `lib/time/parse.ts` with `parseIsoDateOrThrow`, `parseMonthKeyOrThrow`, `formatIsoDate`. No locale-based parsing (avoids Arabic day/month flip like 2026/28/02).
- **Canonical money:** Already enforced; added dev-only `console.warn` in `formatSarFromHalala` when value looks like SAR decimal passed as halalas.
- **Version stamp:** `/api/version` returns `gitSha`, `buildId`, `appVersion`; `buildId` read from `.next/BUILD_ID`. Footer shows Build ID when present.

## Files Touched

| File | Change |
|------|--------|
| `lib/time/parse.ts` | **NEW** — `parseIsoDateOrThrow("YYYY-MM-DD")`, `parseMonthKeyOrThrow("YYYY-MM")`, `formatIsoDate(date)`; throws on invalid. |
| `app/api/metrics/sales-my/route.ts` | Validate `from`/`to` with `parseIsoDateOrThrow` when both provided; return 400 on invalid; use `formatIsoDate` in response. |
| `lib/utils/money.ts` | Dev-only warn when value is decimal in 0–10k (possible SAR as halalas). |
| `lib/server/getBuildId.ts` | **NEW** — Server-only; read `.next/BUILD_ID`. |
| `lib/version.ts` | Removed `getBuildId` (moved to server module). |
| `app/api/version/route.ts` | Return `gitSha`, `buildId` (from `getBuildId()`), `appVersion`; import `getBuildId` from `@/lib/server/getBuildId`. |
| `app/layout.tsx` | Import `getBuildId` from server module; footer shows `Build: {buildId}` when present. |
| `__tests__/time-parse.test.ts` | **NEW** — Unit tests for parse helpers. |

## Acceptance

- **A)** Same user/boutique/range: `/me/target` MTD = `/sales/my` range sum for month = dashboard MTD (unchanged; already enforced by aggregator).
- **B)** Arabic UI: `<input type="date">` sends ISO `YYYY-MM-DD`; API validates with `parseIsoDateOrThrow` and returns 400 for non-ISO.
- **C)** No ambiguous date in inputs: use only `type="date"` and `type="month"` (value is always ISO).
- **D)** 191950 halalas → "1,919.50 SAR" everywhere via `formatSarFromHalala` (unchanged).

## Tests

- `npx jest __tests__/time-parse.test.ts __tests__/money.test.ts` — pass.
- `parseIsoDateOrThrow('28/02/2026')` and `parseIsoDateOrThrow('2026/28/02')` throw (no day/month flip).
