# E2E (real platform)

Playwright runs the Next.js app locally and calls **production GeekOAuth + GeekAPI** (or overrides below). There is no in-repo mock platform.

## Required

```bash
export E2E_ACCESS_TOKEN="<GeekOAuth access token for a test account>"
```

Optional:

- `E2E_REFRESH_TOKEN` — session refresh / logout tests
- `E2E_VIEWER_ACCESS_TOKEN` — non-admin authorization tests
- `E2E_AUTH_URL` — default `https://auth.geekatyourspot.com`
- `E2E_GEEK_API_URL` — default `https://api.geekatyourspot.com`
- `E2E_GCC_V2_HUB_URL` — default `${E2E_GEEK_API_URL}/hubs/gcc-v2-realtime`
- `E2E_APP_PORT` — local app port (default `3004`)

Register `http://127.0.0.1:<port>/auth/callback` (and your chosen port) on the OAuth client if you use a non-default app port.

## CI

Add repository secret `E2E_ACCESS_TOKEN`. Optional: `E2E_REFRESH_TOKEN`, `E2E_VIEWER_ACCESS_TOKEN`.

Tests that depended on fake-platform fault injection (`__scenario`) are skipped until an equivalent exists on the real stack.

## Run

```bash
npm run test:e2e
```
