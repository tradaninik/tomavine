# Tomavine — Google Play Submission Runbook (M2)

Everything needed to take the Capacitor shell from this repo to a live Play listing.
Context: repo at `C:\tomavine` (Windows PowerShell), site live at https://tomavine.vercel.app
(Vercel, auto-deploys from GitHub `main`). The Android app is a thin shell (server-url mode):
the WebView loads https://tomavine.vercel.app. App id `in.tomavine.app`. Release artifacts:
AAB (for Play) + APK (for sideloading) via `npm run android:release`.

---

## §0 Prerequisites

1. **Node 20+** — `node -v`. The repo builds Next.js 16.
2. **Android Studio** — https://developer.android.com/studio
   - Bundles its own JDK (no separate Java install needed).
   - On first run, its wizard installs the Android SDK (accept defaults).
   - Set `ANDROID_HOME` (SDK path is the default install location):

   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"   # current session
   ```

3. **Python 3 + Pillow — optional.** Launcher icons are committed; `scripts/make-android-icons.py`
   only regenerates them from `public/icons/` (needs `python -m pip install Pillow`). Skip unless
   you change the icon.
4. One-time: `npm install` in `C:\tomavine`.

---

## §1 One-time signing

The upload key lives in `C:\tomavine\tomavine-release.jks`. Generate it once, back it up forever.

1. Generate the keystore (alias `tomavine`, validity ≥ 10000 days, RSA 2048):

   ```powershell
   cd C:\tomavine
   keytool -genkeypair -v -keystore .\tomavine-release.jks -alias tomavine -keyalg RSA -keysize 2048 -validity 10000
   ```

   - `keytool` ships with any JDK. If not on PATH, Android Studio's bundled one works:

   ```powershell
   & "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore .\tomavine-release.jks -alias tomavine -keyalg RSA -keysize 2048 -validity 10000
   ```

   - Use strong, unique passwords (20+ chars, password manager). Distinguished-name prompts
     (name/org/city) can be answered honestly or skipped through — they are informational.
   - **Back up the `.jks` + passwords offline immediately.** Losing the upload key means a Play
     support recovery process; don't rely on one copy.

2. Point Gradle at it. Copy the example and fill in the two passwords:

   ```powershell
   Copy-Item .\android\keystore.properties.example .\android\keystore.properties
   notepad .\android\keystore.properties
   ```

   Contents (storeFile is resolved by Gradle against the `android\` directory, so `..\` puts the key at the repo root):

   ```properties
   storeFile=../tomavine-release.jks
   storePassword=<your store password>
   keyAlias=tomavine
   keyPassword=<your key password>
   ```

   If `android\keystore.properties.example` is not present yet, pull the latest `main` — it is
   committed alongside the android project.

3. Verify nothing secret can be committed. `.gitignore` already covers `*.jks`, `*.keystore` and
   `android/keystore.properties`. Confirm with:

   ```powershell
   git status --porcelain          # keystore files must NOT appear
   git check-ignore -v .\tomavine-release.jks .\android\keystore.properties
   ```

4. Re-read the SHA-256 fingerprint any time (needed for App Links in §6):

   ```powershell
   keytool -list -v -keystore .\tomavine-release.jks -alias tomavine | Select-String SHA256
   ```

---

## §2 Building

1. Build both artifacts from the repo root (the script `cd`s into `android\` itself):

   ```powershell
   cd C:\tomavine
   npm run android:release
   ```

2. Expected outputs:

   | Artifact | Path | Use |
   |---|---|---|
   | AAB | `android\app\build\outputs\bundle\release\app-release.aab` | Upload to Play |
   | APK | `android\app\build\outputs\apk\release\app-release.apk` | Sideload / test / §6 adb recipe |

3. Verify the APK signature (apksigner lives in the SDK build-tools):

   ```powershell
   $bt = Get-ChildItem "$env:ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
   & "$($bt.FullName)\apksigner.bat" verify --print-certs .\android\app\build\outputs\apk\release\app-release.apk
   ```

   The printed SHA-256 must match the `keytool -list` fingerprint from §1.

4. Troubleshooting:

   | Symptom | Cause | Fix |
   |---|---|---|
   | `ANDROID_HOME` not set / SDK location not found | env var missing for this shell | set per §0; or open `android\` once in Android Studio (writes `local.properties`) |
   | `You have not accepted the license agreements` | SDK licenses pending | open Android Studio → SDK Manager → accept; or `sdkmanager --licenses` |
   | Gradle fails on Java version / `Unsupported class file major version` | wrong JDK on PATH | use Android Studio's embedded JDK: set `$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"` for the session, or persist with `org.gradle.java.home=C\:\\Program Files\\Android\\Android Studio\\jbr` in `android\gradle.properties` |
   | Play later demands a newer targetSdk | annual targetSdk policy | bump `targetSdkVersion` in `android\variables.gradle`, bump versionCode (§8), rebuild, re-upload |
   | `prisma migrate deploy` fails with P1002 (advisory-lock timeout) on your machine | Neon cold-start lock contention — transient | just retry the command |
   | `gradlew.bat` not found | ran inside `android\android` | the npm script handles the `cd`; run `npm run android:release` from `C:\tomavine` only |

