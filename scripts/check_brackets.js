const fs = require('fs');
const path = 'src/pages/ServiceSelection.tsx';
const s = fs.readFileSync(path, 'utf8');
const counts = {
  openCurly: (s.match(/{/g) || []).length,
  closeCurly: (s.match(/}/g) || []).length,
  openParen: (s.match(/\(/g) || []).length,
  closeParen: (s.match(/\)/g) || []).length,
  openSquare: (s.match(/\[/g) || []).length,
  closeSquare: (s.match(/\]/g) || []).length,
  backticks: (s.match(/`/g) || []).length,
  quotesDouble: (s.match(/"/g) || []).length,
  quotesSingle: (s.match(/'/g) || []).length,
};
console.log('Counts for', path);
console.log(counts);
// Print last 30 lines to inspect tail
const lines = s.split('\n');
console.log('\n--- Last 40 lines ---');
console.log(lines.slice(-40).join('\n'));
