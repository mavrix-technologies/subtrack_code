const fs = require('fs');
const html = fs.readFileSync('website/index.html', 'utf8');
const ids = [];
let pos = 0;
while ((pos = html.indexOf('id="screen-', pos)) !== -1) {
  const end = html.indexOf('"', pos + 4);
  ids.push(html.slice(pos + 4, end));
  pos = end;
}
console.log([...new Set(ids)]);
