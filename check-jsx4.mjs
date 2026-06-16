import { readFileSync } from 'fs';
const lines = readFileSync('client/src/pages/Home.tsx', 'utf8').split('\n');
let depth = 0;
// Show range 820-1080
for (let i = 529; i < lines.length; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<(div|section|main)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(div|section|main)>/g) || []).length;
  const prev = depth;
  depth += opens - closes;
  if (i >= 819 && i <= 1080 && (opens > 0 || closes > 0)) {
    const marker = (depth <= 0) ? ' <<<<' : '';
    console.log(`L${i+1} [${prev}->${depth}]${marker} | ${line.trim().substring(0, 100)}`);
  }
}
console.log(`Final depth: ${depth}`);
