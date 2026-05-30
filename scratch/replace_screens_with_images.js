const fs = require('fs');

let html = fs.readFileSync('website/index.html', 'utf8');

// Map each screen ID to its image asset
const screens = [
  { id: 'screen-dashboard', img: 'assets/home page.jpeg',     alt: 'SubTrack Home Dashboard' },
  { id: 'screen-ai',        img: 'assets/subscription.jpeg',  alt: 'SubTrack Subscriptions' },
  { id: 'screen-alarm',     img: 'assets/expense.jpeg',       alt: 'SubTrack Expenses' },
  { id: 'screen-analytics', img: 'assets/invoices.jpeg',      alt: 'SubTrack Invoices' },
];

for (const { id, img, alt } of screens) {
  // Find the opening <div class="mock-screen-content..." id="screen-xxx"> tag
  const openTag = `id="${id}"`;
  const startIdx = html.indexOf(openTag);
  if (startIdx === -1) { console.error('Could not find', id); continue; }

  // Walk back to the start of the div tag
  const divStart = html.lastIndexOf('<div', startIdx);

  // Find the matching closing </div> for this mock-screen-content div
  let depth = 0;
  let pos = divStart;
  let endIdx = -1;
  while (pos < html.length) {
    const nextOpen  = html.indexOf('<div', pos + 1);
    const nextClose = html.indexOf('</div>', pos + 1);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen;
    } else {
      if (depth === 0) {
        endIdx = nextClose + 6; // include closing tag
        break;
      }
      depth--;
      pos = nextClose;
    }
  }

  if (endIdx === -1) { console.error('Could not find end of', id); continue; }

  // Determine if this is the first (active) screen
  const originalDiv = html.slice(divStart, endIdx);
  const isActive = originalDiv.includes('active');

  // Build the replacement: a simple div with just an img tag
  const replacement = `<div class="mock-screen-content${isActive ? ' active' : ''}" id="${id}">
                <img src="${img}" alt="${alt}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block;" />
              </div>`;

  html = html.slice(0, divStart) + replacement + html.slice(endIdx);
  console.log(`✅ Replaced ${id} with image: ${img}`);
}

// Bump cache buster
html = html.replace(/style\.css\?v=[\d.]+/, 'style.css?v=2.5.7');
html = html.replace(/main\.js\?v=[\d.]+/, 'main.js?v=2.5.7');

fs.writeFileSync('website/index.html', html, 'utf8');
console.log('\nDone! website/index.html updated.');
