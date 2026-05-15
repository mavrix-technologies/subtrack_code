type MailPayload = {
  to: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
};

/** POST to Google Apps Script web app deployed for MailApp relay. Returns true only on HTTP OK. */
export async function postGoogleMailJson(payload: MailPayload): Promise<boolean> {
  const url = (process.env.EXPO_PUBLIC_GOOGLE_MAIL_SCRIPT_URL || '').trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
