import { readFileSync } from 'fs';
const lines = readFileSync('client/src/pages/Home.tsx', 'utf8').split('\n');
let depth = 0;
const issues = [];
for (let i = 529; i < lines.length; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/<(div|section|main)[\s>]/g) || []).length;
  const closes = (line.match(/<\/(div|section|main)>/g) || []).length;
  depth += opens - closes;
  if (opens !== closes) {
    issues.push({ line: i + 1, opens, closes, depth, c: line.trim().substring(0, 80) });
  }
}
console.log('Final depth (should be 0):', depth);
issues.forEach(x => console.log(`L${x.line} opens=${x.opens} closes=${x.closes} depth=${x.depth} | ${x.c}`));
