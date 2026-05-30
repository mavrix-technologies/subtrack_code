const fs = require('fs');
const path = require('path');

const logFile = 'C:/Users/ASUS/.gemini/antigravity/brain/db30332d-6c9a-41cb-9938-b68b39d1e88a/.system_generated/logs/overview.txt';
if (!fs.existsSync(logFile)) {
  console.log('Log file not found');
  process.exit(1);
}

const code = fs.readFileSync(logFile, 'utf8');
const searchStr = 'Write HTML file for SubTrack AI showcase website';
const idx = code.indexOf(searchStr);

if (idx !== -1) {
  // Find the start of CodeContent parameter of this tool call
  const targetCallStart = code.lastIndexOf('{"step_index":', idx);
  console.log('Target call start:', targetCallStart);
  
  // Parse the tool call JSON if possible
  const nextBrace = code.indexOf('}', idx);
  const jsonStr = code.slice(targetCallStart, nextBrace + 1);
  try {
    const obj = JSON.parse(jsonStr);
    const codeContent = obj.tool_calls[0].args.CodeContent;
    fs.writeFileSync(path.join(__dirname, 'original_index.html'), codeContent);
    console.log('Successfully saved original_index.html');
  } catch (err) {
    console.log('Failed to parse JSON, trying regex extraction...');
    // Fallback using raw string extraction
    const startStr = '"CodeContent":"';
    const startIdx = code.indexOf(startStr, targetCallStart);
    const endIdx = code.indexOf('","Description"', startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
      let rawContent = code.slice(startIdx + startStr.length, endIdx);
      // Unescape characters
      rawContent = rawContent
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
      fs.writeFileSync(path.join(__dirname, 'original_index.html'), rawContent);
      console.log('Successfully saved original_index.html via regex fallback');
    } else {
      console.log('Failed raw extraction.');
    }
  }
} else {
  console.log('Search string not found');
}