Note: on your machine `npm run build` is `prisma migrate deploy && next build` against the real
Neon DB — but the Android build does **not** run it; the shell only wraps the deployed site.

---

## §3 Play Console — app creation & the 14-day closed test

### Create the app

1. https://play.google.com/console → **Create app**.
2. App name: **Tomavine**. Default language: **en-IN**. App/Game: **App**. Free/Paid: **Free**.
3. After creation: Console → setup → set category **Shopping**.
4. **⚠ The application id `in.tomavine.app` is permanent once published.** Changing it later means
   a brand-new listing with zero reviews and zero install history. Confirm you want
   `in.tomavine.app` (matching the deployed App Links in §6) **before the first AAB upload.**

### Closed testing (mandatory for new personal developer accounts)

New personal developer accounts must run a **14-day closed test with at least 12 testers who are
OPTED-IN for 14 continuous days** before production access is granted. Plan for it up front.

1. **Create the track:** Console → **Testing → Closed testing → Create track** (e.g. "Beta").
2. **Upload** the §2 AAB to this closed track and roll it out.
3. **Add testers by email list:** in the track, create an email list of your testers (Console →
   Testing → Closed testing → manage testers → add emails). Google emails them an **opt-in link**.
   Each tester must open the link, **accept**, and install the app from Play — until they do, they
   are not "opted-in" and do not count.
4. **Recruit 15–20, not 12.** The 14-day clock only starts once the **12th tester is opted-in**,
   and it requires 12 testers continuously in the track. If testers drop out and you fall below
   12, the clock stalls. Recruit friends/family/WhatsApp groups; tell them explicitly: click the
   link, join, install, and **stay in the test for two full weeks**.
5. **Wait out the window.** The Console shows tester counts and the access-timer status. Expect
   ~2.5–4.5 weeks from first upload to production eligibility depending on how fast you reach 12
   opted-in testers.
6. **Apply for production access** once the Console marks you eligible (answer the short
   questionnaire about the test), then promote/roll out to production.

---

## §4 Data safety form

Console → **App content → Data safety**. The mapping below matches the code exactly — do not
freestyle answers; Play cross-checks against the privacy policy.

