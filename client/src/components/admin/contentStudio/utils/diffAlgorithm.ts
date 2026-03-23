export type DiffOp = { op: "equal" | "add" | "del"; line: string };

export type DiffRow = {
  left: { op: "equal" | "del"; line: string } | null;
  right: { op: "equal" | "add"; line: string } | null;
};

export function myersDiffLines(aLines: string[], bLines: string[]): DiffOp[] {
  const N = aLines.length;
  const M = bLines.length;
  const max = N + M;

  let v = new Map<number, number>();
  v.set(1, 0);
  const trace: Array<Map<number, number>> = [];

  let found = false;
  for (let d = 0; d <= max; d++) {
    const v2 = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0));
      let x = down ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1;
      let y = x - k;

      while (x < N && y < M && aLines[x] === bLines[y]) {
        x++;
        y++;
      }
      v2.set(k, x);
      if (x >= N && y >= M) {
        trace.push(v2);
        found = true;
        break;
      }
    }
    trace.push(v2);
    v = v2;
    if (found) break;
  }

  const ops: DiffOp[] = [];
  let x = N;
  let y = M;

  for (let d = trace.length - 1; d >= 0; d--) {
    const k = x - y;

    if (d === 0) {
      while (x > 0 && y > 0) {
        ops.push({ op: "equal", line: aLines[x - 1] });
        x--;
        y--;
      }
      break;
    }

    const vPrev = trace[d - 1];
    const down = k === -d || (k !== d && (vPrev.get(k - 1) ?? 0) < (vPrev.get(k + 1) ?? 0));
    const prevK = down ? k + 1 : k - 1;
    const prevX = vPrev.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ op: "equal", line: aLines[x - 1] });
      x--;
      y--;
    }

    if (down) {
      if (y > 0) {
        ops.push({ op: "add", line: bLines[y - 1] });
        y--;
      }
    } else {
      if (x > 0) {
        ops.push({ op: "del", line: aLines[x - 1] });
        x--;
      }
    }
  }

  ops.reverse();
  return ops;
}

export function buildSideBySideDiffRows(aText: string, bText: string): DiffRow[] {
  const aLines = String(aText || "").replace(/\r\n/g, "\n").split("\n");
  const bLines = String(bText || "").replace(/\r\n/g, "\n").split("\n");
  const ops = myersDiffLines(aLines, bLines);

  const rows: DiffRow[] = [];

  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === "equal") {
      rows.push({ left: { op: "equal", line: o.line }, right: { op: "equal", line: o.line } });
      continue;
    }
    if (o.op === "del") {
      const next = ops[i + 1];
      if (next?.op === "add") {
        rows.push({ left: { op: "del", line: o.line }, right: { op: "add", line: next.line } });
        i++;
      } else {
        rows.push({ left: { op: "del", line: o.line }, right: null });
      }
      continue;
    }
    rows.push({ left: null, right: { op: "add", line: o.line } });
  }

  return rows;
}
