# Deploying to tjm.samyv.com

The code side is done: `.github/workflows/ci.yml` deploys every push to `main` (D1 migrations, then `npm run deploy`) once the repo variable `D1_PRODUCTION_ID` is set, `cloudflare.config.ts` binds the custom domain, and `src/lib/server/viewer-resolution.ts` verifies the Access JWT. What's left is dashboard work, once. Adapted from notakid's `docs/deploy.md`.

## Checklist

1. **D1**: `npx cf d1 create --name tjm-production --mode development` (the mode only loads the config; the command is account-wide), paste its `uuid` into `productionDatabaseId()` in `cloudflare.config.ts`.
2. **Access app** (Zero Trust → Access → Applications → Add → Self-hosted):
   - Hostname `tjm.samyv.com`, session duration **1 month**, login method One-time PIN.
   - Policy: Action Allow, Include → Emails → **the admin's email only**. While `users` is empty, the first verified login becomes admin (spec Q1): nobody else gets in before the admin's first login.
   - Copy the app's **Application Audience (AUD) Tag** into `productionAccessAud()` in `cloudflare.config.ts`. `ACCESS_TEAM_DOMAIN` is already `https://illiatdesdindes.cloudflareaccess.com`.
   - A second self-hosted app, _tjm public files_: destinations `tjm.samyv.com/service-worker.js`, `/manifest.webmanifest` and `/icon-*`, policy Action **Bypass**, Include → Everyone. Browsers refuse a service worker script behind Access's login redirect, so without it no install and no Notifications. These files hold no data; pages and `__data.json` stay behind Access.
   - Commit `cloudflare.config.ts`: CI deploys from it.
3. **GitHub secrets** (repo → Settings → Secrets → Actions):
   - `CLOUDFLARE_ACCOUNT_ID`: from the Workers dashboard sidebar.
   - `CLOUDFLARE_API_TOKEN`: My Profile → API Tokens → "Edit Cloudflare Workers" template, plus Account → D1 → Edit; zone `samyv.com`. Keep Zone → Workers Routes in it: the deploy needs it every time with a custom domain (workers-sdk#15863).
4. **Arm the deploy**: `gh variable set D1_PRODUCTION_ID --body <uuid>` (the same ID as in the config). The next push to `main` deploys; the first one creates the `tjm` DNS record (delete any existing one first).
5. **VAPID secrets**: `cf deploy` deletes every secret `cloudflare.config.ts` doesn't declare, and the Worker must exist first. So the first deploy fails on the missing secrets ("required secrets have not been set"): set them, then re-run it (`gh run rerun <run-id> --failed`). One pair, both base64url:
   ```sh
   read -r PUB PRIV < <(node --input-type=module -e "const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);console.log(Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey)).toString('base64url'),(await crypto.subtle.exportKey('jwk',k.privateKey)).d)")
   npx cf workers secrets update VAPID_PUBLIC_KEY --worker tjm --type secret_text --text "$PUB" --mode production
   npx cf workers secrets update VAPID_PRIVATE_KEY --worker tjm --type secret_text --text "$PRIV" --mode production
   ```
   A new pair breaks every Push Subscription: each member turns Notifications back on in Réglages.
6. **Check**:
   - The admin opens `https://tjm.samyv.com` in a private window → Access login → the app, as admin. `curl -I https://tjm.samyv.com` → Access redirect, never the app; `curl -I https://tjm.samyv.com/manifest.webmanifest` → 200.
   - Android (Chrome): the install screen, install, Réglages → Notifications on; a chore logged from another account shows a Notification.
7. **The family**: register each member with a role in Réglages, then add their emails to the Access policy (in that order: an unregistered login gets refused by the app anyway).

**Supported: desktop browsers and Android.** iPhone isn't tested.