| Data type | Collected | Shared | Purpose(s) | Notes |
|---|---|---|---|---|
| Phone number | Yes | No | Account management, Fraud prevention | Sign-in is phone+OTP; required |
| Name | Yes | No | Account management, delivery (form label: App functionality / Account management) | Optional profile field |
| Address — delivery addresses | Yes | No | Order fulfillment (form label: App functionality) | Checkout only |
| Purchase history / order IDs | Yes | No | App functionality (order fulfillment & history) | Retained after deletion, de-identified |
| Email | **No** | — | — | The app has no email field anywhere |
| User IDs | Yes (order/account ids only) | No | App functionality | Internal identifiers |
| Location (approximate) | No | — | — | See note below the table |
| Photos and videos | Yes (sellers only) | No | App functionality | Product photo upload to Vercel Blob (`api/seller/products/[id]/image`); customers upload nothing |

**Location note:** the location chip optionally uses device GPS **in the browser** to snap to the
nearest served district (`src/app/shop/location.tsx`); the raw coordinates never leave the
device and are never stored — only the resulting district code is kept (locally, and only as
your selected district). Under Play's definition (data transmitted off the device), location is
**not collected**; the district itself is user-selected data, same as typing your city. If you
prefer the maximally conservative answer, mark *Approximate location* as collected, purpose
App functionality, not shared — either is defensible, just stay consistent with the privacy
policy.

- **Encrypted in transit:** Yes (HTTPS only; the site forces TLS).
- **Users can request deletion:** **Yes** — and it is self-service in-app: sign in →
  **Orders page** → "Delete my account" card → confirm. Web link for the Data safety form:
  **https://tomavine.vercel.app/shop/orders**
- **Actual behavior (from the code, `src/app/api/auth/account/route.ts`):** deletion immediately
  anonymizes the account — name, city and pincode are nulled, the phone number is tombstoned
  (`deleted:<id>`, can never log in again), WhatsApp bindings are deleted, and the user is logged
  out on the spot. Order rows are retained for legal/tax reasons **without the identity**
  (disclosed in the privacy policy). Customer accounts only; seller/staff accounts are offboarded
  by the super admin.
- **Ads:** none. **Analytics:** none. **Financial info:** no Play Billing / no in-app purchases —
  physical goods only, paid via COD or Razorpay at checkout.
- Keep the answers consistent with the live privacy policy — **https://tomavine.vercel.app/legal/privacy**
  — and use that same URL in the listing's Privacy policy field (and under App content → Privacy).

---

## §5 App access for review

