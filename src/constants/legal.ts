export type LegalSection = {
  title: string;
  body: string[];
};

export type LegalPage = {
  title: string;
  subtitle: string;
  updatedAt: string;
  sections: LegalSection[];
};

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@subtrack.app';

export const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How SubTrack collects, uses, and protects information',
    updatedAt: 'May 14, 2026',
    sections: [
      {
        title: 'Information we collect',
        body: [
          'SubTrack may collect account information such as your name, email address, and sign-in provider profile when you create or access an account.',
          'The app stores the information you add, including subscriptions, expenses, split friend details, invoices, amounts, due dates, renewal dates, notes, payment terms, currency, theme, and reminder preferences.',
          'When you use photo-based import features, SubTrack may ask for access to selected photos. The app does not request camera, microphone, video, or broad external storage permissions.',
        ],
      },
      {
        title: 'How we use information',
        body: [
          'We use information to provide core app features such as sign-in, subscription tracking, expense tracking, invoice creation, split reminders, notifications, preferences, and app security.',
          'We may also use app activity, diagnostics, and device information to improve reliability, prevent abuse, and maintain the service.',
        ],
      },
      {
        title: 'Advertising and third-party services',
        body: [
          'SubTrack uses Google AdMob and the Google Mobile Ads SDK to show ads. Google and its partners may process device, app, advertising ID, diagnostics, and ad interaction information to serve, measure, and improve ads.',
          'SubTrack also uses services such as Firebase, Google Sign-In, Expo services, and device operating-system services for authentication, storage, notifications, updates, diagnostics, and app operation.',
          'These third-party services process information according to their own privacy policies and platform rules.',
        ],
      },
      {
        title: 'Sharing',
        body: [
          'SubTrack does not sell your personal information.',
          'Information may be shared with service providers only as needed to operate app features, comply with law, protect users, prevent abuse, or complete actions you request such as sharing an invoice or reminder.',
        ],
      },
      {
        title: 'Security and retention',
        body: [
          'We use reasonable safeguards to protect app data, but no transmission or storage method is completely secure.',
          'Information may be kept while your account is active or as needed to provide app features, comply with legal obligations, resolve disputes, and enforce terms.',
        ],
      },
      {
        title: 'Your choices',
        body: [
          'You can edit or delete many records directly in the app. You can also sign out, change notification settings, manage photo permissions, and manage ad personalization through your device or Google settings.',
          `For privacy questions or deletion requests, contact us at ${supportEmail}.`,
        ],
      },
      {
        title: 'Changes',
        body: [
          'We may update this Privacy Policy when app features, services, or legal requirements change. The latest version will be shown in the app.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Rules for using SubTrack',
    updatedAt: 'May 14, 2026',
    sections: [
      {
        title: 'Acceptance',
        body: [
          'By downloading, accessing, or using SubTrack, you agree to these Terms & Conditions. If you do not agree, do not use the app.',
        ],
      },
      {
        title: 'Use of the app',
        body: [
          'SubTrack is provided for personal organization, subscription tracking, expense tracking, split cost tracking, renewal reminders, and invoice preparation.',
          'You are responsible for the accuracy of the information you enter and for reviewing reminders, calculations, invoices, taxes, and shared messages before relying on or sending them.',
        ],
      },
      {
        title: 'Accounts and security',
        body: [
          'You are responsible for keeping your device, account, and sign-in credentials secure.',
          'You must not misuse the app, attempt unauthorized access, interfere with the service, manipulate ads, or use SubTrack for illegal or harmful activity.',
        ],
      },
      {
        title: 'Financial information',
        body: [
          'SubTrack is not a bank, payment processor, tax advisor, legal advisor, or financial advisor.',
          'Calculations, summaries, reminders, split expenses, and invoices are informational tools only. You should verify important financial information independently.',
        ],
      },
      {
        title: 'Ads and third-party services',
        body: [
          'SubTrack may display ads and use third-party services. Ads are intended to be distinguishable from app content and must not be clicked fraudulently or manipulated.',
          'Third-party services, links, SDKs, and ads are not controlled by SubTrack and may be subject to separate terms and policies.',
        ],
      },
      {
        title: 'Availability and changes',
        body: [
          'SubTrack may change, suspend, or discontinue features at any time. The app is provided as available and may be affected by network, device, store, or third-party service issues.',
        ],
      },
      {
        title: 'Limitation of liability',
        body: [
          'To the maximum extent allowed by law, SubTrack is not liable for indirect, incidental, special, consequential, or punitive damages, or for losses related to inaccurate data, missed reminders, failed messages, service interruptions, or third-party services.',
        ],
      },
      {
        title: 'Contact',
        body: [
          `Questions about these terms can be sent to ${supportEmail}.`,
        ],
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    subtitle: 'Support and app information',
    updatedAt: 'May 14, 2026',
    sections: [
      {
        title: 'Support',
        body: [
          `Email: ${supportEmail}`,
          'When contacting support, include your app version, device model, Android or iOS version, and a short description of the issue.',
        ],
      },
      {
        title: 'App information',
        body: [
          'App name: SubTrack',
          'Android package: com.subtrackapp.android',
          'iOS bundle identifier: com.subtrackapp.ios',
          'Version: 1.1.0',
        ],
      },
      {
        title: 'Publishing notes',
        body: [
          'Before publishing, add your public Privacy Policy URL and support email in Google Play Console and App Store Connect.',
          'Make sure store data disclosure forms match the features enabled in the release build, including sign-in, Firebase, notifications, selected photo access, invoice sharing, and AdMob ads.',
        ],
      },
    ],
  },
} satisfies Record<string, LegalPage>;

export type LegalPageId = keyof typeof legalPages;
