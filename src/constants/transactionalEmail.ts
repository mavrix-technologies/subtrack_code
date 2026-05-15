/** Colors and assets shared by SubTrack transactional HTML (reminders, invoice mail). */
export const TX_EMAIL_PALETTE = {
  ink: '#111827',
  surface: '#ffffff',
  muted: '#6b7280',
  mutedLight: '#9ca3af',
  line: '#e5e7eb',
  accent: '#f97316',
  accentDark: '#ea580c',
  body: '#374151',
  wash: '#f9fafb',
} as const;

export const TX_EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Public CDN URL for the logo in HTML emails (matches in-app branding). */
export const TX_EMAIL_BRAND_LOGO_URL =
  'https://res.cloudinary.com/djqq8kba8/image/upload/v1778582653/SubTrack_Icon_pearon.png';