Reviewers cannot receive an OTP (it goes to a WhatsApp number they don't own). The app ships a
built-in answer: the **env-scoped owner sign-in**.

**Recommended: temporary owner credentials**

1. In Vercel → your project → **Settings → Environment Variables**, set:
   - `OWNER_PHONE` = `+91` + 10-digit phone (e.g. your own)
   - `OWNER_PASSWORD` = a password for the review window (throwaway is fine)
2. **Redeploy** (Deployments → ⋯ → Redeploy) so the functions pick up the new env.
3. Verified behavior (`src/app/api/auth/owner/route.ts`): with **either variable unset the route
   returns 404** (`not_enabled`) — nothing to attack, nothing to find. With both set, the login
   screen's **"Owner sign-in"** link (bottom of the card at https://tomavine.vercel.app/login)
   switches to a phone + password form; a correct pair issues a normal session (the account is
   created on first use if the phone is new).
4. In Console → **App content → App access**, add credentials/instructions, e.g.:
   *"Tap 'Owner sign-in' on the login screen. Phone: +91XXXXXXXXXX. Password: XXXXXX."*
5. After approval: delete both env vars in Vercel, redeploy — the route 404s again and the extra
   form becomes non-functional.

**Alternative: dedicated review phone + OTP relay**

- Give Play a phone number you control and relay each OTP: if the WhatsApp Cloud API env vars are
  configured, the OTP arrives as a WhatsApp template message to that number.
- **Server-logs fallback (explicitly supported):** when the WhatsApp env vars are *unset*, the OTP
  is not sent anywhere — it is printed to the server log as a `[WA:skipped] to=+91… :: <code>` line
  (`src/lib/whatsapp.ts`). During the review window you can read it in Vercel → your project →
  **Logs** and relay it to the reviewer. Use this only if you prefer not to touch owner env vars.

---

## §6 Deep links & assetlinks.json

App Links are declared in `android\app\src\main\AndroidManifest.xml` for
`https://tomavine.vercel.app` (paths `/`, `/login`, `/shop*`, with
`android:autoVerify="true"`). Verification requires the site to serve
`/.well-known/assetlinks.json` containing **both** signing fingerprints:

1. **After the first AAB upload** to Play: Console → **Setup → App signing** → copy the
   **app-signing key SHA-256** (Play generates its own signing key on first upload — this is the
   one store-installed builds actually run under).
2. Get the **upload keystore** SHA-256 from §1 step 4.
3. Regenerate the file with both (colon-separated keytool output is accepted as-is; the script
   normalizes):

   ```powershell
   cd C:\tomavine
   node scripts/assetlinks.mjs <play-app-signing-sha256> <upload-keystore-sha256>
   ```

4. Commit `public\.well-known\assetlinks.json`, push to `main` → Vercel deploys it.
5. Verify it serves correctly:

   ```powershell
   curl.exe -s https://tomavine.vercel.app/.well-known/assetlinks.json
   ```

   Expect HTTP 200 and JSON listing both fingerprints (no redirect, no auth wall).

6. **Until verification lands, Android shows a chooser** for `tomavine.vercel.app` links; after
   verification (allow **24–48 h** for Android to re-check) links open the app directly.

**adb test recipe (before or after store rollout):**

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r .\android\app\build\outputs\apk\release\app-release.apk
& $adb shell pm verify-app-links --re-verify in.tomavine.app
& $adb shell pm get-app-links in.tomavine.app     # look for "verified" / domain status
```

Then on the device: open any `https://tomavine.vercel.app/...` link from **outside** the app —
e.g. WhatsApp yourself a product URL such as
`https://tomavine.vercel.app/shop/product/<id>` (get a real id from the site) and tap it. With
verification active, the app opens straight to that product page instead of the browser. (The app
itself does not generate wa.me share links — any tomavine.vercel.app URL works for this test.)

---

## §7 Store listing

Console → **Main store listing**:

- **App name** (≤ 30 chars): `Tomavine — Plants & Saplings` (28)
- **Short description** (≤ 80 chars):
  `Plants & saplings from nurseries near you — 6 languages, COD & online payments.` (79)
- **Full description** (≤ 4000 chars) — ready-to-paste draft:

```
Tomavine is a multi-vendor marketplace that connects plant buyers directly with real nurseries across Telangana, Andhra Pradesh and Karnataka — covering 90 districts.

BROWSE & DISCOVER
• Shop live plant catalogs from multiple verified nurseries
• Nurseries sorted nearest-first, based on your district and pincode
• Browse by category, search the full catalog, or open a nursery's storefront
• Discount Center — give discounted plants a home while the listing lasts

PLANTING ADVISOR
• Answer a few questions and get matched with plants that suit your climate, space and experience
• Care guidance attached to every product

BUY WITH CONFIDENCE
• Sign in with just your phone number — OTP over WhatsApp, no passwords to remember
• Pay your way: Cash on Delivery, or online via Razorpay (UPI, cards, netbanking)
• Track every order from confirmation to delivery; choose delivery or nursery pickup where offered
• Review your delivered orders and help other growers

FOR EVERYONE
• The whole app in 6 languages: English, हिंदी, తెలుగు, ಕన్నడ, தமிழ், मराठी
• Your account, cart and orders also work on the web at tomavine.vercel.app

PRIVACY FIRST
• No ads, no trackers, no email required
• Delete your account anytime from the Orders page — your name, phone, city and pincode are wiped immediately
```

- **App icon:** upload `public\icons\icon-512.png` (512×512).
- **Feature graphic** (1024×500) — one-line PIL snippet on the theme colors
  (`#1C3A2A` on `#F7F3E8`, tagline from the app):

  ```powershell
  python -c "from PIL import Image,ImageDraw,ImageFont; im=Image.new('RGB',(1024,500),'#1C3A2A'); d=ImageDraw.Draw(im); f=ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf',110); d.text((512,215),'TOMAVINE',font=f,fill='#F7F3E8',anchor='mm'); f2=ImageFont.truetype('C:/Windows/Fonts/segoeuil.ttf',38); d.text((512,330),'Where growers meet gardens',font=f2,fill='#EDF2E6',anchor='mm'); im.save('feature-graphic.png')"
  ```

- **Screenshots:** 2–8 phone screenshots, portrait (browse, nursery page, product page, advisor,
  cart/checkout, orders). Phone/tablet only — the app is phone-first; do not add TV/wear assets.
- **Contact details:** website `https://tomavine.vercel.app`; privacy policy
  `https://tomavine.vercel.app/legal/privacy` (also in App content → Privacy).

**Content rating questionnaire** — answer honestly from real behavior:
- It is a shopping app; products are physical plants/gardening goods.
- **User-generated content: yes** — customers can review products/orders. The reviews are not
  shareable social content beyond the app (no public profiles, no messaging between users).
- No ads, no gambling, no simulated gambling, no violence/user-to-user chat.
- Target audience 13+; the app is **not child-directed** (no content or features aimed at
  children under 13).

Answer every remaining listing question from the app's actual behavior — the Data safety (§4),
content rating, and ads declarations must agree with each other and with the privacy policy.

---

## §8 Versioning & future releases

1. Every Play release: bump both fields in `android\app\build.gradle`:
   - `versionCode` — integer, **always +1** (Play rejects reuse/regression; never skip down)
   - `versionName` — human-readable, e.g. `1.0.1`
2. Rebuild (`npm run android:release`) and upload the new AAB to the same app.
3. `npm run cap:sync` is **only** needed if the web app ever stops being loaded from the server
   (i.e. a switch away from server-url mode). In server mode, **web changes ship instantly via
   Vercel with no Play release** — the Play release only carries shell changes.

Versioning policy:

| Change | Play release needed? | Action |
|---|---|---|
| Web app change (shop/seller/admin pages, copy, i18n) | No | push to `main` → Vercel deploys |
| Icon, app name, deep-link intent filters, targetSdk | Yes | bump versionCode + versionName → §2 → upload |
| Play policy forces newer targetSdk | Yes | bump `android\variables.gradle` + versionCode → rebuild → upload |
| Switch to bundled web assets (not planned) | Yes | `npm run cap:sync` → version bump → build |

---

## §9 Architecture notes

- **The APK/AAB is a thin shell.** `capacitor.config.ts` sets `server.url` to
  `https://tomavine.vercel.app`; there is no local web bundle inside the app. The app is exactly
  as reachable as the site — **keep Vercel green** (every push to `main` deploys; a broken
  deployment breaks the store app too).
- **`NEXT_PUBLIC_SITE_URL`** (optional, Vercel env) overrides the deployed origin used for
  metadata/share hosts (`src/lib/site.ts`); default is `https://tomavine.vercel.app`. Leave unset
  for production.
- **`CAPACITOR_SERVER_URL`** — LAN testing against your own machine: run `next dev`, then:

  ```powershell
  $env:CAPACITOR_SERVER_URL = "http://<your-lan-ip>:3000"
  npm run cap:sync        # config is baked into the android project at sync time
  npm run android:release
  ```

  Plain-`http://` URLs auto-enable cleartext in `capacitor.config.ts` (HTTPS targets never do).
  Unset the variable before any store build.
- **The PWA remains installable** from Chrome alongside the Play app — same account, same orders,
  both entry points stay live.
- **Android System WebView** (updated via Play, independently of your app) is the actual browser
  engine inside the shell. If users report rendering issues on specific devices, check the
  WebView version before suspecting the site.
