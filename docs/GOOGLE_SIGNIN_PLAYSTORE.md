# Google Sign-In Play Store Setup

If the Play Store build shows `DEVELOPER_ERROR` for Google Sign-In, the installed app is signed with a certificate that is not registered for the Android OAuth client.

## Fix

1. Open Google Play Console.
2. Go to your app, then `Test and release` -> `Setup` -> `App signing`.
3. Copy the SHA-1 and SHA-256 from `App signing key certificate`.
4. Open Firebase Console -> Project settings -> Your Android app `com.subtrackapp.android`.
5. Add both SHA fingerprints.
6. Download the updated `google-services.json`.
7. Replace the root `google-services.json` in this project.
8. Rebuild a production AAB and upload it to Play Store.

## Current registered Android SHA-1 hashes

The current `google-services.json` has these Android OAuth SHA-1 hashes:

- `52:6E:35:3A:4F:93:C9:04:F5:E9:02:5B:E8:B5:C9:4A:BB:94:DB:AE`
- `9F:F0:55:05:CA:B4:F8:DF:BE:EA:22:46:2A:18:A5:20:58:EF:B5:BF`
- `05:89:07:70:05:9B:E4:F5:6F:EA:8A:29:CD:BB:CE:1E:F0:9F:A5:6E`

If the Play Console `App signing key certificate` SHA-1 is different from these, Google Sign-In will fail on the Play Store install with `DEVELOPER_ERROR`.

## Play Console production certificate to add

Your Play Store installed production app is signed by this Google Play App Signing certificate:

- SHA-1: `05:89:07:70:05:9B:E4:F5:6F:EA:8A:29:CD:BB:CE:1E:F0:9F:A5:6E`
- SHA-256: `1C:BF:B2:1A:20:29:5F:01:01:2F:13:BA:F4:DB:EF:F3:EE:24:C2:67:83:2B:CC:8A:CF:40:C2:47:CB:66:3F:AE`

This SHA-1 is now present in the current `google-services.json`.

Your upload key SHA-1 is already present:

- SHA-1: `9F:F0:55:05:CA:B4:F8:DF:BE:EA:22:46:2A:18:A5:20:58:EF:B5:BF`

## Notes

- The upload key SHA and Play App Signing SHA can be different. A Play Store installed AAB needs the Play App Signing certificate registered.
- Keep using the web OAuth client ID in `src/services/googleAuth.ts`; Firebase Auth requires the web client ID for the ID token flow.
- After replacing `google-services.json`, the native app must be rebuilt. An OTA update cannot change this native config.

## Production-level test before public rollout

You cannot fully verify Play App Signing Google Sign-In with a locally installed APK. Local installs are signed with your local/upload key, while Play Store installs are signed by Google with the App Signing key.

Use the Play Console internal testing track:

1. Build a fresh production AAB after replacing `google-services.json`:

   ```sh
   eas build --platform android --profile production
   ```

2. Upload the AAB to Play Console internal testing.
3. Add your tester Gmail account to the internal testing testers list.
4. Install the app from the Play Store internal testing link, not by sideloading.
5. Uninstall any old sideloaded/dev app first if needed.
6. Open the Play-installed app and tap `Continue with Google`.
7. Confirm the app signs in and Firebase Console -> Authentication -> Users shows/updates the Google user.

If this works in internal testing, the same signing path is used for production rollout.

Avoid using Internal App Sharing as the main verification path for this bug. It can use a different signing certificate, so it may not prove the production App Signing key path.
