import { readFileSync } from 'fs';
const content = readFileSync('client/src/pages/Home.tsx', 'utf8');
const lines = content.split('\n');

// Build char-to-line map
const charToLine = [];
for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  const lineLen = lines[lineIdx].length + 1;
  for (let i = 0; i < lineLen; i++) {
    charToLine.push(lineIdx + 1);
  }
}

// Find all open/close tokens
const tokens = [];
const openRe = /<(div|section|main)(?=[\s>\/])/g;
const closeRe = /<\/(div|section|main)>/g;
let m;
while ((m = openRe.exec(content)) !== null) {
  tokens.push({ type: 'open', tag: m[1], pos: m.index, line: charToLine[m.index] });
}
while ((m = closeRe.exec(content)) !== null) {
  tokens.push({ type: 'close', tag: m[1], pos: m.index, line: charToLine[m.index] });
}
tokens.sort((a, b) => a.pos - b.pos);

// Find when div at line 712 gets closed
const stack = [];
let divAt712Id = null;
let popped712At = null;

for (const tok of tokens) {
  if (tok.type === 'open') {
    const id = stack.length;
    stack.push({ ...tok, id });
    if (tok.tag === 'div' && tok.line === 712) {
      divAt712Id = stack.length - 1; // index in stack when pushed
      console.log(`div at 712 pushed, stack size now: ${stack.length}`);
    }
  } else {
    const last = stack[stack.length - 1];
    if (last && last.tag === tok.tag) {
      const popped = stack.pop();
      if (popped.tag === 'div' && popped.line === 712) {
        popped712At = tok.line;
        console.log(`div at 712 CLOSED by </div> at line ${tok.line}`);
        // Show surrounding lines
        for (let i = tok.line - 2; i <= tok.line + 2; i++) {
          if (i >= 1 && i <= lines.length) {
            console.log(`  L${i}: ${lines[i-1].trim().substring(0, 80)}`);
          }
        }
      }
    }
    // If no match, skip (don't pop)
  }
}

console.log(`\ndiv at 712 was closed at line: ${popped712At}`);
