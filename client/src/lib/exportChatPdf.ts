import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { marked } from "marked";
import type { Doc } from "../../../convex/_generated/dataModel";
import { APP_LOGO, APP_TITLE } from "@/const";

type ChatMessage = Doc<"chatMessages">;

export type ChatPdfLabels = {
  exportedOn: string;
  userLabel: string;
  assistantLabel: string;
  attachmentNote: string;
  noMessages: string;
  footerNotice: string;
  personalUseOnly: string;
};

/** A4 content width at 96 CSS px/in – matches print layout. */
const PDF_WIDTH_PX = 794;
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
/** Print margins – applied on `.pdf-export-root` so they appear on the physical page. */
const PDF_PAGE_MARGIN_MM = {
  top: 18,
  right: 22,
  bottom: 14,
  left: 22,
} as const;
const RASTER_SCALE = 2;
const JPEG_QUALITY = 0.92;
const FOOTER_HEIGHT_MM = 14;
/** Vertical padding inside `.pdf-export-body` (top + bottom). */
const PDF_BODY_VERTICAL_PADDING_PX = 18;
/** Browser canvas height limit (~16k px); leave headroom for scale factor. */
const MAX_RASTER_HEIGHT_PX = 14_000;

function mmToPx(mm: number): number {
  return Math.round((mm / PDF_PAGE_WIDTH_MM) * PDF_WIDTH_PX);
}

const PDF_MARGIN_TOP_PX = mmToPx(PDF_PAGE_MARGIN_MM.top);
const PDF_MARGIN_RIGHT_PX = mmToPx(PDF_PAGE_MARGIN_MM.right);
const PDF_MARGIN_BOTTOM_PX = mmToPx(PDF_PAGE_MARGIN_MM.bottom);
const PDF_MARGIN_LEFT_PX = mmToPx(PDF_PAGE_MARGIN_MM.left);
const PDF_CONTENT_WIDTH_PX =
  PDF_WIDTH_PX - PDF_MARGIN_LEFT_PX - PDF_MARGIN_RIGHT_PX;

