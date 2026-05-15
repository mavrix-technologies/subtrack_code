# GitHub Actions Play Store Build

This project can build the Android Play Store `.aab` with GitHub Actions on Ubuntu. OTA behavior stays tied to the existing EAS project because `app.json` keeps:

```txt
extra.eas.projectId = ae2081a2-50e2-4d75-9df7-ef7878e73c98
updates.url = https://u.expo.dev/ae2081a2-50e2-4d75-9df7-ef7878e73c98
```

## One-Time Setup

Create an Expo access token:

```sh
npx eas-cli@latest whoami
npx eas-cli@latest token:create
```

In GitHub, add it as a repository secret:

```txt
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
Name: EXPO_TOKEN
Value: <the token from eas token:create>
```

The workflow uses EAS remote credentials for the Android signing key, so the Play Store signing continuity is preserved.

If the build fails with `An Expo user account is required to proceed`, the `EXPO_TOKEN` repository secret is missing, empty, or unavailable to that workflow run. Recreate the token with an Expo account that can access this EAS project, save it again as `EXPO_TOKEN`, then rerun the workflow.

## Run The Build

1. Push this repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Actions`.
4. Select `Android Play Store Build`.
5. Click `Run workflow`.
6. Wait for the build to finish.
7. Download the `subtrack-playstore-aab` artifact from the completed run.

Upload the `.aab` to Google Play Console.

## Notes

- The workflow file is `.github/workflows/android-playstore-build.yml`.
- It runs `eas build --platform android --profile production --local`.
- It outputs an Android App Bundle, not an APK.
- Future v1.2 users will receive OTA updates from the same Expo project and `production` channel.
