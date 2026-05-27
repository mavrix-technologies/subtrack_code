// ─────────────────────────────────────────────────────────────────────────────
// invoiceTemplates.ts  —  single source of truth for all invoice HTML
//
// To add a template: add an entry to TEMPLATES + THEMES. Nothing else changes.
// To edit shared layout (items, totals, signature, footer): edit the builders.
// ─────────────────────────────────────────────────────────────────────────────

// ── Public types ──────────────────────────────────────────────────────────────

export type InvoiceData = {
  invoiceNumber: string;
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  date: string;
  dueDate?: string;
  status: string;
  items: { name: string; description?: string; price: number; qty: number; mrp?: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  taxType?: 'cgst_sgst' | 'igst' | 'vat' | 'tax';
  discountAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  payments?: { id: string; method: string; date: string; amount: number; note?: string }[];
  notes?: string;
  terms?: string;
  businessName?: string;
  businessTagline?: string;
  logoUri?: string;
  signatureUri?: string;
  signatureLabel?: string;
};

type Template = { id: string; name: string; description: string };

// ── Template registry ─────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic', description: 'Clean minimal accounting style' },
  { id: 'modern',  name: 'Modern',  description: 'Bold header with accent colour'  },
  { id: 'royal',   name: 'Royal',   description: 'Premium elegant design with gold accents' },
];

// ── Theme definition ──────────────────────────────────────────────────────────

type TemplateTheme = {
  accent: string;
  /** null = no coloured band; string = band background colour */
  bandBg: string | null;
  bandTextColor: string;
  /** px value for the thin top decorative bar (0 = none) */
  topBarPx: number;
  logoFilter: string;
  /** Page padding used consistently everywhere */
  pad: string;
  dateFormat: 'long' | 'short';
  extraCss?: string;
};

const THEMES: Record<string, TemplateTheme> = {
  classic: {
    accent:       '#111827',
    bandBg:       null,
    bandTextColor:'#111827',
    topBarPx:     4,
    logoFilter:   '',
    pad:          '56px',   // ~20mm in px for WebView
    dateFormat:   'long',
  },
  modern: {
    accent:       '#4F46E5',
    bandBg:       '#4F46E5',
    bandTextColor:'#ffffff',
    topBarPx:     0,
    logoFilter:   'brightness(0) invert(1)',
    pad:          '56px',
    dateFormat:   'long',
  },
  royal: {
    accent:       '#B8860B', // DarkGoldenRod
    bandBg:       '#0F172A', // Slate 900
    bandTextColor:'#FDE68A', // Amber 200
    topBarPx:     0,
    logoFilter:   '',
    pad:          '24px',    // Outer padding, inner border
    dateFormat:   'long',
    extraCss:     `body { font-family: 'Playfair Display', 'Georgia', serif; }`,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(dateStr: string, format: 'long' | 'short'): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: format === 'long' ? 'long' : 'short',
      year: 'numeric',
    });
  } catch { return dateStr; }
}

function statusColor(s: string): string {
  if (s === 'paid')    return '#059669';
  if (s === 'overdue') return '#DC2626';
  return '#6B7280';
}

// ── Shared section builders ───────────────────────────────────────────────────

function buildItemRows(items: InvoiceData['items'], sym: string): string {
  return items.map(it => `
    <tr>
      <td style="width:50%;padding:11px 0;border-bottom:1px solid #F3F4F6;vertical-align:top;">
        <div style="font-weight:700;color:#111827;margin-bottom:2px;">${esc(it.name)}</div>
        ${it.description ? `<div style="font-size:12px;color:#9CA3AF;">${esc(it.description)}</div>` : ''}
      </td>
      <td style="width:10%;padding:11px 0;border-bottom:1px solid #F3F4F6;text-align:center;font-size:13px;color:#6B7280;">${it.qty}</td>
      <td style="width:20%;padding:11px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-size:13px;color:#6B7280;">${sym}${it.price.toFixed(2)}</td>
      <td style="width:20%;padding:11px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-size:14px;font-weight:700;color:#111827;">${sym}${(it.price * it.qty).toFixed(2)}</td>
    </tr>`).join('');
}

