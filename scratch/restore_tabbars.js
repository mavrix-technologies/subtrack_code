const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
let html = fs.readFileSync(filePath, 'utf8');

// The 4 screen IDs we have in order are screen-dashboard, screen-ai, screen-alarm, screen-analytics.
// Let's replace the bottom home indicator inside each screen block with the tab bar + home indicator.

const tabBars = [
  // Tab Bar for Screen 1 (Home Dashboard UI) - Home active
  `<!-- Bottom Tab Bar -->
                  <div class="screen-tab-bar">
                    <a href="#" class="tab-item active">
                      <i data-lucide="home"></i>
                      <span>Home</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="repeat"></i>
                      <span>Subs</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="wallet"></i>
                      <span>Expenses</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="file-text"></i>
                      <span>Invoices</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="bell"></i>
                      <span>AI Remind</span>
                    </a>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>`,

  // Tab Bar for Screen 2 (Subscriptions UI) - Subs active
  `<!-- Bottom Tab Bar -->
                  <div class="screen-tab-bar">
                    <a href="#" class="tab-item">
                      <i data-lucide="home"></i>
                      <span>Home</span>
                    </a>
                    <a href="#" class="tab-item active">
                      <i data-lucide="repeat"></i>
                      <span>Subs</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="wallet"></i>
                      <span>Expenses</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="file-text"></i>
                      <span>Invoices</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="bell"></i>
                      <span>AI Remind</span>
                    </a>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>`,

  // Tab Bar for Screen 3 (Expenses UI with Alarm) - Expenses active
  `<!-- Bottom Tab Bar -->
                  <div class="screen-tab-bar">
                    <a href="#" class="tab-item">
                      <i data-lucide="home"></i>
                      <span>Home</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="repeat"></i>
                      <span>Subs</span>
                    </a>
                    <a href="#" class="tab-item active">
                      <i data-lucide="wallet"></i>
                      <span>Expenses</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="file-text"></i>
                      <span>Invoices</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="bell"></i>
                      <span>AI Remind</span>
                    </a>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>`,

  // Tab Bar for Screen 4 (Invoices UI) - Invoices active
  `<!-- Bottom Tab Bar -->
                  <div class="screen-tab-bar">
                    <a href="#" class="tab-item">
                      <i data-lucide="home"></i>
                      <span>Home</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="repeat"></i>
                      <span>Subs</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="wallet"></i>
                      <span>Expenses</span>
                    </a>
                    <a href="#" class="tab-item active">
                      <i data-lucide="file-text"></i>
                      <span>Invoices</span>
                    </a>
                    <a href="#" class="tab-item">
                      <i data-lucide="bell"></i>
                      <span>AI Remind</span>
                    </a>
                  </div>
                  <!-- Bottom Home Indicator -->
                  <div class="screen-home-indicator"></div>`
];

let currentIndex = 0;
const targetPattern = '<!-- Bottom Home Indicator -->\n                  <div class="screen-home-indicator"></div>';

// We replace the occurrences one by one.
let newHtml = html;
let lastIndex = 0;

for (let i = 0; i < 4; i++) {
  const matchIdx = newHtml.indexOf(targetPattern, lastIndex);
  if (matchIdx !== -1) {
    newHtml = newHtml.slice(0, matchIdx) + tabBars[i] + newHtml.slice(matchIdx + targetPattern.length);
    lastIndex = matchIdx + tabBars[i].length;
    currentIndex++;
  } else {
    console.log(`Could not find occurrence ${i} of home indicator.`);
  }
}

if (currentIndex === 4) {
  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log('Successfully restored bottom tab bars for all 4 screens!');
} else {
  console.error('Error: Did not replace exactly 4 occurrences. Replaced count:', currentIndex);
}
