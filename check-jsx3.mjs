import { readFileSync } from 'fs';
const lines = readFileSync('client/src/pages/Home.tsx', 'utf8').split('\n');
let depth = 0;
// Find first time depth goes negative, show context
let firstNeg = -1;
for (let i = 529; i < lines.length; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<(div|section|main)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(div|section|main)>/g) || []).length;
  depth += opens - closes;
  if (depth < 0 && firstNeg === -1) {
    firstNeg = i;
    console.log(`FIRST NEGATIVE at line ${i+1}, depth=${depth}`);
  }
}
console.log(`Final depth: ${depth}`);

// Now show detailed view of lines around firstNeg
console.log('\n--- Context around first negative ---');
let d2 = 0;
for (let i = 529; i < lines.length; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<(div|section|main)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(div|section|main)>/g) || []).length;
  const prev = d2;
  d2 += opens - closes;
  if (i >= firstNeg - 30 && i <= firstNeg + 5) {
    const marker = (d2 <= 0) ? ' <<<<' : '';
    console.log(`L${i+1} [${prev}->${d2}]${marker} | ${line.trim().substring(0, 100)}`);
  }
}
