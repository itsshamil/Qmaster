const fs = require('fs');
const path='src/pages/ServiceSelection.tsx';
const s=fs.readFileSync(path,'utf8');
const lines=s.split('\n');
let cum=0;
for(let i=0;i<lines.length;i++){
  const line=lines[i];
  for(let j=0;j<line.length;j++){
    const c=line[j];
    if(c==='{') cum++;
    if(c==='}') cum--;
  }
  if (i>400) console.log(i+1, 'cum', cum, line.trim());
}
console.log('final cum', cum);
