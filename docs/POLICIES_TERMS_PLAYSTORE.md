# SubTrack Legal Pages

Last updated: May 14, 2026

SubTrack keeps the standard app pattern:

- Privacy Policy
- Terms & Conditions
- Contact Us

Ads, data disclosure notes, permissions, and third-party service information are included inside the Privacy Policy and Terms & Conditions instead of separate in-app pages.

## Store checklist

- Add a public Privacy Policy URL in Google Play Console and App Store Connect.
- Add a real support email in Google Play Console and App Store Connect.
- Set the production support email before release:

```env
EXPO_PUBLIC_SUPPORT_EMAIL=your-support-email@example.com
```

- Make sure store data disclosure forms match the release build features: sign-in, Firebase, notifications, selected photo access, invoice sharing, split reminders, and AdMob ads.