type ExportBlock = {
  html: string;
  heightPx: number;
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

function sanitizeFileName(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base || "chat";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExportDate(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function markdownToHtml(content: string): string {
  return marked.parse(content, { async: false }) as string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function resolveLogoDataUrl(): Promise<string> {
  const logoPath = APP_LOGO.startsWith("http") ? APP_LOGO : `${window.location.origin}${APP_LOGO}`;
  try {
    const img = await loadImage(logoPath);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 120;
    canvas.height = img.naturalHeight || 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function pdfExportStyles(): string {
  return `
    * { box-sizing: border-box; }
    .pdf-export-root {
      width: ${PDF_WIDTH_PX}px;
      padding: ${PDF_MARGIN_TOP_PX}px ${PDF_MARGIN_RIGHT_PX}px ${PDF_MARGIN_BOTTOM_PX}px ${PDF_MARGIN_LEFT_PX}px;
      background: #ffffff;
      color: #111827;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.55;
      -webkit-user-select: none;
      user-select: none;
    }
    .pdf-export-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 0 8px;
      margin-bottom: 8px;
      border-bottom: 2px solid #0C4076;
      background: #f8fafc;
    }
    .pdf-export-logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .pdf-export-brand {
      flex: 1;
      min-width: 0;
    }
    .pdf-export-brand-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0C4076;
      letter-spacing: -0.02em;
    }
    .pdf-export-brand-sub {
      margin: 2px 0 0;
      font-size: 11px;
      color: #6b7280;
    }
    .pdf-export-session-title {
      margin: 0;
      padding: 0 0 4px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      line-height: 1.25;
    }
    .pdf-export-meta {
      margin: 0;
      padding: 0 0 8px;
      font-size: 10px;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
    .pdf-export-notice {
      margin: 8px 0 0;
      padding: 5px 8px;
      font-size: 9px;
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 4px;
    }
    .pdf-export-body {
      padding: 8px 0 10px;
      display: flow-root;
    }
    .pdf-export-message {
      margin: 0 0 8px;
      padding: 7px 9px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #fafafa;
    }
    .pdf-export-message.user {
      background: #f0f7ff;
      border-color: #bfdbfe;
    }
    .pdf-export-message.assistant {
      margin-bottom: 6px;
      padding: 0 0 4px;
      border: none;
      border-radius: 0;
      background: transparent;
    }
    .pdf-export-message.continued {
      margin-top: 0;
      margin-bottom: 6px;
      padding-top: 0;
    }
    .pdf-export-message.continued.assistant {
      border-top: none;
    }
    .pdf-export-message-header {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #374151;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .pdf-export-message.user .pdf-export-message-header { color: #0C4076; }
    .pdf-export-message.assistant .pdf-export-message-header { color: #C6363C; }
    .pdf-export-message-content { font-size: 13px; color: #1f2937; line-height: 1.55; }
    .pdf-export-message-content p { margin: 0 0 4px; }
    .pdf-export-message-content p:last-child { margin-bottom: 0; }
    .pdf-export-message-content ul,
    .pdf-export-message-content ol { margin: 0 0 4px; padding-left: 18px; }
    .pdf-export-message-content li { margin-bottom: 1px; }
    .pdf-export-message-content h1,
    .pdf-export-message-content h2,
    .pdf-export-message-content h3 {
      margin: 8px 0 3px;
      font-weight: 700;
      color: #111827;
    }
    .pdf-export-message-content h1:first-child,
    .pdf-export-message-content h2:first-child,
    .pdf-export-message-content h3:first-child {
      margin-top: 0;
    }
    .pdf-export-message-content h1 { font-size: 16px; }
    .pdf-export-message-content h2 { font-size: 14px; }
    .pdf-export-message-content h3 { font-size: 13px; }
    .pdf-export-message-content code {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      background: #f3f4f6;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .pdf-export-message-content pre {
      margin: 0 0 6px;
      padding: 8px;
      background: #1f2937;
      color: #f9fafb;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 11px;
      line-height: 1.4;
    }
    .pdf-export-message-content pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    .pdf-export-message-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 8px;
      font-size: 12px;
      table-layout: fixed;
      word-wrap: break-word;
    }
    .pdf-export-message-content th {
      background: #0C4076;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #0a3562;
    }
    .pdf-export-message-content td {
      padding: 5px 8px;
      border: 1px solid #d1d5db;
      vertical-align: top;
    }
    .pdf-export-message-content thead th {
      background: #0C4076;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #0a3562;
    }
    .pdf-export-message-content tbody td {
      padding: 5px 8px;
      border: 1px solid #d1d5db;
      vertical-align: top;
    }
    .pdf-export-message-content tbody tr:nth-child(even) td {
      background: #f9fafb;
    }
    .pdf-export-message-content tr:nth-child(even) td {
      background: #f9fafb;
    }
    .pdf-export-message-content blockquote {
      margin: 0 0 12px;
      padding: 8px 14px;
      border-left: 4px solid #0C4076;
      background: #f8fafc;
      color: #374151;
    }
    .pdf-export-attachment {
      margin-top: 10px;
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
    }
    .pdf-export-empty {
      padding: 24px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  `;
}

function getPageContentHeightPx(): number {
  const contentWidthMm =
    PDF_PAGE_WIDTH_MM - PDF_PAGE_MARGIN_MM.left - PDF_PAGE_MARGIN_MM.right;
  const contentHeightMm =
    PDF_PAGE_HEIGHT_MM -
    FOOTER_HEIGHT_MM -
    PDF_PAGE_MARGIN_MM.top -
    PDF_PAGE_MARGIN_MM.bottom;
  return Math.round((contentHeightMm / contentWidthMm) * PDF_CONTENT_WIDTH_PX);
}

function getPdfSliceHeightMm(): number {
  return (
    PDF_PAGE_HEIGHT_MM -
    FOOTER_HEIGHT_MM -
    PDF_PAGE_MARGIN_MM.top -
    PDF_PAGE_MARGIN_MM.bottom
  );
}

function wrapExportDocument(bodyHtml: string): string {
  return `<style>${pdfExportStyles()}</style><div class="pdf-export-root">${bodyHtml}</div>`;
}

function buildHeaderBlockHtml(options: {
  sessionTitle: string;
  labels: ChatPdfLabels;
  locale: string;
  logoDataUrl: string;
}): string {
  const exportDate = formatExportDate(new Date(), options.locale);
  const logoImg = options.logoDataUrl
    ? `<img class="pdf-export-logo" src="${options.logoDataUrl}" alt="" />`
    : "";

  return `
    <header class="pdf-export-header">
      ${logoImg}
      <div class="pdf-export-brand">
        <p class="pdf-export-brand-title">${escapeHtml(APP_TITLE)}</p>
        <p class="pdf-export-brand-sub">${escapeHtml(options.labels.personalUseOnly)}</p>
      </div>
    </header>
    <h1 class="pdf-export-session-title">${escapeHtml(options.sessionTitle)}</h1>
    <p class="pdf-export-meta">${escapeHtml(options.labels.exportedOn)}: ${escapeHtml(exportDate)}</p>
    <div class="pdf-export-notice">${escapeHtml(options.labels.personalUseOnly)} — ${escapeHtml(options.labels.footerNotice)}</div>
  `;
}

function splitHtmlIntoTopLevelBlocks(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstElementChild;
  if (!container) return [html];

  const blocks: string[] = [];
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push(`<p>${escapeHtml(text)}</p>`);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    blocks.push((node as Element).outerHTML);
  }

  return blocks.length > 0 ? blocks : [html];
}

function isHeaderFragment(html: string): boolean {
  return /^\s*<header class="pdf-export-header"/.test(html.trim());
}

function composePageHtml(fragments: string[]): string {
  if (fragments.length === 0) return `<div class="pdf-export-body"></div>`;

  const [first, ...rest] = fragments;
  if (first && isHeaderFragment(first)) {
    if (rest.length === 0) return first;
    return `${first}<div class="pdf-export-body">${rest.join("")}</div>`;
  }

  return `<div class="pdf-export-body">${fragments.join("")}</div>`;
}

function splitListBlock(listHtml: string, chunkSize = 6): string[] {
  const doc = new DOMParser().parseFromString(listHtml, "text/html");
  const list = doc.body.firstElementChild;
  if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) {
    return [listHtml];
  }

  const tag = list.tagName.toLowerCase();
  const items = Array.from(list.querySelectorAll(":scope > li"));
  if (items.length <= chunkSize) return [listHtml];

  const chunks: string[] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    const slice = items.slice(index, index + chunkSize);
    chunks.push(`<${tag}>${slice.map((li) => li.outerHTML).join("")}</${tag}>`);
  }
  return chunks;
}

function wrapMessageArticleHtml(options: {
  role: ChatMessage["role"];
  headerHtml: string;
  bodyHtml: string;
  attachmentHtml: string;
  continued: boolean;
}): string {
  const continuedClass = options.continued ? " continued" : "";
  return `<article class="pdf-export-message ${options.role}${continuedClass}">${options.headerHtml}<div class="pdf-export-message-content">${options.bodyHtml}${options.attachmentHtml}</div></article>`;
}

function buildMessageBlockHtml(options: {
  role: ChatMessage["role"];
  roleLabel: string;
  time: string;
  bodyHtml: string;
  attachmentHtml: string;
  continued: boolean;
}): string {
  const header = options.continued
    ? ""
    : `<div class="pdf-export-message-header">${escapeHtml(options.roleLabel)} · ${escapeHtml(options.time)}</div>`;

  return wrapMessageArticleHtml({
    role: options.role,
    headerHtml: header,
    bodyHtml: options.bodyHtml,
    attachmentHtml: options.attachmentHtml,
    continued: options.continued,
  });
}

function buildExportBlocks(options: {
  sessionTitle: string;
  messages: ChatMessage[];
  labels: ChatPdfLabels;
  locale: string;
  logoDataUrl: string;
}): string[] {
  const { sessionTitle, messages, labels, locale, logoDataUrl } = options;
  const sorted = [...messages].sort((a, b) => a._creationTime - b._creationTime);
  const blocks: string[] = [];

  blocks.push(buildHeaderBlockHtml({ sessionTitle, labels, locale, logoDataUrl }));

  if (sorted.length === 0) {
    blocks.push(`<div class="pdf-export-empty">${escapeHtml(labels.noMessages)}</div>`);
    return blocks;
  }

  for (const message of sorted) {
    const role = message.role;
    const roleLabel = role === "user" ? labels.userLabel : labels.assistantLabel;
    const time = formatMessageTime(message._creationTime, locale);
    const attachment = message.attachmentFileName
      ? `<div class="pdf-export-attachment">[${escapeHtml(labels.attachmentNote)}: ${escapeHtml(message.attachmentFileName)}]</div>`
      : "";

    blocks.push(
      buildMessageBlockHtml({
        role,
        roleLabel,
        time,
        bodyHtml: markdownToHtml(message.content),
        attachmentHtml: attachment,
        continued: false,
      })
    );
  }

  return blocks;
}

async function withExportIframe<T>(
  bodyHtml: string,
  run: (doc: Document, root: HTMLElement, iframe: HTMLIFrameElement) => Promise<T> | T
): Promise<T> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-100000px";
  iframe.style.top = "0";
  iframe.style.width = `${PDF_WIDTH_PX}px`;
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("PDF export iframe unavailable");

    doc.open();
    doc.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;color:#111827;">${wrapExportDocument(bodyHtml)}</body></html>`
    );
    doc.close();

    await doc.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const root = doc.querySelector(".pdf-export-root") as HTMLElement | null;
    if (!root) throw new Error("PDF export layout missing");

    const contentHeightPx = Math.max(root.scrollHeight, root.offsetHeight, 1);
    iframe.style.height = `${contentHeightPx}px`;

    return await run(doc, root, iframe);
  } finally {
    document.body.removeChild(iframe);
  }
}

