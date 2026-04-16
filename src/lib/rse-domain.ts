import type { SectionDefinition, SectionField, SectionRow } from "@/lib/rse-manager";
import { normalizeText, parseNumberFlexible, parseSpreadsheetDate } from "@/lib/rse-format";

export type OddMetric = {
    odd: number;
    label: string;
    description: string;
    count: number;
    mentions: number;
    declaredCount: number;
};

export type OddSummary = {
    metrics: OddMetric[];
    detectedOddCount: number;
    totalReleves: number;
};

export type ContractSummaryRow = {
    type: string;
    count: number;
    ratio: number;
};

export type RegisterYearFlowDatum = {
    year: string;
    entrees: number;
    sorties: number;
    solde: number;
};

export const ODD_DESCRIPTIONS: Record<number, string> = {
    1: "Pas de pauvrete",
    2: "Faim zero",
    3: "Bonne sante et bien-etre",
    4: "Education de qualite",
    5: "Egalite entre les sexes",
    6: "Eau propre et assainissement",
    7: "Energie propre et d'un cout abordable",
    8: "Travail decent et croissance economique",
    9: "Industrie, innovation et infrastructure",
    10: "Inegalites reduites",
    11: "Villes et communautes durables",
    12: "Consommation et production responsables",
    13: "Lutte contre les changements climatiques",
    14: "Vie aquatique",
    15: "Vie terrestre",
    16: "Paix, justice et institutions efficaces",
    17: "Partenariats pour la realisation des objectifs",
};

const CONTRACT_ORDER = ["CDI", "ALTERNANT", "CDD", "INTERIM", "PRESTATAIRE", "STAGE"];

function safeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function extractOddNumbers(text: string): number[] {
    const out = new Set<number>();
    const regex = /\bODD\s*0?([1-9]|1[0-7])\b/gi;
    let match: RegExpExecArray | null = regex.exec(text);
    while (match) {
        const odd = Number(match[1]);
        if (odd >= 1 && odd <= 17) {
            out.add(odd);
        }
        match = regex.exec(text);
    }
    return [...out.values()];
}

function findFieldKey(fields: SectionField[], keywords: string[]): string | null {
    for (const field of fields) {
        const haystack = `${field.key} ${field.label}`;
        const normalized = normalizeText(haystack);
        if (keywords.some((keyword) => normalized.includes(keyword))) {
            return field.key;
        }
    }
    return null;
}

function normalizeContractType(raw: string): string {
    const cleaned = normalizeText(raw).replace(/[^a-z0-9]/g, "");
    if (!cleaned) return "Autre";
    if (cleaned.includes("cdi")) return "CDI";
    if (cleaned.includes("cdd")) return "CDD";
    if (cleaned.includes("alternance") || cleaned.includes("alternant") || cleaned.includes("apprenti")) {
        return "ALTERNANT";
    }
    if (cleaned.includes("interim") || cleaned.includes("interimaire")) return "INTERIM";
    if (cleaned.includes("prestataire") || cleaned.includes("consultant")) return "PRESTATAIRE";
    if (cleaned.includes("stage") || cleaned.includes("stagiaire")) return "STAGE";
    return raw.trim() || "Autre";
}

export function isOddSectionName(name: string): boolean {
    const normalized = normalizeText(name);
    return normalized.includes("odd") || normalized.includes("objectifs developpement durable");
}

export function isPersonnelRegisterSectionName(name: string): boolean {
    const normalized = normalizeText(name);
    return normalized.includes("registre") && normalized.includes("personnel");
}

