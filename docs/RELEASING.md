# Releasing Music Collector Mobile

Builds run on **EAS Build**, store submission on **EAS Submit**. The guiding rule:
**no account-specific value and no secret is ever committed.** Store credentials are
uploaded to and held by EAS, so `eas.json` carries only policy.

App identifiers, which the store records must match exactly:

| | Value |
|---|---|
| Bundle identifier / package | `de.jannekeipert.musiccollector` |
| EAS account | `janne6565` |
| Version source | `appVersionSource: remote` — EAS owns build number / versionCode |

Build profiles (`eas.json`):

| Profile | Distribution | Backend |
|---|---|---|
| `development` | internal, dev-client | Metro host's LAN address, else staging |
| `preview` | internal (ad-hoc link) | staging — `EXPO_PUBLIC_API_BASE` |
| `production` | store, `autoIncrement` | `https://music.jannekeipert.de` |

---

## One-time setup

### 1. `NODE_AUTH_TOKEN` on EAS — required before the first build

The domain, the merge, the write path and the sync engine come from
[`@janne6565/music-collector-shared`](https://github.com/Janne6565/music-collector-shared),
published to **GitHub Packages**, which authenticates reads even though the package is
public. `.npmrc` expands `${NODE_AUTH_TOKEN}`; without it the install step on the EAS
worker fails with a 401 and the build never reaches the compile phase.

`secrets.GITHUB_TOKEN` in Actions cannot cover this — it is scoped to a single workflow
run and the install that matters happens later, on EAS's servers. So the token is stored
on EAS as a project secret:

```sh
# Needs the read:packages scope. A dedicated PAT is better than `gh auth token`
# here: `gh auth token` is your full CLI token and it rotates out from under the build.
# Note --visibility (not --type) carries the secrecy; --type is string|file.
eas env:create --name NODE_AUTH_TOKEN --value "<ghp_...>" \
  --type string --visibility secret --scope project \
  --environment development --environment preview --environment production
```

Verify with `eas env:list development` (the environment is a positional argument).

> Prefer a dedicated PAT from <https://github.com/settings/tokens> with only
> `read:packages`. Rotating it means re-running `eas env:update`, nothing else.

### 2. `EXPO_TOKEN` in GitHub Actions

What lets CI talk to EAS. Create at
<https://expo.dev/accounts/janne6565/settings/access-tokens>, then:

```sh
gh secret set EXPO_TOKEN -R Janne6565/music-collector-mobile
```

### 3. Google Play

**a. Create the app record.** Play Console → *Create app*. Package name must be exactly
`de.jannekeipert.musiccollector`. EAS cannot create this for you.

**b. Create a service account.**

1. Play Console → *Setup → API access* → link a Google Cloud project.
2. Google Cloud → *IAM & Admin → Service Accounts* → create one → *Keys* → *Add key*
   → **JSON** → download it.
3. Play Console → *Users and permissions* → *Invite new users* → paste the service
   account's email → grant **Release manager**.

Walkthrough with screenshots: <https://expo.fyi/creating-google-service-account>

**c. Hand the key to EAS** — do not put it in the repo:

```sh
eas credentials --platform android
# → Service Credentials → Google Service Account Key → upload the JSON
```

Delete the downloaded JSON afterwards. It is a live release credential.

### 4. App Store Connect

**a. Create the app record.** App Store Connect → *My Apps* → **+** → New App, bundle ID
`de.jannekeipert.musiccollector`. Also cannot be created by EAS.

**b. Add `ascAppId`.** Copy the numeric Apple ID (App Information → General →
"Apple ID") into `submit.production.ios` in `eas.json`:

```jsonc
"ios": { "ascAppId": "6xxxxxxxxx" }
```

The key is absent until then — `eas.json` rejects an empty string, so it cannot be
stubbed — and a `--non-interactive` submit fails with *"Set ascAppId in the submit
profile"* until it is added. It is not a secret; the same number appears in every App
Store URL.

**c. Let EAS manage the API key** — preferred over an Apple ID + app-specific password,
because it is scoped to automation and doesn't carry your personal 2FA:

```sh
eas credentials --platform ios
# → choose "Set up your project to use an API Key for EAS Submit"
```

**d. Set up iOS *build* credentials.** A **separate** set from the API key above, and
both are required:

| Credential | Used for | Set up by |
|---|---|---|
| App Store Connect API Key | *submitting* a finished build | step **c** |
| Distribution Certificate + Provisioning Profile | *signing the build itself* | this step |

An API key alone gets you a `--non-interactive` build failure naming only the
certificate. Generate them once, interactively — EAS logs into Apple and creates both:

```sh
eas credentials --platform ios
# → production → Build Credentials → set up a new Distribution Certificate
#   and Provisioning Profile
```

Android needs no equivalent step: EAS generates its keystore on the first build.

---

## Day-to-day: running on a real device

The app's native modules (camera, SQLite, secure-store, image-picker) are all in the
Expo Go runtime, so `bun start` against Expo Go still works for quick iteration. A
dev-client build is what you want once you care about the real binary:

```sh
eas build --platform ios --profile development
# install the artifact on the device, then:
bun run dev
```

A shareable QA build with no dev tooling, pointed at staging:

```sh
eas build --platform all --profile preview
```

---

## Releasing

The house convention (agents KB `cicd` skill) is **cut a tag = ship prod**. The
`EAS Build` workflow builds `production` for both platforms on any `v*.*.*` tag.

Submission is opt-in behind a repo variable, so tags keep building safely until the
store setup above is actually done:

```sh
gh variable set EAS_AUTO_SUBMIT --body true -R Janne6565/music-collector-mobile
```

With it set, a tag push runs `eas build --auto-submit`: EAS builds, then queues the
store submission server-side. Without it, tags build only.

Ad-hoc runs go through the Actions *Run workflow* button (platform × profile), or
locally:

```sh
eas build --platform android --profile production --auto-submit
eas submit --platform ios --latest      # submit an already-finished build
```

### First submission per store

- **Play:** the first upload must reach the `internal` track (already configured). Play
  will not accept a production release until the app record's setup tasks — content
  rating, data safety, target audience, store listing — are complete.
- **App Store:** the first build takes an extra hop through TestFlight processing before
  it's assignable to testers. `companyName` may be required on a brand-new app.

---

## Gotchas

- **The build dies at `bun install` with a 401.** `NODE_AUTH_TOKEN` is missing or expired
  on EAS — step 1. This is the single most likely first-build failure in this repo.
- **iOS build fails at "Failed to sync capabilities".** Apple answers the capability
  PATCH with a misleading *"The bundle '…' cannot be deleted. Delete all the Apps related
  to this bundle to proceed."* — nothing is being deleted, and the bundle identifier is
  registered fine; only the capability patch fails. eas-cli tries to switch capabilities
  the app config doesn't declare (e.g. `APPLE_ID_AUTH`) **off**. This app needs no special
  entitlements at all — auth is plain email/password, and the camera, photo-library and
  Keychain access it does use are Info.plist usage strings, not capabilities. So there is
  nothing for the sync to do, and it is safe to skip:

  ```sh
  EXPO_NO_CAPABILITY_SYNC=1 eas build --platform ios --profile development
  ```

  Revisit only if the app ever gains a real entitlement — Sign in with Apple, push
  notifications, associated domains, app groups — in which case enable it by hand at
  <https://developer.apple.com/account/resources/identifiers> instead.

- **`appVersionSource: remote`** means EAS owns the build number and `versionCode`;
  `production.autoIncrement` bumps them server-side. Don't hand-edit `version` in
  `app.json` expecting it to drive the store build number — it's the user-facing version
  string only.
- **Credentials live on EAS, not here.** A fresh clone can build and submit with no local
  key files. Inspect what's stored with `eas credentials`.
- **No OTA updates yet.** `expo-updates` is deliberately not installed, so the profiles
  carry no `channel`. Adding it later is `eas update:configure` plus a `channel` per
  profile.

---

## Verifying a build

```sh
eas build:list --platform android --limit 5
eas build:view <build-id>
```
