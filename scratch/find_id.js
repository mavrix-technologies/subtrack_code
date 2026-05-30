const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
const html = fs.readFileSync(filePath, 'utf8');

console.log('Contains screen-dashboard:', html.includes('screen-dashboard'));
console.log('Contains screen-ai:', html.includes('screen-ai'));
console.log('Contains screen-alarm:', html.includes('screen-alarm'));
console.log('Contains screen-analytics:', html.includes('screen-analytics'));