async function measureBlockHeights(blockHtmlList: string[]): Promise<number[]> {
  if (blockHtmlList.length === 0) return [];

  const measureHtml = blockHtmlList
    .map((block, index) => {
      const blockMarkup = isHeaderFragment(block)
        ? block
        : block.startsWith("<div class=\"pdf-export-empty\"")
          ? composePageHtml([block])
          : block;
      return `<div class="pdf-export-measure-block" data-idx="${index}">${blockMarkup}</div>`;
    })
    .join("");

  return withExportIframe(measureHtml, (doc) => {
    const heights: number[] = [];
    for (let index = 0; index < blockHtmlList.length; index += 1) {
      const node = doc.querySelector(
        `.pdf-export-measure-block[data-idx="${index}"]`
      ) as HTMLElement | null;
      heights.push(node ? Math.max(node.offsetHeight, node.scrollHeight, 1) : 1);
    }
    return heights;
  });
}

function isHeadingHtml(block: string): boolean {
  return /^<h[1-6]\b/i.test(block.trim());
}

function isMajorSectionHeadingHtml(block: string): boolean {
  return /^<h[12]\b/i.test(block.trim());
}

/** Keep every heading attached to the content that follows it (no orphan headings). */
function splitContentIntoAtomicGroups(children: string[]): string[] {
  if (children.length <= 1) return children;

  const groups: string[] = [];
  let index = 0;

  while (index < children.length) {
    const child = children[index]!;

    if (isHeadingHtml(child)) {
      const group: string[] = [child];
      index += 1;
      const major = isMajorSectionHeadingHtml(child);

      while (index < children.length) {
        const next = children[index]!;
        if (major && isMajorSectionHeadingHtml(next)) break;
        if (!major && isHeadingHtml(next)) break;
        group.push(next);
        index += 1;
      }

      groups.push(group.join(""));
      continue;
    }

    groups.push(child);
    index += 1;
  }

  return groups;
}

