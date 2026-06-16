import { readFileSync } from 'fs';
const lines = readFileSync('client/src/pages/Home.tsx', 'utf8').split('\n');
let bal = 0;
for (let i = 821; i <= 1073; i++) { // lines 822..1074 (0-indexed 821..1073)
  const line = lines[i] || '';
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  bal += opens - closes;
  if (opens !== closes) {
    console.log(`L${i+1} bal=${bal} (+${opens}/-${closes}) | ${line.trim().slice(0,70)}`);
  }
}
console.log('DESKTOP BLOCK (822-1074) div balance:', bal, '(0 = balanced, +N = N unclosed opens, -N = N extra closes)');