function buildTotals(d: InvoiceData, sym: string, accent: string): string {
  const row = (label: string, value: string, color = '#111827') =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">
       <span>${label}</span><span style="font-weight:700;color:${color};">${value}</span>
     </div>`;

  let rows = '';
  if (d.subtotal !== d.total)
    rows += row('Subtotal', `${sym}${d.subtotal.toFixed(2)}`);
  if (d.discountAmount > 0)
    rows += row('Discount', `&#8722;${sym}${d.discountAmount.toFixed(2)}`, '#059669');
  
  if (d.discountAmount > 0 || d.taxAmount > 0) {
    const taxableAmount = Math.max(0, d.subtotal - d.discountAmount);
    rows += row('Taxable Amount', `${sym}${taxableAmount.toFixed(2)}`);
  }

  if (d.taxAmount > 0) {
    const taxType = d.taxType || 'tax';
    if (taxType === 'cgst_sgst') {
      rows += row(`CGST (${(d.taxRate / 2).toFixed(2)}%)`, `${sym}${(d.taxAmount / 2).toFixed(2)}`);
      rows += row(`SGST (${(d.taxRate / 2).toFixed(2)}%)`, `${sym}${(d.taxAmount / 2).toFixed(2)}`);
    } else {
      const label = taxType === 'igst' ? 'IGST' : taxType === 'vat' ? 'VAT' : 'Tax';
      rows += row(`${label} (${d.taxRate}%)`, `${sym}${d.taxAmount.toFixed(2)}`);
    }
  }

  if (d.amountPaid > 0)
    rows += row('Amount Paid', `&#8722;${sym}${d.amountPaid.toFixed(2)}`, '#059669');

  const balance = d.balanceDue > 0.01
    ? `<div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid #E5E7EB;margin-top:4px;font-size:14px;font-weight:700;color:#111827;">
         <span>Balance Due</span><span>${sym}${d.balanceDue.toFixed(2)}</span>
       </div>`
    : `<div style="text-align:right;margin-top:10px;">
         <span style="border:2px solid #059669;color:#059669;font-size:12px;font-weight:800;letter-spacing:2px;padding:4px 12px;display:inline-block;transform:rotate(-5deg);border-radius:4px;">PAID IN FULL</span>
       </div>`;

  return `
    <div style="display:flex;justify-content:flex-end;margin-top:24px;">
      <div style="width:280px;">
        ${rows}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${accent};color:#fff;margin-top:8px;border-radius:6px;">
          <span style="font-size:14px;font-weight:700;">Total</span>
          <span style="font-size:16px;font-weight:800;">${sym}${d.total.toFixed(2)}</span>
        </div>
        ${balance}
      </div>
    </div>`;
}

function buildNotesAndSignature(d: InvoiceData, sigLineColor: string): string {
  if (!d.notes && !d.terms && !d.signatureUri) return '';

  const notes = (d.notes || d.terms) ? `
    <div style="flex:1;min-width:0;">
      ${d.notes ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:5px;">Notes</div>
          <div style="font-size:13px;color:#4B5563;line-height:1.6;">${d.notes.replace(/\n/g, '<br/>')}</div>
        </div>` : ''}
      ${d.terms ? `
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:5px;">Payment Terms</div>
          <div style="font-size:13px;color:#4B5563;line-height:1.6;">${d.terms.replace(/\n/g, '<br/>')}</div>
        </div>` : ''}
    </div>` : '';

  const sig = d.signatureUri ? `
    <div style="text-align:center;flex-shrink:0;min-width:150px;max-width:210px;">
      <img src="${d.signatureUri}" style="height:50px;max-width:190px;object-fit:contain;display:block;margin:0 auto 8px;" />
      <div style="border-top:1px solid ${sigLineColor};padding-top:6px;font-size:10px;font-weight:600;color:#9CA3AF;letter-spacing:0.8px;text-transform:uppercase;">
        ${esc(d.signatureLabel || 'Authorized Signature')}
      </div>
    </div>` : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:28px;margin-top:36px;">
      ${notes}
      ${sig}
    </div>`;
}