function isHeadingOnlyMessageBlock(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const content = doc.body.querySelector(".pdf-export-message-content");
  if (!content) return false;

  const elements = Array.from(content.children).filter(
    (element) => !element.classList.contains("pdf-export-attachment")
  );
  if (elements.length !== 1) return false;
  return /^H[1-6]$/i.test(elements[0]!.tagName);
}

function splitOverflowContent(children: string[], maxElements = 6): string[] | null {
  const atomicGroups = splitContentIntoAtomicGroups(children);
  if (atomicGroups.length > 1) return atomicGroups;

  if (children.length === 1) {
    const only = children[0]!;
    if (/^<(ul|ol)\b/i.test(only.trim())) {
      const listParts = splitListBlock(only);
      if (listParts.length > 1) return listParts;
    }
    return null;
  }

  const batches: string[] = [];
  let batch: string[] = [];

  for (const child of children) {
    if (isHeadingHtml(child) && batch.length > 0) {
      batches.push(batch.join(""));
      batch = [child];
      continue;
    }

    batch.push(child);
    if (batch.length >= maxElements) {
      batches.push(batch.join(""));
      batch = [];
    }
  }

  if (batch.length > 0) batches.push(batch.join(""));
  return batches.length > 1 ? batches : null;
}

function splitOversizedBlock(html: string): string[] | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const article = doc.body.querySelector("article.pdf-export-message");
  if (!article) return null;

  const content = article.querySelector(".pdf-export-message-content");
  if (!content) return null;

  const headerEl = article.querySelector(".pdf-export-message-header");
  const headerHtml = headerEl?.outerHTML ?? "";
  const attachmentEl = content.querySelector(".pdf-export-attachment");
  const attachmentHtml = attachmentEl?.outerHTML ?? "";
  attachmentEl?.remove();

  const role = article.classList.contains("user") ? "user" : "assistant";
  const wasContinued = article.classList.contains("continued");
  const hadHeader = headerEl !== null;
  const children = Array.from(content.children).map((child) => child.outerHTML);

  const wrapPart = (contentHtml: string, index: number, total: number) =>
    wrapMessageArticleHtml({
      role: role as ChatMessage["role"],
      headerHtml: hadHeader && index === 0 && !wasContinued ? headerHtml : "",
      bodyHtml: contentHtml,
      attachmentHtml: index === total - 1 ? attachmentHtml : "",
      continued: wasContinued || index > 0,
    });

  if (children.length > 1) {
    for (let batchSize = 6; batchSize >= 2; batchSize -= 1) {
      const overflowParts = splitOverflowContent(children, batchSize);
      if (overflowParts && overflowParts.length > 1) {
        return overflowParts.map((sectionHtml, index) =>
          wrapPart(sectionHtml, index, overflowParts.length)
        );
      }
    }
  }

  if (children.length === 1) {
    const only = children[0]!;
    if (/^<(ul|ol)\b/i.test(only.trim())) {
      const listParts = splitListBlock(only);
      if (listParts.length > 1) {
        return listParts.map((listHtml, index) =>
          wrapPart(listHtml, index, listParts.length)
        );
      }
    }
  }

  return null;
}

