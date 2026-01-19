/**
 * Markdown Table Parser Utilities
 * Handles parsing of Markdown tables with multi-line cells and special columns
 */

import type { MarkdownTable } from "./types";

/**
 * Parse a Markdown table from a string block
 * Supports standard Markdown table syntax with | delimiters
 */
export function parseMarkdownTable(tableText: string): MarkdownTable {
  const lines = tableText
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("Table must have at least 2 lines (header + separator)");
  }

  // Extract headers from first line
  const headerLine = lines[0];
  const headers = parseTableRow(headerLine);

  // Skip separator line (line 1)
  // Parse data rows (line 2+)
  const rows: Array<Record<string, string>> = [];

  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i];
    const cells = parseTableRow(rowLine);

    if (cells.length !== headers.length) {
      console.warn(
        `Row ${i} has ${cells.length} cells, expected ${headers.length}. Skipping row.`
      );
      continue;
    }

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = cells[idx] || "";
    });

    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Parse a single table row, handling escaped pipes
 */
function parseTableRow(line: string): string[] {
  // Remove leading/trailing pipes
  let cleaned = line.trim();
  if (cleaned.startsWith("|")) cleaned = cleaned.slice(1);
  if (cleaned.endsWith("|")) cleaned = cleaned.slice(0, -1);

  // Split by pipe and trim each cell
  const cells = cleaned.split("|").map((cell) => cell.trim());

  return cells;
}

/**
 * Extract specific column from a table
 */
export function getTableColumn(table: MarkdownTable, columnName: string): string[] {
  return table.rows.map((row) => row[columnName] || "");
}

/**
 * Find a table by looking for a specific header pattern
 */
export function extractTableFromSection(
  sectionText: string,
  minHeaders: number = 2
): MarkdownTable | null {
  const lines = sectionText.split("\n");

  // Find table start (line with pipes)
  let tableStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Accept both standard markdown separator (`---`) and aligned variants (`:---`, `---:`).
    // Example: "| :--- | ---: | :---: |"
    const isSeparatorLine =
      line.includes("|") &&
      /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim());
    if (isSeparatorLine) {
      // Found separator line, table starts one line before
      tableStartIdx = Math.max(0, i - 1);
      break;
    }
  }

  if (tableStartIdx === -1) return null;

  // Find table end (first non-table line after start)
  let tableEndIdx = tableStartIdx;
  for (let i = tableStartIdx; i < lines.length; i++) {
    if (lines[i].trim().length === 0) break;
    if (!lines[i].includes("|")) break;
    tableEndIdx = i;
  }

  const tableText = lines.slice(tableStartIdx, tableEndIdx + 1).join("\n");

  try {
    const table = parseMarkdownTable(tableText);
    if (table.headers.length >= minHeaders) {
      return table;
    }
  } catch (error) {
    console.warn("Failed to parse table:", error);
  }

  return null;
}

/**
 * Clean cell content (remove extra whitespace, handle multi-line)
 */
export function cleanCellContent(content: string): string {
  return content
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\*\*/g, "") // Remove bold markers
    .replace(/\*/g, ""); // Remove italic markers
}

/**
 * Extract "Answer (for database)" from exercise tables
 */
export function extractAnswerFromTable(
  row: Record<string, string>
): string | null {
  // Try different possible column names
  const answerColumns = [
    "Answer (for database)",
    "Answer",
    "Correct Answer (for database)",
    "Correct Answer",
  ];

  for (const col of answerColumns) {
    if (row[col]) {
      return cleanCellContent(row[col]);
    }
  }

  return null;
}

/**
 * Split multiple answers (e.g., "Slobodan sam. / Slobodna sam.")
 */
export function splitMultipleAnswers(answer: string): string[] {
  return answer
    .split("/")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}
