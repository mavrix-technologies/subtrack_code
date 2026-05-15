import { TX_EMAIL_BRAND_LOGO_URL, TX_EMAIL_FONT, TX_EMAIL_PALETTE as P } from '@/constants/transactionalEmail';
import type { InvoiceData } from '@/utils/invoiceTemplates';
import { Linking } from 'react-native';
import { postGoogleMailJson } from '@/services/googleMailScript';

export type InvoiceShareEmailResult = 'sent' | 'draft' | 'failed' | 'skipped';

function safe(v: string) {
  return v.replace(/\r?\n/g, ' ').trim();
}

function escapeHtml(v: string) {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Email a concise invoice summary (same relay as split reminders). */
export async function sendInvoiceShareEmail(params: {
  invoice: InvoiceData;
  currencySymbol: string;
  /** When set, overrides Bill To email for delivery only. */
  toEmail?: string;
}): Promise<InvoiceShareEmailResult> {
  const invoice = params.invoice;
  const recipient = (params.toEmail?.trim() || invoice.clientEmail || '').trim();
  if (!recipient.includes('@')) return 'skipped';

  const sym = params.currencySymbol;
  const invLabel = invoice.invoiceNumber?.trim() || `#${invoice.id.slice(0, 8).toUpperCase()}`;
  const business = safe(invoice.businessName || 'SubTrack');
  const subject = `${invLabel} — Invoice from ${business}`;

  const clientNameEsc = escapeHtml(safe(invoice.clientName || 'Client'));
  const logoSrc = escapeHtml(TX_EMAIL_BRAND_LOGO_URL);
  const year = new Date().getFullYear();
  const supportEmail = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '').trim();
  const supportEmailEsc = escapeHtml(supportEmail);
  const supportLink = supportEmail
    ? `<a href="mailto:${supportEmailEsc}" style="color:${P.accentDark};font-weight:600;text-decoration:none;">${supportEmailEsc}</a>`
    : '';
  const footerSupportHtml = supportEmail
    ? `<p style="margin:8px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:11px;line-height:1.55;color:${P.muted};">SubTrack support: ${supportLink}</p>`
    : `<p style="margin:8px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:11px;line-height:1.55;color:${P.muted};">SubTrack technical help is available through the sender’s SubTrack account.</p>`;

  const items = invoice.items || [];
  const itemRowsTxt = items
    .map((it) => {
      const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
      const desc = it.description ? ` (${safe(it.description)})` : '';
      return `  • ${safe(it.name)}${desc}  ×${it.qty}  ${sym}${line.toFixed(2)}`;
    })
    .join('\n');

  const text =
    `${subject}\n\n` +
    `Please review the summary below. A separate PDF can be sent if your sender attaches one.\n\n` +
    `Bill to: ${safe(invoice.clientName || 'Client')}\n` +
    `Issue date: ${fmtDate(invoice.date)}\n` +
    `Due: ${invoice.dueDate ? fmtDate(invoice.dueDate) : '—'}\n` +
    `Status: ${safe(invoice.status)}\n\n` +
    `Line items\n${itemRowsTxt || '  (none)'}\n\n` +
    `Subtotal ${sym}${(Number(invoice.subtotal) || 0).toFixed(2)}\n` +
    (invoice.discountAmount > 0 ? `Discount -${sym}${invoice.discountAmount.toFixed(2)}\n` : '') +
    (invoice.taxAmount > 0 ? `Tax ${sym}${invoice.taxAmount.toFixed(2)}\n` : '') +
    `Total ${sym}${(Number(invoice.total) || 0).toFixed(2)}\n` +
    (invoice.amountPaid > 0 ? `Paid ${sym}${invoice.amountPaid.toFixed(2)}\n` : '') +
    (invoice.balanceDue > 0.01 ? `Balance due ${sym}${invoice.balanceDue.toFixed(2)}\n` : '') +
    (invoice.notes ? `\nNotes\n${safe(invoice.notes)}\n` : '') +
    (invoice.terms ? `\nTerms\n${safe(invoice.terms)}\n` : '') +
    `\n—\nSent via SubTrack. Not legal or tax advice.\n© ${year} SubTrack`;

  const itemRowsHtml = items
    .map((it, idx) => {
      const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
      const bottom = idx === items.length - 1 ? 'border-bottom:none' : `border-bottom:1px solid ${P.line}`;
      const name = escapeHtml(safe(it.name));
      const desc = it.description ? escapeHtml(safe(it.description)) : '';
      return `<tr>
        <td style="${bottom};padding:10px 8px 10px 0;font-family:${TX_EMAIL_FONT};font-size:13px;line-height:1.4;color:${P.ink};">${name}${desc ? `<div style="margin:3px 0 0;color:${P.muted};font-size:12px;">${desc}</div>` : ''}</td>
        <td style="${bottom};padding:10px 4px;text-align:center;font-family:${TX_EMAIL_FONT};font-size:12px;color:${P.muted};">${Number(it.qty) || 0}</td>
        <td style="${bottom};padding:10px 0 0 12px;text-align:right;font-family:${TX_EMAIL_FONT};font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;color:${P.ink};">${sym}${line.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const invTitleEsc = escapeHtml(safe(invLabel));
  const preheader = `${invLabel} · Total ${sym}${(Number(invoice.total) || 0).toFixed(2)} · ${business}`;

  const masthead = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
    <tr>
      <td valign="middle" width="48" style="width:48px;padding:0;vertical-align:middle;">
        <img src="${logoSrc}" height="44" alt="" style="display:block;height:44px;width:auto;max-width:132px;border:0;border-radius:10px;" />
      </td>
      <td valign="middle" style="padding:0 0 0 14px;vertical-align:middle;">
        <div style="margin:0;font-family:${TX_EMAIL_FONT};font-size:18px;font-weight:600;letter-spacing:-0.03em;color:${P.ink};">SubTrack</div>
        <div style="margin:5px 0 0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${P.mutedLight};">Invoice</div>
      </td>
    </tr>
  </table>`;

  const notesBlock =
    invoice.notes || invoice.terms
      ? `<tr>
          <td style="padding:14px 18px 0 18px;font-family:${TX_EMAIL_FONT};font-size:12px;line-height:1.5;color:${P.body};">
            ${invoice.notes ? `<p style="margin:0 0 8px 0;"><strong style="color:${P.ink};">Notes</strong><br/>${escapeHtml(safe(invoice.notes))}</p>` : ''}
            ${invoice.terms ? `<p style="margin:0;"><strong style="color:${P.ink};">Terms</strong><br/>${escapeHtml(safe(invoice.terms))}</p>` : ''}
          </td>
        </tr>`
      : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${invTitleEsc}</title>
</head>
<body style="margin:0;padding:0;background:${P.wash};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${P.wash};opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.wash};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:16px 12px 24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 14px 4px;border-bottom:1px solid ${P.line};">${masthead}
              <p style="margin:12px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${P.mutedLight};">From ${escapeHtml(business)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${P.surface};border:1px solid ${P.line};border-top:3px solid ${P.accent};">
                <tr>
                  <td style="padding:16px 18px 6px 18px;font-family:${TX_EMAIL_FONT};font-size:12px;line-height:1.5;color:${P.body};">
                    Here is your invoice summary. Request a PDF from ${escapeHtml(business)} if you need a formal copy.
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 18px 0 18px;">
                    <h1 style="margin:0;font-family:${TX_EMAIL_FONT};font-size:18px;font-weight:600;letter-spacing:-0.02em;color:${P.ink};">${invTitleEsc}</h1>
                    <p style="margin:6px 0 0;font-family:${TX_EMAIL_FONT};font-size:13px;color:${P.muted};">${clientNameEsc}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px 6px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${TX_EMAIL_FONT};font-size:12px;">
                      <tr>
                        <td style="padding:6px 0;color:${P.muted};">Issue date</td>
                        <td style="padding:6px 0;text-align:right;font-weight:500;color:${P.ink};">${escapeHtml(fmtDate(invoice.date))}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${P.muted};border-top:1px solid ${P.line};">Due date</td>
                        <td style="padding:6px 0;text-align:right;font-weight:500;color:${P.ink};border-top:1px solid ${P.line};">${invoice.dueDate ? escapeHtml(fmtDate(invoice.dueDate)) : '—'}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:${P.muted};border-top:1px solid ${P.line};">Status</td>
                        <td style="padding:6px 0;text-align:right;font-weight:500;color:${P.ink};border-top:1px solid ${P.line};">${escapeHtml(safe(invoice.status))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 18px 4px 18px;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${P.mutedLight};">Line items</td>
                </tr>
                <tr>
                  <td style="padding:0 18px 14px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid ${P.line};">
                      <thead>
                        <tr>
                          <th align="left" style="padding:8px 8px 8px 0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${P.mutedLight};border-bottom:1px solid ${P.line};">Description</th>
                          <th align="center" style="padding:8px 4px;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${P.mutedLight};border-bottom:1px solid ${P.line};width:44px;">Qty</th>
                          <th align="right" style="padding:8px 0 8px 12px;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${P.mutedLight};border-bottom:1px solid ${P.line};">Amount</th>
                        </tr>
                      </thead>
                      <tbody>${itemRowsHtml || `<tr><td colspan="3" style="padding:12px 0;font-family:${TX_EMAIL_FONT};font-size:12px;color:${P.muted};">No line items.</td></tr>`}</tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 14px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${TX_EMAIL_FONT};font-size:12px;">
                      <tr><td style="padding:6px 0;color:${P.muted};">Subtotal</td><td style="padding:6px 0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${sym}${(Number(invoice.subtotal) || 0).toFixed(2)}</td></tr>
                      ${invoice.discountAmount > 0 ? `<tr><td style="padding:6px 0;color:${P.muted};border-top:1px solid ${P.line};">Discount</td><td style="padding:6px 0;text-align:right;border-top:1px solid ${P.line};color:#059669;font-weight:600;">-${sym}${invoice.discountAmount.toFixed(2)}</td></tr>` : ''}
                      ${invoice.taxAmount > 0 ? `<tr><td style="padding:6px 0;color:${P.muted};border-top:1px solid ${P.line};">Tax</td><td style="padding:6px 0;text-align:right;font-weight:600;border-top:1px solid ${P.line};font-variant-numeric:tabular-nums;">${sym}${invoice.taxAmount.toFixed(2)}</td></tr>` : ''}
                      <tr><td style="padding:8px 0 4px 0;color:${P.ink};font-weight:700;border-top:1px solid ${P.line};">Total</td><td style="padding:8px 0 4px 0;text-align:right;font-weight:800;font-size:15px;color:${P.accentDark};border-top:1px solid ${P.line};font-variant-numeric:tabular-nums;">${sym}${(Number(invoice.total) || 0).toFixed(2)}</td></tr>
                      ${invoice.amountPaid > 0 ? `<tr><td style="padding:6px 0;color:${P.muted};">Paid</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;font-variant-numeric:tabular-nums;">${sym}${invoice.amountPaid.toFixed(2)}</td></tr>` : ''}
                      ${invoice.balanceDue > 0.01 ? `<tr><td style="padding:6px 0;color:${P.muted};font-weight:600;">Balance due</td><td style="padding:6px 0;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;color:${P.accentDark};">${sym}${invoice.balanceDue.toFixed(2)}</td></tr>` : ''}
                    </table>
                  </td>
                </tr>
                ${notesBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0 4px;">
              <p style="margin:0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${P.muted};">Support</p>
              <p style="margin:8px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:11px;line-height:1.55;color:${P.muted};">Billing questions should go to ${escapeHtml(business)}.</p>
              ${footerSupportHtml}
              <p style="margin:14px 0 0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${P.muted};">Notice</p>
              <p style="margin:8px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:11px;line-height:1.55;color:${P.muted};">Automated message from SubTrack. Not legal, tax, or financial advice. PDF attachment is optional and not included here.</p>
              <p style="margin:14px 0 0;font-family:${TX_EMAIL_FONT};font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${P.muted};">Delivery</p>
              <p style="margin:8px 0 0;padding:0;font-family:${TX_EMAIL_FONT};font-size:11px;line-height:1.55;color:${P.muted};">Your address was taken from the invoice “Bill to” field.</p>
              <p style="margin:20px 0 0;padding:12px 0 0;border-top:1px solid ${P.line};text-align:center;font-family:${TX_EMAIL_FONT};font-size:10px;color:${P.mutedLight};line-height:1.5;">© ${year} SubTrack</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  if (await postGoogleMailJson({ to: [recipient], subject, textBody: text, htmlBody })) {
    return 'sent';
  }

  try {
    const url = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    if (!(await Linking.canOpenURL(url))) return 'failed';
    await Linking.openURL(url);
    return 'draft';
  } catch {
    return 'failed';
  }
}
