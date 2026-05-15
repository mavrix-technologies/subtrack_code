# Remote In-App Banner

SubTrack supports a Spotify-style in-app banner controlled from Firebase Firestore.

Create or edit this document in Firebase Console:

```txt
appConfig/homeBanner
```

## Fields

```txt
enabled: true
id: "invoice-tools"
version: 1
title: "New invoice tools"
message: "Create and share professional invoices faster."
imageUrl: "https://your-domain.com/banner.png"
buttonText: "Try now"
actionRoute: "/invoices"
backgroundColor: "#111827"
textColor: "#FFFFFF"
buttonColor: "#F97316"
platforms: ["android", "ios"]
minAppVersion: "1.0.0"
maxAppVersion: "1.1.999"
```

Optional date fields:

```txt
startsAt: Firestore timestamp
endsAt: Firestore timestamp
```

## Behavior

- Users see the banner on Home while signed in.
- Users can close it.
- Close state is saved per user, campaign `id`, and `version`.
- Increase `version` to show the same campaign again.
- Set `enabled` to `false` to hide it remotely.
- Use `actionRoute` for internal app routes such as `/add`, `/subscriptions`, `/expenses`, `/invoices`.
- Use `actionUrl` instead of `actionRoute` for external links.
- Use `minAppVersion` and `maxAppVersion` to target only specific app versions. Builds that do not have version targeting support will ignore these fields and show the banner if the rest of the campaign is active.

## New Version Alert Example

Use this for a v1.2 release reminder aimed at v1.0 and v1.1 users:

```txt
enabled: true
id: "update-v1-2"
version: 1
title: "New version available"
message: "SubTrack v1.2 is ready with analytics reporting, fixes, and a smoother Play Store build. Please update from Google Play."
buttonText: "Update now"
actionUrl: "https://play.google.com/store/apps/details?id=com.subtrackapp.android"
backgroundColor: "#111827"
textColor: "#FFFFFF"
buttonColor: "#F97316"
platforms: ["android"]
minAppVersion: "1.0.0"
maxAppVersion: "1.1.999"
```

## OTA Fallback For Old Builds

If an already-installed build does not include the remote banner reader, Firestore cannot show the banner by itself. Use the built-in `LegacyUpdateAlert` component and ship it with EAS Update to the old runtime.

Because this project uses:

```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

OTA updates only reach builds with the same app version/runtime. To alert v1.1 users, publish an update while `expo.version` is `1.1.0`. To alert v1.0 users, publish again while `expo.version` is `1.0.0`.

Example for v1.1 users:

```sh
npx eas-cli@latest update --branch production --message "Show update alert for v1.1 users"
```

Then temporarily set `expo.version` to `1.0.0` and publish a second update for v1.0 users:

```sh
npx eas-cli@latest update --branch production --message "Show update alert for v1.0 users"
```

Do not include new native-only features in these OTA bundles. The update alert is JS-only and safe for the old binaries.

## Firestore Rules

The app can read `appConfig/*` while signed in. Client writes are blocked.
Manage campaigns from Firebase Console or trusted admin tooling.
