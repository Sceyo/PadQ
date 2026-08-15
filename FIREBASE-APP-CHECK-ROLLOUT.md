# PADQ V1 Firebase App Check Rollout

**Purpose:** protect the public Firestore endpoint from automated abuse without unexpectedly moving PADQ off Firebase Spark or blocking legitimate hosts and viewers.

**Current code state:** the Firebase web client already initializes `ReCaptchaEnterpriseProvider` only when both production environment variables below are present. Emulator tests bypass App Check.

## Free-plan boundary

- Firebase lists App Check as no-cost, subject to the selected attestation provider's quota.
- Google's current no-billing reCAPTCHA allowance is 10,000 assessments per month. A project without billing does not begin charging after the allowance; new assessments fail until the allowance resets.
- Do not attach a billing account for V1 merely to enable App Check.
- Token reuse means one page action is not necessarily one assessment, but the App Check metrics and reCAPTCHA usage page must still be reviewed after launch.

Official references:

- [Firebase App Check pricing](https://firebase.google.com/pricing)
- [Firebase web App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Monitor App Check request metrics](https://firebase.google.com/docs/app-check/monitor-metrics)
- [Enable App Check enforcement](https://firebase.google.com/docs/app-check/enable-enforcement)
- [reCAPTCHA billing and no-billing behavior](https://docs.cloud.google.com/recaptcha/docs/billing-information)

## Phase A — register without enforcement

- [ ] In Firebase Console, open **Security → App Check → Apps** for project `padq-ccb6a`.
- [ ] Select the PADQ web app and register the reCAPTCHA Enterprise provider.
- [ ] Register the production hostname `pad-q.vercel.app`.
- [ ] If PADQ later receives a custom domain, register it before routing users to it.
- [ ] Keep Vercel Preview and Development environments disabled unless their exact hostnames are intentionally registered. Local emulator tests do not need a production token.
- [ ] Copy only the public site key. Never place a secret key in a `NEXT_PUBLIC_` variable.

## Phase B — deploy in monitoring mode

Add these Vercel variables to **Production** only:

```text
NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true
NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=<public site key>
```

- [ ] Redeploy the exact release-candidate commit after the variables are saved.
- [ ] Do **not** enable Firestore enforcement yet.
- [ ] Test on the real production hostname in a normal window and a private/incognito window.
- [ ] Verify: create a room, go live, join as a viewer, change a score, correct it, commit a result, refresh both pages, and delete the event.
- [ ] In **Security → App Check → APIs → Cloud Firestore**, confirm those requests appear as **Verified**.
- [ ] Investigate any legitimate request reported as outdated, unknown, or invalid before continuing.

## Phase C — enforce Firestore

- [ ] Enable enforcement for **Cloud Firestore only** after production host and viewer flows are verified.
- [ ] Wait at least 15 minutes for enforcement to propagate.
- [ ] Repeat the production smoke flow above.
- [ ] Confirm an ordinary production browser still creates, views, updates, refreshes, and deletes a room.
- [ ] Confirm a deliberately unregistered test client is rejected.
- [ ] Record the date, release commit, screenshots of verified metrics, and the operator who enabled enforcement in `V1-PUBLIC-RELEASE-TASKS.md`.

## Stop/rollback conditions

Immediately turn Firestore enforcement back off while investigating if any of these occurs:

- valid production browsers become unable to authenticate or read/write rooms;
- verified traffic drops unexpectedly after a deployment;
- the reCAPTCHA no-billing quota approaches exhaustion;
- the production hostname changes without being registered;
- the site key is missing from the Vercel Production environment.

Disabling enforcement is the availability rollback. It does not replace Firestore Security Rules; ownership and schema rules remain the primary authorization boundary.