async function normalizeBlocksForPagination(
  blockHtmlList: string[],
  pageContentHeightPx: number
): Promise<ExportBlock[]> {
  let pending = [...blockHtmlList];

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const heights = await measureBlockHeights(pending);
    const nextPending: string[] = [];
    let splitAny = false;

    for (let index = 0; index < pending.length; index += 1) {
      const html = pending[index]!;
      const heightPx = heights[index] ?? 1;

      if (heightPx <= pageContentHeightPx) {
        nextPending.push(html);
        continue;
      }

      const split = splitOversizedBlock(html);
      if (!split || split.length <= 1) {
        nextPending.push(html);
        continue;
      }

      nextPending.push(...split);
      splitAny = true;
    }

    pending = nextPending;
    if (!splitAny) break;
  }

  const heights = await measureBlockHeights(pending);
  return pending.map((html, index) => ({
    html,
    heightPx: heights[index] ?? 1,
  }));
}

const PAGE_BREAK_BUFFER_PX = 12;

function packBlocksIntoPages(
  blocks: ExportBlock[],
  pageContentHeightPx: number
): ExportBlock[][] {
  const maxHeight = pageContentHeightPx - PAGE_BREAK_BUFFER_PX;
  const pages: ExportBlock[][] = [];
  let currentPage: ExportBlock[] = [];
  let currentHeight = 0;
  let bodyPaddingReserved = false;

  const pushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
      bodyPaddingReserved = false;
    }
  };

  const reserveBodyPadding = () => {
    if (bodyPaddingReserved) return;
    bodyPaddingReserved = true;
    currentHeight += PDF_BODY_VERTICAL_PADDING_PX;
  };

  const moveOrphanHeadingToNextPage = () => {
    if (currentPage.length === 0) return;
    const last = currentPage[currentPage.length - 1]!;
    if (!isHeadingOnlyMessageBlock(last.html)) return;

    currentPage.pop();
    currentHeight -= last.heightPx;
    pushPage();
    currentPage.push(last);
    currentHeight = last.heightPx;
    if (!isHeaderFragment(last.html)) reserveBodyPadding();
  };

  for (const block of blocks) {
    if (!isHeaderFragment(block.html)) {
      reserveBodyPadding();
    }

    if (block.heightPx > maxHeight) {
      moveOrphanHeadingToNextPage();
      pushPage();
      pages.push([block]);
      continue;
    }

    if (currentHeight + block.heightPx > maxHeight && currentPage.length > 0) {
      moveOrphanHeadingToNextPage();
      pushPage();
      if (!isHeaderFragment(block.html)) {
        reserveBodyPadding();
      }
    }

    currentPage.push(block);
    currentHeight += block.heightPx;
  }

  pushPage();
  return pages;
}

