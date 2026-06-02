const fs = require('fs');
const path = require('path');

const filePath = 'd:\\ZyanJob\\mobile\\src\\App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== SEARCH RESULTS ===");
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('message') || line.toLowerCase().includes('chat') || line.toLowerCase().includes('comm')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
