import { TX_EMAIL_BRAND_LOGO_URL as SPLIT_REMINDER_LOGO_URL, TX_EMAIL_FONT as EMAIL_FONT, TX_EMAIL_PALETTE as BRAND } from '@/constants/transactionalEmail';
import { postGoogleMailJson } from '@/services/googleMailScript';
import { requestNotificationPermission } from '@/services/notifications';
import { Linking } from 'react-native';

type SplitParticipant = {
  name?: string;
  amount?: number;
  email?: string;
  details?: string;
};

function safe(v: string) {
  return v.replace(/\r?\n/g, ' ').trim();
}

/** Dynamic values in HTML must be escaped (names, notes, titles). */
function escapeHtml(v: string) {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SendReminderResult = 'sent' | 'draft' | 'failed' | 'skipped';

type ReminderParams = {
  expenseName: string;
  totalAmount: number;
  currencySymbol: string;
  dateIso: string;
  splitType?: 'equal' | 'custom';
  participants: SplitParticipant[];
};

function buildIndividualReminder(
  params: ReminderParams,
  participant: SplitParticipant,
  /** Display index when name missing, e.g. 2 for second person on split */
  personOrdinal: number,
) {
  const dateText = new Date(params.dateIso).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const splitLabel = params.splitType === 'custom' ? 'Custom amounts' : 'Split equally';
  const totalStr = `${params.currencySymbol}${(Number(params.totalAmount) || 0).toFixed(2)}`;
  const personName = safe(participant.name || `Person ${personOrdinal}`);
  const personNameEsc = escapeHtml(personName);
  const theirAmount = Number(participant.amount) || 0;
  const theirStr = `${params.currencySymbol}${theirAmount.toFixed(2)}`;
  const detailsRaw = safe(participant.details || '');
  const detailsEsc = detailsRaw ? escapeHtml(detailsRaw) : '';
  const titleEscaped = escapeHtml(safe(params.expenseName));
  const year = new Date().getFullYear();
  const supportEmail = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '').trim();
  const supportEmailEsc = escapeHtml(supportEmail);
  const supportBlock = supportEmail
    ? `<a href="mailto:${supportEmailEsc}" style="color:${BRAND.accentDark};font-weight:600;text-decoration:none;">${supportEmailEsc}</a>`
    : '';

  const textSupportTail = supportEmail
    ? `App support: ${supportEmail}`
    : 'App questions: ask the organizer to contact SubTrack support from the app.';

  const subject = `Payment reminder: ${safe(params.expenseName)} — ${personName}`;

  const text =
    `SUBTRACK — SPLIT REMINDER (personal)\n\n` +
    `Hi ${personName},\n\n` +
    `This reminder is only for you.\n\n` +
    `Expense: ${safe(params.expenseName)}\n` +
    `Date: ${dateText}\n` +
    `${splitLabel} · Group total ${totalStr}\n\n` +
    `Your share: ${theirStr}\n` +
    (detailsRaw ? `Note: ${detailsRaw}\n` : '') +
    `\nSend this amount to whoever organized the expense.\n\n` +
    `---\n` +
    `Support — Amount questions: contact the organizer. ${textSupportTail}\n` +
    `Notice — Automated message from SubTrack. Not financial or legal advice.\n` +
    `© ${year} SubTrack`;

  const preheader = `${personName}, your share is ${theirStr} · ${safe(params.expenseName)}`;

  const footerSupportHtml = supportEmail
    ? `<p style="margin:8px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.55;color:${BRAND.muted};">Application or sign-in problems: ${supportBlock}</p>`
    : `<p style="margin:8px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.55;color:${BRAND.muted};">Application issues cannot be serviced by reply to this address. Ask the organizer to use in-app SubTrack support.</p>`;

  const logoSrc = escapeHtml(SPLIT_REMINDER_LOGO_URL);
  const masthead = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
    <tr>
      <td valign="middle" width="48" style="width:48px;padding:0;vertical-align:middle;">
        <img src="${logoSrc}" height="44" alt="" style="display:block;height:44px;width:auto;max-width:132px;border:0;outline:none;text-decoration:none;border-radius:10px;line-height:0;" />
      </td>
      <td valign="middle" style="padding:0 0 0 14px;vertical-align:middle;">
        <div style="margin:0;padding:0;font-family:${EMAIL_FONT};font-size:18px;font-weight:600;letter-spacing:-0.03em;line-height:1.15;color:${BRAND.ink};">SubTrack</div>
        <div style="margin:5px 0 0 0;padding:0;font-family:${EMAIL_FONT};font-size:10px;font-weight:500;letter-spacing:0.12em;line-height:1.2;text-transform:uppercase;color:${BRAND.mutedLight};">Personal payment reminder</div>
      </td>
    </tr>
  </table>`;

  const yourShareBlock = `
                <tr>
                  <td style="padding:14px 18px 0 18px;">
                    <p style="margin:0 0 6px 0;font-family:${EMAIL_FONT};font-size:13px;line-height:1.5;color:${BRAND.body};">Hi ${personNameEsc},</p>
                    <p style="margin:0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${BRAND.body};">This message was sent only to you. Please pay the amount below to the expense organizer.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px 0 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BRAND.wash};border-radius:12px;border:1px solid ${BRAND.line};">
                      <tr>
                        <td style="padding:16px 18px;font-family:${EMAIL_FONT};">
                          <div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};">Your share</div>
                          <div style="margin:8px 0 0;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:${BRAND.accentDark};">${theirStr}</div>
                          ${detailsEsc ? `<div style="margin:10px 0 0;font-size:13px;line-height:1.45;color:${BRAND.muted};">Reference: ${detailsEsc}</div>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px 0 18px;">
                    <h1 style="margin:0;padding:0;font-family:${EMAIL_FONT};font-size:17px;font-weight:600;line-height:1.35;letter-spacing:-0.02em;color:${BRAND.ink};">${titleEscaped}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px 16px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${EMAIL_FONT};font-size:12px;line-height:1.4;">
                      <tr>
                        <td style="padding:7px 0;color:${BRAND.muted};vertical-align:top;width:40%;">Date</td>
                        <td style="padding:7px 0;text-align:right;color:${BRAND.ink};font-weight:500;vertical-align:top;">${escapeHtml(dateText)}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:${BRAND.muted};vertical-align:top;border-top:1px solid ${BRAND.line};">Split</td>
                        <td style="padding:7px 0;text-align:right;color:${BRAND.ink};font-weight:500;vertical-align:top;border-top:1px solid ${BRAND.line};">${splitLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:${BRAND.muted};vertical-align:top;border-top:1px solid ${BRAND.line};">Group total</td>
                        <td style="padding:7px 0;text-align:right;font-weight:600;font-size:13px;font-variant-numeric:tabular-nums;color:${BRAND.ink};vertical-align:top;border-top:1px solid ${BRAND.line};">${totalStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titleEscaped}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.wash};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.wash};opacity:0;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.wash};border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
    <tr>
      <td align="center" style="padding:16px 12px 24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;">
          <tr>
            <td style="padding:0 4px 14px 4px;border-bottom:1px solid ${BRAND.line};">
              ${masthead}
              <p style="margin:12px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;line-height:1.2;text-transform:uppercase;color:${BRAND.mutedLight};">Official · Payment coordination</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BRAND.surface};border:1px solid ${BRAND.line};border-top:3px solid ${BRAND.accent};">
                ${yourShareBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 4px 0 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 12px 0;font-family:${EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;line-height:1.2;text-transform:uppercase;color:${BRAND.muted};">Support</td>
                </tr>
                <tr>
                  <td style="padding:0;">
                    <p style="margin:0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.55;color:${BRAND.muted};">Wrong amount or duplicate notice? Reply to whoever sent this reminder (the organizer).</p>
                    ${footerSupportHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0 0;font-family:${EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;line-height:1.2;text-transform:uppercase;color:${BRAND.muted};">Notice</td>
                </tr>
                <tr>
                  <td style="padding:0;">
                    <p style="margin:8px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.55;color:${BRAND.muted};">
                      Transactional coordination message generated by SubTrack when a participant requests a reminder. Not legal, tax, or financial advice.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0 0;font-family:${EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;line-height:1.2;text-transform:uppercase;color:${BRAND.muted};">Why you received this</td>
                </tr>
                <tr>
                  <td style="padding:0;">
                    <p style="margin:8px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.55;color:${BRAND.muted};">Your email was listed for your share on this split expense. If this was unintended, alert the organizer to update their SubTrack participant list.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:24px 0 0;border-top:1px solid ${BRAND.line};">
                    <p style="margin:0;padding:0;font-family:${EMAIL_FONT};font-size:11px;line-height:1.5;color:${BRAND.mutedLight};"><strong style="font-weight:600;color:${BRAND.ink};">SubTrack</strong></p>
                    <p style="margin:4px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:10px;line-height:1.5;color:${BRAND.mutedLight};">Subscriptions · shared bills · invoicing helpers</p>
                    <p style="margin:10px 0 0;padding:0;font-family:${EMAIL_FONT};font-size:10px;line-height:1.5;color:${BRAND.mutedLight};">© ${year} SubTrack · All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, htmlBody };
}

/** Sends one personalized reminder email per non-owner participant who has an email (no shared To: list). */
export async function sendSplitExpenseReminderEmail(params: ReminderParams): Promise<SendReminderResult> {
  const targets = params.participants.reduce<{
    participant: SplitParticipant;
    personOrdinal: number;
    email: string;
  }[]>((acc, p, index) => {
    if (index === 0) return acc;
    const email = (p.email || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      acc.push({ participant: p, personOrdinal: index + 1, email });
    }
    return acc;
  }, []);

  if (targets.length === 0) return 'skipped';

  let anyScriptOk = false;
  let anyMailtoOk = false;

  for (let i = 0; i < targets.length; i++) {
    const { participant, personOrdinal, email } = targets[i];
    const { subject, text, htmlBody } = buildIndividualReminder(params, participant, personOrdinal);

    if (await postGoogleMailJson({ to: [email], subject, textBody: text, htmlBody })) {
      anyScriptOk = true;
      continue;
    }

    try {
      const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        anyMailtoOk = true;
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 750));
        }
      }
    } catch {
      /* next recipient */
    }
  }

  if (anyScriptOk) return 'sent';
  if (anyMailtoOk) return 'draft';
  return 'failed';
}

export function isExpenseReminderConfigured() {
  return true;
}

export async function scheduleSplitReminderAlarm(params: {
  expenseName: string;
  dateIso: string;
}) {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return false;

    const Notifications = await import('expo-notifications');
    const parsed = new Date(params.dateIso);
    const now = new Date();

    // Build a safe future date trigger (iOS crashes on invalid/past date triggers).
    let target = Number.isNaN(parsed.getTime()) ? new Date(now) : new Date(parsed);
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    if (target <= now) {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${safe(params.expenseName)}`,
          body: 'Follow up with split participants for payment.',
          sound: true,
          data: { type: 'split_expense_reminder_again' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
        },
      });
      return true;
    } catch {
      // Fallback: interval trigger is more tolerant on some iOS states.
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${safe(params.expenseName)}`,
          body: 'Follow up with split participants for payment.',
          sound: true,
          data: { type: 'split_expense_reminder_again' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 3600,
          repeats: false,
        },
      });
      return true;
    }
  } catch {
    return false;
  }
}