function resolveRasterScale(contentHeightPx: number): number {
  const projectedHeight = contentHeightPx * RASTER_SCALE;
  if (projectedHeight <= MAX_RASTER_HEIGHT_PX) return RASTER_SCALE;
  return Math.max(1, MAX_RASTER_HEIGHT_PX / contentHeightPx);
}

async function rasterizeHtmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  return withExportIframe(html, async (_doc, root) => {
    const contentHeightPx = Math.max(root.scrollHeight, root.offsetHeight, 1);
    const scale = resolveRasterScale(contentHeightPx);

    return html2canvas(root, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: PDF_WIDTH_PX,
      windowHeight: contentHeightPx,
    });
  });
}

function addFooterToPage(
  pdf: jsPDF,
  footerDataUrl: string,
  pageWidthMm: number,
  pageHeightMm: number
): void {
  pdf.addImage(
    footerDataUrl,
    "PNG",
    0,
    pageHeightMm - FOOTER_HEIGHT_MM,
    pageWidthMm,
    FOOTER_HEIGHT_MM
  );
}

/**
 * Fallback for a single block that is taller than one page (e.g. very large table).
 */
async function appendOversizedCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  footerDataUrl: string,
  pageWidthMm: number,
  pageHeightMm: number,
  contentHeightMm: number,
  startNewPage: boolean
): Promise<void> {
  const sliceHeightPx = Math.floor((contentHeightMm / pageHeightMm) * canvas.height);
  let offsetY = 0;
  let sliceIndex = 0;

  while (offsetY < canvas.height) {
    if (sliceIndex > 0 || (sliceIndex === 0 && startNewPage)) {
      pdf.addPage();
    }

    const sliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const sliceCtx = sliceCanvas.getContext("2d");
    if (!sliceCtx) throw new Error("Canvas unavailable");

    sliceCtx.fillStyle = "#ffffff";
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sliceCtx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const pageImage = sliceCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const renderedHeightMm = (sliceHeight / canvas.width) * pageWidthMm;
    pdf.addImage(pageImage, "JPEG", 0, 0, pageWidthMm, renderedHeightMm);
    addFooterToPage(pdf, footerDataUrl, pageWidthMm, pageHeightMm);

    offsetY += sliceHeight;
    sliceIndex += 1;
    startNewPage = false;
  }
}

