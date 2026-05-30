const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
let html = fs.readFileSync(filePath, 'utf8');

// Match tab bars
const regex = /<!-- Bottom Tab Bar -->[\s\S]*?<div class="screen-tab-bar">[\s\S]*?<\/div>/g;

const matches = html.match(regex);
console.log('Matches found:', matches ? matches.length : 0);

if (matches && matches.length === 4) {
  html = html.replace(regex, '<!-- Bottom Home Indicator -->\n                <div class="screen-home-indicator"></div>');
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Successfully updated website/index.html!');
} else {
  console.error('Error: Did not find exactly 4 tab bars.');
}
