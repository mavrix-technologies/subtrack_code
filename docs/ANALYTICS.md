# Analytics

SubTrack sends Google Analytics for Firebase events through `src/services/analytics.ts`.

## Setup

- Android uses `google-services.json` from `app.json`.
- iOS uses `GoogleService-Info.plist` from `app.json`.
- Web uses `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`.
- Native app events require a development or production build. Expo Go cannot load React Native Firebase Analytics.

After changing native analytics packages, rebuild the app:

```sh
npx expo prebuild --clean
npx expo run:android
```

For EAS, create a new build so the Firebase native modules are included.

## Core Events

- `screen_view`
- `login`
- `logout`
- `sign_up`
- `subscription_created`
- `subscription_updated`
- `subscription_deleted`
- `expense_created`
- `expense_updated`
- `expense_deleted`
- `invoice_created`
- `invoice_updated`
- `invoice_deleted`
- `invoice_payment_recorded`
- `rewarded_ad_requested`
- `rewarded_ad_loaded`
- `rewarded_ad_finished`
- `rewarded_ad_unavailable`
- `magic_import_started`
- `magic_import_completed`
- `magic_import_failed`
- `notifications_toggled`
