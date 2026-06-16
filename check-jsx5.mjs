import { readFileSync } from 'fs';
const content = readFileSync('client/src/pages/Home.tsx', 'utf8');

// Tokenize: find all opening and closing div/section/main tags with line numbers
const tokens = [];
const lines = content.split('\n');

// Build a char-to-line map
const charToLine = [];
let charIdx = 0;
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  const lineLen = lines[lineIdx].length + 1; // +1 for \n
  for (let i = 0; i < lineLen; i++) {
    charToLine.push(lineIdx + 1); // 1-indexed
  }
  charIdx += lineLen;
}

// Find opening tags: <(div|section|main)(\s|>)
const openRe = /<(div|section|main)(?=[\s>\/])/g;
let m;
while ((m = openRe.exec(content)) !== null) {
  tokens.push({ type: 'open', tag: m[1], pos: m.index, line: charToLine[m.index] });
}

// Find closing tags: </(div|section|main)>
const closeRe = /<\/(div|section|main)>/g;
while ((m = closeRe.exec(content)) !== null) {
  tokens.push({ type: 'close', tag: m[1], pos: m.index, line: charToLine[m.index] });
}

// Sort by position
tokens.sort((a, b) => a.pos - b.pos);

// Simulate a stack
const stack = [];
let errors = [];

for (const tok of tokens) {
  if (tok.type === 'open') {
    stack.push(tok);
  } else {
    // Find matching open
    const last = stack.length > 0 ? stack[stack.length - 1] : null;
    if (last && last.tag === tok.tag) {
      stack.pop();
    } else {
      errors.push({ close: tok, expectedOpen: last });
    }
  }
}

console.log(`Stack remaining (unclosed): ${stack.length}`);
stack.slice(-5).forEach(t => console.log(`  Unclosed: <${t.tag}> at line ${t.line}`));

console.log(`\nMismatches: ${errors.length}`);
errors.slice(0, 5).forEach(e => {
  const exp = e.expectedOpen ? `expected </${e.expectedOpen.tag}> from line ${e.expectedOpen.line}` : 'no open tag';
  console.log(`  Got </${e.close.tag}> at line ${e.close.line}, ${exp}`);
});

// Find the first "extra" close (where stack underflows or mismatches)
console.log('\n--- Tracing first 1200 tokens ---');
const stack2 = [];
let problems = 0;
for (const tok of tokens) {
  if (problems > 3) break;
  if (tok.type === 'open') {
    stack2.push(tok);
  } else {
    const last2 = stack2.length > 0 ? stack2[stack2.length - 1] : null;
    if (!last2 || last2.tag !== tok.tag) {
      problems++;
      console.log(`PROBLEM: </${tok.tag}> at line ${tok.line} (stack top: ${last2 ? `<${last2.tag}> from line ${last2.line}` : 'empty'})`);
      // Show surrounding lines
      for (let i = tok.line - 2; i <= tok.line + 1; i++) {
        if (i >= 1 && i <= lines.length) {
          console.log(`  L${i}: ${lines[i-1].trim().substring(0, 90)}`);
        }
      }
    } else {
      stack2.pop();
    }
  }
}