export function buildOddSummary(rows: SectionRow[]): OddSummary {
    const mentionsByOdd = new Map<number, number>();
    const declaredByOdd = new Map<number, number>();

    for (let odd = 1; odd <= 17; odd += 1) {
        mentionsByOdd.set(odd, 0);
        declaredByOdd.set(odd, 0);
    }

    rows.forEach((row) => {
        const values = Object.values(row.values)
            .map((value) => safeText(value))
            .filter((value) => value !== "");
        if (values.length === 0) return;

        const oddInRow = new Set<number>();
        values.forEach((value) => {
            extractOddNumbers(value).forEach((odd) => {
                oddInRow.add(odd);
                mentionsByOdd.set(odd, (mentionsByOdd.get(odd) ?? 0) + 1);
            });
        });

        if (oddInRow.size !== 1) return;

        const odd = [...oddInRow.values()][0];
        const numericCandidates = values
            .filter((value) => !/\bODD\s*0?([1-9]|1[0-7])\b/i.test(value))
            .map((value) => parseNumberFlexible(value))
            .filter((value): value is number => value !== null && value >= 0);

        const countCandidate = numericCandidates
            .map((value) => Math.round(value))
            .find((value) => Number.isFinite(value) && value >= 1 && value <= 100000);

        if (countCandidate !== undefined) {
            declaredByOdd.set(odd, Math.max(declaredByOdd.get(odd) ?? 0, countCandidate));
        }
    });

    const metrics: OddMetric[] = [];
    for (let odd = 1; odd <= 17; odd += 1) {
        const mentions = mentionsByOdd.get(odd) ?? 0;
        const declaredCount = declaredByOdd.get(odd) ?? 0;
        const count = declaredCount > 0 ? declaredCount : mentions;
        metrics.push({
            odd,
            label: `ODD ${odd}`,
            description: ODD_DESCRIPTIONS[odd] ?? `Objectif ${odd}`,
            count,
            mentions,
            declaredCount,
        });
    }

    const detectedOddCount = metrics.filter((metric) => metric.count > 0).length;
    const totalReleves = metrics.reduce((sum, metric) => sum + metric.count, 0);

    return {
        metrics,
        detectedOddCount,
        totalReleves,
    };
}

export function buildRegisterContractAutoSummary(section: SectionDefinition, rows: SectionRow[]): ContractSummaryRow[] {
    const statutKey = findFieldKey(section.fields, ["statut", "typecontrat", "type de contrat"]);
    if (!statutKey) return [];

    const sortieKey = findFieldKey(section.fields, ["date de sortie", "date_sortie", "sortie"]);
    const counts = new Map<string, number>();

    rows.forEach((row) => {
        const exitRaw = sortieKey ? safeText(row.values[sortieKey]) : "";
        if (exitRaw !== "") return;

        const rawType = safeText(row.values[statutKey]);
        if (!rawType) return;
        const type = normalizeContractType(rawType);
        counts.set(type, (counts.get(type) ?? 0) + 1);
    });

    const sourceContractRows = rows
        .map((row) => {
            const first = safeText(row.values[section.fields[0]?.key ?? ""]);
            const second = safeText(row.values[section.fields[1]?.key ?? ""]);
            if (!first || !second) return null;
            const type = normalizeContractType(first);
            const count = parseNumberFlexible(second);
            if (count === null) return null;
            if (!CONTRACT_ORDER.includes(type) && type === "Autre") return null;
            return { type, count: Math.max(0, Math.round(count)) };
        })
        .filter((row): row is { type: string; count: number } => row !== null);

    sourceContractRows.forEach((row) => {
        if ((counts.get(row.type) ?? 0) === 0 && row.count > 0) {
            counts.set(row.type, row.count);
        }
    });

    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total === 0) return [];

    const inOrder = CONTRACT_ORDER;
    const others = [...counts.keys()].filter((type) => !CONTRACT_ORDER.includes(type)).sort((a, b) => a.localeCompare(b));

    return [...inOrder, ...others].map((type) => {
        const count = counts.get(type) ?? 0;
        return {
            type,
            count,
            ratio: total > 0 ? count / total : 0,
        };
    });
}

export function buildRegisterYearFlow(section: SectionDefinition, rows: SectionRow[]): RegisterYearFlowDatum[] {
    const entreeKey = findFieldKey(section.fields, ["date d'entree", "date entree", "date_entree", "entree"]);
    const sortieKey = findFieldKey(section.fields, ["date de sortie", "date_sortie", "sortie"]);
    if (!entreeKey && !sortieKey) return [];

    const map = new Map<string, { entrees: number; sorties: number }>();
    const ensure = (year: string) => {
        if (!map.has(year)) {
            map.set(year, { entrees: 0, sorties: 0 });
        }
        return map.get(year)!;
    };

    rows.forEach((row) => {
        if (entreeKey) {
            const date = parseSpreadsheetDate(safeText(row.values[entreeKey]));
            if (date) {
                const year = String(date.getFullYear());
                ensure(year).entrees += 1;
            }
        }

        if (sortieKey) {
            const date = parseSpreadsheetDate(safeText(row.values[sortieKey]));
            if (date) {
                const year = String(date.getFullYear());
                ensure(year).sorties += 1;
            }
        }
    });

    return [...map.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([year, values]) => ({
            year,
            entrees: values.entrees,
            sorties: values.sorties,
            solde: values.entrees - values.sorties,
        }));
}
