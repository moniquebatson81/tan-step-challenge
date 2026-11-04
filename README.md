# TAN Healthcare Step Challenge — first working concept

**Status:** Built and configured for Firebase project `step-challenge-89f8e`, but **not yet published or tested against a live Firebase backend**. Do not invite participants until the setup and security checks below are finished. The project is designed to stay on Firebase **Spark (free)** and GitHub Pages.

## What is included

- Registration with email, password, **one stable profile per Firebase account**, and email verification.
- Private full name and email; participant-visible chosen display name.
- A seven-day entry screen: fill in any subset of days, and correct previous dates without duplicating records.
- Cumulative top-10 leaderboard visible to **all verified participants**; also shows each participant's rank.
- Personal history, totals, and charts.
- Participant chat with reporting, self-delete, and TAN staff moderation.
- Private TAN staff section exporting daily entries to Excel-compatible CSV, including name and email.
- A **fictional interactive design preview** at `preview.html` (or `index.html?demo=1`). Preview changes are not saved.

**Important limitations of this first iteration:** Daily step counts are self-reported (no wearable verification). Leaderboard totals span this single challenge instance; there is no date-range segmentation/reset control yet. There is no private messaging, staff announcement pinning, or automatic spam detection. Staff can review the latest 60 reports. Staff accounts are provisioned in the Firebase Console, not through a public form. Authentication depends on email verification. Users cannot change their display name through the app, so contact TAN staff if a correction is necessary.

## Firebase setup — do these steps before publishing

### 1. Enable sign-in

1. Open <https://console.firebase.google.com/project/step-challenge-89f8e/authentication>
2. Click **Get started**, then **Sign-in method**.
3. Enable **Email/Password** (not the passwordless email-link option), then **Save**.
4. Open **Settings → Authorized domains**. When you create the GitHub Pages site, add `moniquebatson81.github.io` if it is not already listed. Add only domains you actually control.

### 2. Create the database, then publish security rules

1. Open <https://console.firebase.google.com/project/step-challenge-89f8e/firestore>
2. Click **Create database**, select **Standard edition** and a suitable US location (for example, `nam5` if available), and choose **Production mode** (deny by default). Check that the project is on the **Spark** plan.
3. Once provisioned, open **Firestore Database → Rules**.
4. Replace the editor contents with the entire contents of `firestore.rules` from this project, then click **Publish**. Do **not** use Test mode or an `allow read, write: if true` rule.
5. If Firebase reports a rules syntax error, do not loosen the security rules; resolve the error before allowing participants to register.

### 3. Create a TAN staff account

1. Open the deployed website, register with a TAN-controlled email address, and verify the email.
2. In Firebase Console → **Authentication → Users**, copy that account's **User UID**. It is *not* the email address.
3. In **Firestore Database → Data**, create the top-level collection `admins` and a document whose ID is exactly that UID; add a field `role` (string) with value `admin`.
4. Sign out and sign back in (or refresh) to see the **TAN staff** tab.

**Only someone with Firebase Console access should create `admins` documents.** Do not include staff UID lists in website source code.

### 4. Host on GitHub Pages

A new GitHub repository is needed; do **not** upload these files into an unrelated TAN project. Suggested name: `tan-step-challenge`.

1. At <https://github.com/new>, create an **empty public repository** named `tan-step-challenge` under the appropriate GitHub account. GitHub Pages on the standard free plan supports public repositories. Don't enable GitHub Pages for a private repo on a plan that does not support it.
2. Put these files at the repo root: `index.html`, `styles.css`, `app.js`, `firebase-config.js`, `preview.html`, `preview.js`, and optionally `README.md` and `firestore.rules`. The rules file is for configuring Firebase; it does **not** deploy itself to Firebase when uploaded to GitHub.
3. In GitHub repository **Settings → Pages**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. The resulting URL should be `https://moniquebatson81.github.io/tan-step-challenge/` if created in that account.
5. Visit `https://moniquebatson81.github.io/tan-step-challenge/preview.html` to review the fictional design without registering.
6. Once Firebase configuration is complete, visit the URL without `?demo=1` and test with your staff account. Only then invite a small test group.

Note: the Firebase web config in `firebase-config.js` is a public client identifier, **not** a secret. Access is protected by Firebase Authentication and published Firestore security rules. Never commit a Firebase Admin SDK service account JSON or private key to GitHub.

## Prelaunch security and function checklist

- [ ] Spark free plan confirmed. **Do not enable billing or Blaze.**
- [ ] Authentication Email/Password enabled; website domain authorized.
- [ ] Firestore created in Production mode and `firestore.rules` successfully published.
- [ ] Create two test accounts and verify both emails.
- [ ] Each participant can edit their own daily steps, including corrections. Step totals update exactly once per date.
- [ ] Each participant sees the shared leaderboard and chat but cannot read other participants' emails, names, or daily detail records.
- [ ] Different test account cannot edit another person's step records via Firestore client.
- [ ] An unverified account cannot read chat or submit steps.
- [ ] Staff account can download CSV and remove reported messages; an ordinary account cannot see staff functions or retrieve admin-only data.
- [ ] Test at least one report and moderation action.
- [ ] On desktop and phone, review the text, accessibility, and brand styling. Confirm dates and challenge rules with TAN.
- [ ] Review Firestore **Usage** dashboard and Firebase Authentication quotas before and during launch.
- [ ] Publish a clear participant privacy notice, retention policy, and moderation/contact process approved by TAN before enrolling real participants.

## Data structure

- `users/{firebaseUID}`: private name, email, and display name.
- `leaderboard/{firebaseUID}`: participant-visible display name, cumulative total, days logged.
- `stepLogs/{firebaseUID}/days/{YYYY-MM-DD}`: private daily submission.
- `messages/{autoID}`: participant chat visible only to verified signed-in participants.
- `reports/{reporterUID_messageID}`: private chat reports, staff review.
- `admins/{firebaseUID}`: console-provisioned TAN staff access.

Firestore rules require each daily step write and its leaderboard-total update to happen together in a **transaction**, reducing inconsistency and preventing users from arbitrarily editing their leaderboard totals. A participant can still *self-report* an inaccurate step number, because that is inherent to self-reporting.

## Free-tier considerations

Firestore free-tier quotas can be exhausted by a busy real-time chat; chat subscribes to only the latest 40 messages and only while the Community tab is open. This is appropriate as an initial pilot around 60 people, **not** a promise of unlimited usage. Keep the project on the Spark plan so quota exhaustion causes service unavailability rather than unexpected billing. Firebase usage limits and terms can change.

## Maintenance

This is a first iteration rather than a final production launch. Before running a second challenge, add an admin-configurable challenge date range and archive/reset process so scores do not roll over between events. Consider spam controls and retention/deletion workflows if the community grows.