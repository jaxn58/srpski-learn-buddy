import { readFileSync } from 'fs';
const lines = readFileSync('client/src/pages/Home.tsx', 'utf8').split('\n');
let depth = 0;
// Show the range where depth first goes negative
for (let i = 529; i < lines.length; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<(div|section|main)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(div|section|main)>/g) || []).length;
  const prevDepth = depth;
  depth += opens - closes;
  // Show lines around 893-910
  if (i >= 888 && i <= 910) {
    console.log(`L${i+1} [${prevDepth}->${depth}] opens=${opens} closes=${closes} | ${line.trim().substring(0, 90)}`);
  }
}
