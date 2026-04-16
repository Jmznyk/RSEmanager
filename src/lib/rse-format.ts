import type { SectionField } from "@/lib/rse-manager";

function safeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

export function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function parseNumberFlexible(value: string): number | null {
    const raw = safeText(value);
    if (!raw) return null;

    let cleaned = raw
        .replace(/\u00A0/g, "")
        .replace(/\s/g, "")
        .replace(/[€$£%]/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
        if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
            cleaned = cleaned.replace(/\./g, "").replace(",", ".");
        } else {
            cleaned = cleaned.replace(/,/g, "");
        }
    } else if (cleaned.includes(",")) {
        cleaned = cleaned.replace(",", ".");
    }

    if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

export function excelSerialToDate(serial: number): Date | null {
    if (!Number.isFinite(serial)) return null;
    if (serial <= 0 || serial > 90000) return null;
    const epoch = Date.UTC(1899, 11, 30);
    const millis = Math.round(serial * 86400000);
    const date = new Date(epoch + millis);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSpreadsheetDate(value: string): Date | null {
    const raw = safeText(value);
    if (!raw) return null;

    const asNumber = parseNumberFlexible(raw);
    if (asNumber !== null && asNumber > 20000 && asNumber < 90000) {
        return excelSerialToDate(asNumber);
    }

    const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const yyyymmdd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;

    if (ddmmyyyy.test(raw)) {
        const m = raw.match(ddmmyyyy);
        if (!m) return null;
        const day = Number(m[1]);
        const month = Number(m[2]) - 1;
        const year = Number(m[3]);
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (yyyymmdd.test(raw)) {
        const m = raw.match(yyyymmdd);
        if (!m) return null;
        const year = Number(m[1]);
        const month = Number(m[2]) - 1;
        const day = Number(m[3]);
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDateFr(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function looksLikePercentField(field: SectionField): boolean {
    const label = normalizeText(field.label);
    return label.includes("%") || label.includes("pourcentage") || label.includes("taux");
}

function shouldDisplayAsPercent(field: SectionField, value: number): boolean {
    if (looksLikePercentField(field)) return true;
    if (value >= 0 && value <= 1) return true;
    return false;
}

function looksLikeRatioString(raw: string): boolean {
    const compact = raw.replace(/\s/g, "");
    return /^0[.,]\d{3,}$/.test(compact) || /[eE]-\d+/.test(compact);
}

export function formatFieldValue(field: SectionField, rawValue: string): string {
    const text = safeText(rawValue);
    if (!text) return "-";

    if (field.inputType === "date") {
        const date = parseSpreadsheetDate(text);
        return date ? formatDateFr(date) : text;
    }

    if (field.inputType === "number") {
        const parsed = parseNumberFlexible(text);
        if (parsed === null) return text;
        if (shouldDisplayAsPercent(field, parsed)) {
            const percent = parsed <= 1 ? parsed * 100 : parsed;
            return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent)} %`;
        }
        return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(parsed);
    }

    const parsedTextNumber = parseNumberFlexible(text);
    if (parsedTextNumber !== null) {
        const forcePercent =
            looksLikePercentField(field) ||
            (parsedTextNumber >= 0 && parsedTextNumber <= 1 && looksLikeRatioString(text));
        if (forcePercent) {
            const percent = parsedTextNumber <= 1 ? parsedTextNumber * 100 : parsedTextNumber;
            return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(percent)} %`;
        }
    }

    const label = normalizeText(field.label);
    const maybeDate = label.includes("date") ? parseSpreadsheetDate(text) : null;
    if (maybeDate && /\d/.test(text) && text.length <= 12) {
        return formatDateFr(maybeDate);
    }

    return text;
}

export function monthKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}