function buildFooter(bizName: string, invNum: string, dateFormat: 'long' | 'short'): string {
  return `
    <div style="margin-top:auto;padding-top:14px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;font-size:11px;color:#9CA3AF;">
      <span style="font-weight:800;color:#111827;">${esc(bizName)}</span>
      <span>${esc(invNum)} &nbsp;·&nbsp; ${fmtDate(new Date().toISOString(), dateFormat)}</span>
    </div>`;
}

function buildClientDates(d: InvoiceData, theme: TemplateTheme, showStatus: boolean): string {
  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'paid';
  const issueDate = fmtDate(d.date, theme.dateFormat);
  const dueStr    = d.dueDate ? fmtDate(d.dueDate, theme.dateFormat) : null;

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
      <div style="flex:1;padding-right:24px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:6px;">Bill To</div>
        <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:3px;">${esc(d.clientName)}</div>
        ${d.clientEmail   ? `<div style="font-size:13px;color:#6B7280;margin-top:2px;">${esc(d.clientEmail)}</div>` : ''}
        ${d.clientPhone   ? `<div style="font-size:13px;color:#6B7280;margin-top:2px;">${esc(d.clientPhone)}</div>` : ''}
        ${d.clientAddress ? `<div style="font-size:13px;color:#6B7280;margin-top:2px;">${d.clientAddress.replace(/\n/g, '<br/>')}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:4px;">Issue Date</div>
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">${issueDate}</div>
        ${dueStr ? `
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:4px;">Due Date</div>
          <div style="font-size:14px;font-weight:600;color:${isOverdue ? '#DC2626' : '#111827'};margin-bottom:12px;">${dueStr}</div>
        ` : ''}
        ${showStatus ? `
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:4px;">Status</div>
          <div style="font-size:14px;font-weight:600;text-transform:capitalize;color:${statusColor(d.status)};">${esc(d.status)}</div>
        ` : ''}
      </div>
    </div>`;
}

function buildTableSection(items: InvoiceData['items'], sym: string, accent: string): string {
  const thStyle = `font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;padding:0 0 10px;border-bottom:2px solid ${accent};`;
  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="${thStyle}text-align:left;">Description</th>
          <th style="${thStyle}text-align:center;">Qty</th>
          <th style="${thStyle}text-align:right;">Unit Price</th>
          <th style="${thStyle}text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${buildItemRows(items, sym)}</tbody>
    </table>`;
}

// ── Per-template page builders ────────────────────────────────────────────────

function buildClassicPage(d: InvoiceData, theme: TemplateTheme, sym: string, invNum: string): string {
  const bizName = d.businessName || 'SubTrack';
  const bizTag  = d.businessTagline || 'Invoice Management';
  const logo    = d.logoUri
    ? `<img src="${d.logoUri}" style="height:44px;max-width:150px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : '';

  return `
    <!-- thin top bar -->
    <div style="height:${theme.topBarPx}px;background:${theme.accent};width:100%;flex-shrink:0;"></div>

    <!-- all content in one padded column -->
    <div style="padding:${theme.pad};flex:1;display:flex;flex-direction:column;">

      <!-- header: logo+name left, INVOICE right -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;">
        <div>
          ${logo}
          <div style="font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${esc(bizName)}</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:3px;">${esc(bizTag)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:38px;font-weight:900;color:#111827;letter-spacing:-1px;line-height:1;">INVOICE</div>
          <div style="font-size:14px;color:#6B7280;margin-top:5px;">${esc(invNum)}</div>
          <div style="display:inline-block;margin-top:8px;padding:3px 10px;border:1px solid #D1D5DB;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151;">${esc(d.status)}</div>
        </div>
      </div>

      <!-- divider -->
      <div style="height:2px;background:#111827;margin-bottom:28px;"></div>

      <!-- client + dates -->
      ${buildClientDates(d, theme, false)}

      <!-- items table -->
      ${buildTableSection(d.items, sym, theme.accent)}

      <!-- totals -->
      ${buildTotals(d, sym, theme.accent)}

      <!-- notes + signature -->
      ${buildNotesAndSignature(d, '#D1D5DB')}

      <!-- footer -->
      ${buildFooter(bizName, invNum, theme.dateFormat)}
    </div>`;
}

function buildModernPage(d: InvoiceData, theme: TemplateTheme, sym: string, invNum: string): string {
  const bizName = d.businessName || 'SubTrack';
  const bizTag  = d.businessTagline || 'Invoice Management';
  const logo    = d.logoUri
    ? `<img src="${d.logoUri}" style="height:44px;max-width:140px;object-fit:contain;display:block;margin-bottom:6px;${theme.logoFilter ? `filter:${theme.logoFilter};` : ''}" />`
    : '';

  return `
    <!-- coloured band header — full width, no extra padding issues -->
    <div style="background:${theme.bandBg};padding:36px ${theme.pad};display:flex;justify-content:space-between;align-items:flex-end;flex-shrink:0;">
      <div style="color:${theme.bandTextColor};">
        ${logo}
        <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px;">${esc(bizName)}</div>
        <div style="font-size:13px;opacity:0.75;margin-top:4px;">${esc(bizTag)}</div>
      </div>
      <div style="text-align:right;color:${theme.bandTextColor};">
        <div style="font-size:40px;font-weight:900;letter-spacing:-1.5px;line-height:1;">INVOICE</div>
        <div style="font-size:14px;opacity:0.85;margin-top:6px;">${esc(invNum)}</div>
      </div>
    </div>

    <!-- body content below the band -->
    <div style="padding:${theme.pad};flex:1;display:flex;flex-direction:column;">

      <!-- client + dates + status -->
      ${buildClientDates(d, theme, true)}

      <!-- divider -->
      <div style="height:1px;background:#E5E7EB;margin-bottom:24px;"></div>

      <!-- items table -->
      ${buildTableSection(d.items, sym, theme.accent)}

      <!-- totals -->
      ${buildTotals(d, sym, theme.accent)}

      <!-- notes + signature -->
      ${buildNotesAndSignature(d, '#C7D2FE')}

      <!-- footer -->
      ${buildFooter(bizName, invNum, theme.dateFormat)}
    </div>`;
}

function buildRoyalPage(d: InvoiceData, theme: TemplateTheme, sym: string, invNum: string): string {
  const bizName = d.businessName || 'SubTrack';
  const bizTag  = d.businessTagline || 'Invoice Management';
  const logo    = d.logoUri
    ? `<img src="${d.logoUri}" style="height:60px;max-width:200px;object-fit:contain;display:block;margin:0 auto 24px;" />`
    : '';

  const issueDate = fmtDate(d.date, theme.dateFormat);
  const dueStr    = d.dueDate ? fmtDate(d.dueDate, theme.dateFormat) : null;
  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'paid';

  // Table rows
  const rows = d.items.map((it) => `
    <tr>
      <td style="padding:20px 0;border-bottom:1px solid #F0F0F0;color:#111827;">
        <div style="font-size:14px;font-weight:600;letter-spacing:0.5px;">${esc(it.name)}</div>
        ${it.description ? `<div style="font-size:12px;color:#888;margin-top:6px;font-style:italic;">${esc(it.description)}</div>` : ''}
      </td>
      <td style="padding:20px 0;border-bottom:1px solid #F0F0F0;text-align:center;color:#555;font-size:13px;">${it.qty}</td>
      <td style="padding:20px 0;border-bottom:1px solid #F0F0F0;text-align:right;color:#555;font-size:13px;">${sym}${it.price.toFixed(2)}</td>
      <td style="padding:20px 0;border-bottom:1px solid #F0F0F0;text-align:right;color:#111827;font-weight:600;font-size:13px;">${sym}${(it.price * it.qty).toFixed(2)}</td>
    </tr>
  `).join('');

  // Totals
  const row = (label: string, value: string, isTotal: boolean = false) => 
    `<div style="display:flex;justify-content:space-between;padding:14px 0;${isTotal ? `border-top:1px solid ${theme.accent}; border-bottom:1px solid ${theme.accent}; margin-top:12px;` : 'border-bottom:1px solid #F9F9F9;'}">
       <span style="font-size:${isTotal ? '14px' : '12px'};color:${isTotal ? '#111' : '#666'};text-transform:uppercase;letter-spacing:1px;font-weight:${isTotal ? '600' : 'normal'};">${label}</span>
       <span style="font-size:${isTotal ? '18px' : '14px'};color:${isTotal ? theme.accent : '#111'};font-weight:${isTotal ? '600' : 'normal'};">${value}</span>
     </div>`;

  let totalsHtml = '';
  if (d.subtotal !== d.total) totalsHtml += row('Subtotal', `${sym}${d.subtotal.toFixed(2)}`);
  if (d.discountAmount > 0) totalsHtml += row('Discount', `-${sym}${d.discountAmount.toFixed(2)}`);
  if (d.taxAmount > 0) totalsHtml += row('Tax', `${sym}${d.taxAmount.toFixed(2)}`);
  if (d.amountPaid > 0) totalsHtml += row('Amount Paid', `-${sym}${d.amountPaid.toFixed(2)}`);
  totalsHtml += row('Total Due', `${sym}${d.balanceDue.toFixed(2)}`, true);

  return `
    <div style="margin:0; flex:1; display:flex; flex-direction:column; background:#fff; padding:60px 70px; font-family:'Playfair Display', 'Georgia', serif;">
      
      <!-- Top Decorative Line -->
      <div style="width:100%;height:1px;background:${theme.accent};margin-bottom:3px;"></div>
      <div style="width:100%;height:3px;background:${theme.accent};margin-bottom:60px;"></div>

      <!-- Centered Header -->
      <div style="text-align:center;margin-bottom:60px;">
        ${logo}
        <div style="font-size:26px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:8px;margin-bottom:10px;">${esc(bizName)}</div>
        <div style="font-size:13px;color:#777;font-style:italic;letter-spacing:2px;">${esc(bizTag)}</div>
      </div>

      <!-- Meta Grid: Invoice No, Date, Billed To -->
      <div style="display:flex;justify-content:space-between;margin-bottom:60px;border-top:1px solid #EAEAEA;border-bottom:1px solid #EAEAEA;padding:30px 0;">
        
        <div style="flex:1;padding-right:30px;">
          <div style="font-size:10px;color:${theme.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;font-weight:600;">Billed To</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px;letter-spacing:0.5px;">${esc(d.clientName)}</div>
          ${d.clientEmail ? `<div style="font-size:13px;color:#666;margin-bottom:4px;">${esc(d.clientEmail)}</div>` : ''}
          ${d.clientPhone ? `<div style="font-size:13px;color:#666;margin-bottom:4px;">${esc(d.clientPhone)}</div>` : ''}
          ${d.clientAddress ? `<div style="font-size:13px;color:#666;line-height:1.6;margin-top:6px;">${d.clientAddress.replace(/\n/g, '<br/>')}</div>` : ''}
        </div>

        <div style="flex:1;text-align:center;border-left:1px solid #EAEAEA;border-right:1px solid #EAEAEA;padding:0 30px;">
          <div style="font-size:10px;color:${theme.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;font-weight:600;">Invoice Detail</div>
          
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Invoice No.</div>
            <div style="font-size:15px;color:#111;font-weight:600;letter-spacing:1px;">${esc(invNum)}</div>
          </div>

          <div style="margin-bottom:10px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Date Issued</div>
            <div style="font-size:15px;color:#111;font-weight:600;letter-spacing:0.5px;">${issueDate}</div>
          </div>
        </div>

        <div style="flex:1;text-align:right;padding-left:30px;">
          <div style="font-size:10px;color:${theme.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;font-weight:600;">Status & Terms</div>
          
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Status</div>
            <div style="display:inline-block;border:1px solid ${theme.accent};color:${theme.accent};padding:6px 16px;font-size:10px;text-transform:uppercase;letter-spacing:3px;font-weight:600;">${esc(d.status)}</div>
          </div>

          ${dueStr ? `
          <div>
            <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Due Date</div>
            <div style="font-size:15px;color:${isOverdue ? '#DC2626' : '#111'};font-weight:600;letter-spacing:0.5px;">${dueStr}</div>
          </div>` : ''}
        </div>

      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:50px;">
        <thead>
          <tr>
            <th style="border-bottom:1px solid ${theme.accent};color:${theme.accent};padding:0 0 16px 0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Item Description</th>
            <th style="border-bottom:1px solid ${theme.accent};color:${theme.accent};padding:0 0 16px 0;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Qty</th>
            <th style="border-bottom:1px solid ${theme.accent};color:${theme.accent};padding:0 0 16px 0;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Price</th>
            <th style="border-bottom:1px solid ${theme.accent};color:${theme.accent};padding:0 0 16px 0;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- Totals & Notes -->
      <div style="display:flex;justify-content:space-between;gap:60px;">
        <div style="flex:1;">
          ${(d.notes || d.terms) ? `
            <div style="padding-top:10px;">
              ${d.notes ? `<div style="font-size:10px;font-weight:600;color:${theme.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Notes</div><div style="font-size:13px;color:#666;line-height:1.8;margin-bottom:28px;font-style:italic;">${d.notes.replace(/\n/g, '<br/>')}</div>` : ''}
              ${d.terms ? `<div style="font-size:10px;font-weight:600;color:${theme.accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Terms</div><div style="font-size:13px;color:#666;line-height:1.8;font-style:italic;">${d.terms.replace(/\n/g, '<br/>')}</div>` : ''}
            </div>
          ` : ''}
          ${d.balanceDue <= 0.01 ? `<div style="margin-top:40px;"><span style="border:1px solid #059669;color:#059669;font-size:13px;font-weight:600;letter-spacing:5px;padding:10px 24px;text-transform:uppercase;">Paid In Full</span></div>` : ''}
        </div>
        <div style="width:340px;">
          ${totalsHtml}
        </div>
      </div>

      <!-- Signature -->
      ${d.signatureUri ? `
      <div style="margin-top:auto;text-align:right;padding-top:50px;">
        <img src="${d.signatureUri}" style="height:70px;max-width:240px;object-fit:contain;display:inline-block;margin-bottom:16px;" />
        <div style="border-top:1px solid #EAEAEA;padding-top:14px;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;width:240px;margin-left:auto;">
          ${esc(d.signatureLabel || 'Authorized Signature')}
        </div>
      </div>` : ''}

      <!-- Bottom Decorative Line -->
      <div style="margin-top:${d.signatureUri ? '40px' : 'auto'};width:100%;height:1px;background:#EAEAEA;margin-bottom:20px;"></div>
      <div style="text-align:center;font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;">
        Thank you for your business
      </div>
      
    </div>
  `;
}

// ── Main generator ─────────────────────────────────────────────────────────────

function generateHtml(templateId: string, d: InvoiceData, sym: string): string {
  const theme  = THEMES[templateId] ?? THEMES.classic;
  const invNum = d.invoiceNumber || '#' + d.id.slice(0, 8).toUpperCase();

  let pageContent: string;
  switch (templateId) {
    case 'modern':  pageContent = buildModernPage(d, theme, sym, invNum);  break;
    case 'royal':   pageContent = buildRoyalPage(d, theme, sym, invNum);   break;
    default:        pageContent = buildClassicPage(d, theme, sym, invNum); break;
  }

  const baseCss = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { margin: 0; size: A4 portrait; }
    .page {
      width: 794px;
      min-height: 1123px;
      margin: 0;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
    @media print {
      body { background: #fff; }
      .page { width: 100%; min-height: 0; margin: 0; }
    }
    ${theme.extraCss ?? ''}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=794"/>
  <style>${baseCss}</style>
</head>
<body>
  <div class="page">${pageContent}</div>
</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function generateInvoiceHtml(templateId: string, data: InvoiceData, sym: string): string {
  return generateHtml(templateId, data, sym);
}
