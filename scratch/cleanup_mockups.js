const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../website/index.html');
const originalHtml = fs.readFileSync(filePath, 'utf8');

// Let's split by '<div class="mock-app-screen">'
const parts = originalHtml.split('<div class="mock-app-screen">');
console.log('Found mockup screens count:', parts.length - 1);

const updatedParts = [parts[0]];

for (let i = 1; i < parts.length; i++) {
  const part = parts[i];
  
  // We need to find the closing div of mock-app-screen.
  // Since mock-app-screen container has nested divs, let's find the closing tag by balancing divs.
  let divCount = 1;
  let index = 0;
  let screenContent = '';
  let restContent = '';
  
  while (divCount > 0 && index < part.length) {
    if (part.substring(index, index + 27) === '<div class="screen-tab-bar"') {
      // Skip it and balance inside if we want, but let's just do standard div balancing:
      divCount++;
      index += 27;
    } else if (part.substring(index, index + 5) === '<div ') {
      divCount++;
      index += 5;
    } else if (part.substring(index, index + 6) === '</div>') {
      divCount--;
      index += 6;
    } else {
      index++;
    }
  }
  
  screenContent = part.substring(0, index - 6); // content inside mock-app-screen including closing div
  restContent = part.substring(index - 6);
  
  // Inside screenContent, the last structural element is the screen-body.
  // Let's find the last occurrences of closing divs.
  // Actually, let's find the last occurrence of screen-body's closing div.
  // We know screen-body starts with '<div class="screen-body">'
  const bodyStartIdx = screenContent.indexOf('<div class="screen-body">');
  if (bodyStartIdx !== -1) {
    // Balance divs inside screen-body to find where screen-body ends!
    let bodyDivCount = 1;
    let bodyIndex = bodyStartIdx + 25;
    while (bodyDivCount > 0 && bodyIndex < screenContent.length) {
      if (screenContent.substring(bodyIndex, bodyIndex + 5) === '<div ') {
        bodyDivCount++;
        bodyIndex += 5;
      } else if (screenContent.substring(bodyIndex, bodyIndex + 6) === '</div>') {
        bodyDivCount--;
        bodyIndex += 6;
      } else {
        bodyIndex++;
      }
    }
    
    const bodyContent = screenContent.substring(0, bodyIndex);
    // Now we reconstruct the mock-app-screen content by keeping bodyContent, adding the home indicator, and closing it.
    const newScreenContent = bodyContent + '\n                <!-- Bottom Home Indicator -->\n                <div class="screen-home-indicator"></div>\n              ';
    updatedParts.push(newScreenContent + restContent);
  } else {
    updatedParts.push(part);
  }
}

const finalHtml = updatedParts.join('<div class="mock-app-screen">');
fs.writeFileSync(filePath, finalHtml, 'utf8');
console.log('Successfully cleaned up all mockup screens!');