async function renderPaginatedPdf(
  pages: ExportBlock[][],
  pageContentHeightPx: number,
  footerDataUrl: string
): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const sliceHeightMm = getPdfSliceHeightMm();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageBlocks = pages[pageIndex]!;
    const pageHtml = composePageHtml(pageBlocks.map((block) => block.html));
    const expectedHeightPx = pageBlocks.reduce((sum, block) => sum + block.heightPx, 0);
    const hasSingleOversizedBlock =
      pageBlocks.length === 1 && expectedHeightPx > pageContentHeightPx * 1.05;

    if (hasSingleOversizedBlock) {
      const canvas = await rasterizeHtmlToCanvas(pageHtml);
      await appendOversizedCanvasToPdf(
        pdf,
        canvas,
        footerDataUrl,
        pageWidthMm,
        pageHeightMm,
        sliceHeightMm,
        pageIndex > 0 || pdf.getNumberOfPages() > 0
      );
      continue;
    }

    const canvas = await rasterizeHtmlToCanvas(pageHtml);
    const renderedHeightMm = (canvas.height / canvas.width) * pageWidthMm;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      "JPEG",
      0,
      0,
      pageWidthMm,
      renderedHeightMm
    );
    addFooterToPage(pdf, footerDataUrl, pageWidthMm, pageHeightMm);
  }

  if (pdf.getNumberOfPages() === 0) {
    pdf.addPage();
    addFooterToPage(pdf, footerDataUrl, pageWidthMm, pageHeightMm);
  }

  return pdf.output("blob");
}

async function buildFooterDataUrl(options: {
  logoDataUrl: string;
  appTitle: string;
  footerNotice: string;
}): Promise<string> {
  const width = PDF_WIDTH_PX * RASTER_SCALE;
  const height = 56 * RASTER_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#f9fafb";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.stroke();

  const padding = 24 * RASTER_SCALE;
  let textX = padding;

  if (options.logoDataUrl) {
    try {
      const logo = await loadImage(options.logoDataUrl);
      const logoSize = 36 * RASTER_SCALE;
      ctx.drawImage(logo, padding, (height - logoSize) / 2, logoSize, logoSize);
      textX = padding + logoSize + 12 * RASTER_SCALE;
    } catch {
      /* logo optional in footer */
    }
  }

  ctx.fillStyle = "#0C4076";
  ctx.font = `bold ${14 * RASTER_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(options.appTitle, textX, height * 0.42);

  ctx.fillStyle = "#6b7280";
  ctx.font = `${11 * RASTER_SCALE}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(options.footerNotice, textX, height * 0.72);

  return canvas.toDataURL("image/png");
}

/**
 * Builds a PDF from rasterized page images only – no text layer, so content
 * cannot be selected or copied from the PDF viewer.
 */
async function buildProtectedPdfBlob(options: {
  sessionTitle: string;
  messages: ChatMessage[];
  labels: ChatPdfLabels;
  locale?: string;
}): Promise<Blob> {
  const locale = options.locale ?? "en-US";
  const logoDataUrl = await resolveLogoDataUrl();
  const pageContentHeightPx = getPageContentHeightPx();
  const blockHtmlList = buildExportBlocks({
    ...options,
    locale,
    logoDataUrl,
  });
  const normalizedBlocks = await normalizeBlocksForPagination(
    blockHtmlList,
    pageContentHeightPx
  );
  const pages = packBlocksIntoPages(normalizedBlocks, pageContentHeightPx);
  const footerDataUrl = await buildFooterDataUrl({
    logoDataUrl,
    appTitle: APP_TITLE,
    footerNotice: options.labels.footerNotice,
  });

  return renderPaginatedPdf(pages, pageContentHeightPx, footerDataUrl);
}

export async function exportChatToPdfBlob(options: {
  sessionTitle: string;
  messages: ChatMessage[];
  labels: ChatPdfLabels;
  locale?: string;
}): Promise<Blob> {
  return buildProtectedPdfBlob(options);
}

export async function exportChatToPdf(options: {
  sessionTitle: string;
  messages: ChatMessage[];
  labels: ChatPdfLabels;
  locale?: string;
}): Promise<void> {
  const blob = await buildProtectedPdfBlob(options);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileName(options.sessionTitle)}-${dateStamp}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
