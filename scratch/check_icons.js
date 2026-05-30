const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
const html = fs.readFileSync(filePath, 'utf8');

const regex = /data-lucide="([^"]+)"/g;
let match;
const icons = new Set();
while ((match = regex.exec(html)) !== null) {
  icons.add(match[1]);
}

console.log('Unique icons:', [...icons]);
