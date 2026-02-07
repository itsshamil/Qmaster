const fs = require('fs');
const path = 'src/pages/ServiceSelection.tsx';
const s = fs.readFileSync(path, 'utf8');
let openCurly=0, closeCurly=0;
for (let i=0;i<s.length;i++){
  const c = s[i];
  if (c==='{') openCurly++;
  if (c==='}') closeCurly++;
  if (closeCurly>openCurly) { console.log('Extra closing brace at index', i); process.exit(0); }
}
console.log('openCurly', openCurly, 'closeCurly', closeCurly);
if (openCurly>closeCurly) {
  console.log('Missing', openCurly-closeCurly, 'closing braces.');
  // find last few lines
  const lines = s.split('\n');
  // find the line and index where cumulative difference is highest
  let cum = 0, maxCum = 0, maxPos = 0;
  for (let i=0;i<s.length;i++){
    const c = s[i];
    if (c==='{') cum++;
    if (c==='}') cum--;
    if (cum>maxCum) { maxCum = cum; maxPos = i; }
  }
  console.log('Max unmatched depth:', maxCum, 'at index', maxPos);
  // print context around maxPos
  const before = Math.max(0, maxPos-200);
  const after = Math.min(s.length, maxPos+200);
  console.log('\n--- Context around likely unmatched opening brace ---\n');
  console.log(s.slice(before, after));
  console.log('\nFile length', s.length);
}
