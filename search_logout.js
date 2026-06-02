const fs = require('fs');

const filePath = 'd:\\ZyanJob\\mobile\\src\\App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== LOGOUT FUNCTION ===");
lines.forEach((line, index) => {
  if (line.includes('handleLogout')) {
    console.log(`${index + 1}: ${line.trim()}`);
    // Print next 5 lines
    for (let i = 1; i <= 5; i++) {
      console.log(`   +${i}: ${lines[index + i].trim()}`);
    }
  }
});
