import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DateInput = Date | number | string;

function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  return d;
}

function partsMap(parts: Intl.DateTimeFormatPart[]) {
  const out: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/**
 * European date format for the whole app:
 * - Date:   TT.MM.JJJJ
 * - DateTime: TT.MM.JJJJ HH:MM (24h)
 */
export function formatDateEU(input: DateInput): string {
  const d = toDate(input);
  const m = partsMap(
    new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d)
  );
  return `${m.day}.${m.month}.${m.year}`;
}

export function formatDateShortEU(input: DateInput): string {
  const d = toDate(input);
  const m = partsMap(new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).formatToParts(d));
  return `${m.day}.${m.month}`;
}

export function formatMonthYearShortEU(input: DateInput): string {
  const d = toDate(input);
  const m = partsMap(new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "2-digit" }).formatToParts(d));
  return `${m.month}.${m.year}`;
}

export function formatTimeEU(input: DateInput): string {
  const d = toDate(input);
  const m = partsMap(
    new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d)
  );
  return `${m.hour}:${m.minute}`;
}

export function formatDateTimeEU(input: DateInput): string {
  const d = toDate(input);
  return `${formatDateEU(d)} ${formatTimeEU(d)}`;
}