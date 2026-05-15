# SubTrack AI

A clean Expo + Firebase subscription tracker MVP with Material-style screens,
anonymous Firebase Auth, Firestore realtime sync, rule-based smart alerts, and
Expo local renewal reminders.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in the `EXPO_PUBLIC_FIREBASE_*` values from a Firebase web app.
3. `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` is optional and is only used for web analytics.
4. Enable Anonymous Auth and Firestore in Firebase Console.
5. Start the app with `npm start`.

## Scripts

- `npm start` - start Expo for Expo Go
- `npm run web` - start the web target
- `npm run lint` - run Expo lint
- `npm run typecheck` - run TypeScript
- `npm test` - run unit tests

## Firebase

Firestore rules live in `firestore.rules`. The app writes `users/{uid}` and
top-level `subscriptions` documents scoped by `userId`.
