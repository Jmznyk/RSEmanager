import type { PersistedState, SectionDefinition, SectionRow } from "@/lib/rse-manager";
import { monthKeyFromDate, normalizeText, parseNumberFlexible, parseSpreadsheetDate } from "@/lib/rse-format";

export type CompletionDatum = {
    field: string;
    rate: number;
};

export type CategoryDatum = {
    label: string;
    count: number;
};

export type NumericDatum = {
    field: string;
    avg: number;
    total: number;
    min: number;
    max: number;
};

export type TrendDatum = {
    period: string;
    value: number;
};

export type SectionInsights = {
    rowCount: number;
    completionRate: number;
    completionByField: CompletionDatum[];
    categoryFieldLabel: string | null;
    categoryBreakdown: CategoryDatum[];
    numericSummary: NumericDatum[];
    trendLabel: string | null;
    trendSeries: TrendDatum[];
};

export type MaterialityPoint = {
    topic: string;
    pillar: "E" | "S" | "G";
    x: number;
    y: number;
    mentions: number;
    quadrant: string;
};

export type MaterialityModel = {
    points: MaterialityPoint[];
    averageX: number;
    averageY: number;
};

function safeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function rankCategoryValues(values: string[]): CategoryDatum[] {
    const map = new Map<string, number>();
    values.forEach((value) => {
        const key = value.trim();
        if (!key) return;
        map.set(key, (map.get(key) ?? 0) + 1);
    });

    const items = [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    if (items.length <= 8) return items;
    const top = items.slice(0, 8);
    const rest = items.slice(8).reduce((sum, item) => sum + item.count, 0);
    return [...top, { label: "Autres", count: rest }];
}

function buildCountTrend(rows: SectionRow[], dateFieldKey: string): TrendDatum[] {
    const monthMap = new Map<string, number>();
    rows.forEach((row) => {
        const date = parseSpreadsheetDate(safeText(row.values[dateFieldKey]));
        if (!date) return;
        const key = monthKeyFromDate(date);
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    });
    return [...monthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([period, value]) => ({ period, value }));
}

function buildValueTrend(rows: SectionRow[], dateFieldKey: string, numericFieldKey: string): TrendDatum[] {
    const monthMap = new Map<string, number>();
    rows.forEach((row) => {
        const date = parseSpreadsheetDate(safeText(row.values[dateFieldKey]));
        const value = parseNumberFlexible(safeText(row.values[numericFieldKey]));
        if (!date || value === null) return;
        const key = monthKeyFromDate(date);
        monthMap.set(key, (monthMap.get(key) ?? 0) + value);
    });
    return [...monthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([period, value]) => ({ period, value }));
}

export function buildSectionInsights(section: SectionDefinition, rows: SectionRow[]): SectionInsights {
    const rowCount = rows.length;
    const fieldCount = section.fields.length;

    if (rowCount === 0 || fieldCount === 0) {
        return {
            rowCount,
            completionRate: 0,
            completionByField: [],
            categoryFieldLabel: null,
            categoryBreakdown: [],
            numericSummary: [],
            trendLabel: null,
            trendSeries: [],
        };
    }

    const completionByField: CompletionDatum[] = section.fields.map((field) => {
        const filled = rows.reduce((total, row) => total + ((row.values[field.key] ?? "").trim() !== "" ? 1 : 0), 0);
        return {
            field: field.label.length > 40 ? `${field.label.slice(0, 37)}...` : field.label,
            rate: (filled / rowCount) * 100,
        };
    });
    const completionRate = completionByField.reduce((sum, item) => sum + item.rate, 0) / completionByField.length;

    const numericCandidates: Array<{ field: SectionDefinition["fields"][number]; values: number[] }> = [];
    const categoryCandidates: Array<{ field: SectionDefinition["fields"][number]; values: string[]; nonEmpty: number; unique: number }> = [];
    const dateCandidates: Array<{ field: SectionDefinition["fields"][number]; values: Date[] }> = [];

    section.fields.forEach((field) => {
        const rawValues = rows.map((row) => safeText(row.values[field.key]));
        const nonEmptyValues = rawValues.filter((value) => value !== "");
        if (nonEmptyValues.length === 0) return;

        const parsedNumbers = nonEmptyValues.map(parseNumberFlexible).filter((value): value is number => value !== null);
        if (parsedNumbers.length >= Math.max(3, Math.floor(nonEmptyValues.length * 0.55))) {
            numericCandidates.push({ field, values: parsedNumbers });
        }

        const parsedDates = nonEmptyValues.map(parseSpreadsheetDate).filter((value): value is Date => value !== null);
        if (parsedDates.length >= Math.max(3, Math.floor(nonEmptyValues.length * 0.45))) {
            dateCandidates.push({ field, values: parsedDates });
        }

        const unique = new Set(nonEmptyValues).size;
        if (unique >= 2 && unique <= 20 && nonEmptyValues.length >= Math.max(3, Math.floor(rowCount * 0.35))) {
            categoryCandidates.push({
                field,
                values: nonEmptyValues,
                nonEmpty: nonEmptyValues.length,
                unique,
            });
        }
    });

    const numericSummary: NumericDatum[] = numericCandidates
        .slice(0, 8)
        .map((item) => {
            const total = item.values.reduce((sum, value) => sum + value, 0);
            const avg = total / item.values.length;
            const min = Math.min(...item.values);
            const max = Math.max(...item.values);
            return {
                field: item.field.label.length > 30 ? `${item.field.label.slice(0, 27)}...` : item.field.label,
                avg,
                total,
                min,
                max,
            };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

    const bestCategoryField = [...categoryCandidates].sort((a, b) => b.nonEmpty - a.nonEmpty)[0] ?? null;
    const categoryBreakdown = bestCategoryField ? rankCategoryValues(bestCategoryField.values) : [];

    let trendLabel: string | null = null;
    let trendSeries: TrendDatum[] = [];
    if (dateCandidates.length > 0 && numericCandidates.length > 0) {
        const dateField = dateCandidates[0].field;
        const numericField = numericCandidates[0].field;
        const candidate = buildValueTrend(rows, dateField.key, numericField.key);
        if (candidate.length > 0) {
            trendSeries = candidate;
            trendLabel = `${dateField.label} x ${numericField.label}`;
        }
    }

    if (trendSeries.length === 0 && dateCandidates.length > 0) {
        const dateField = dateCandidates[0].field;
        const countTrend = buildCountTrend(rows, dateField.key);
        if (countTrend.length > 0) {
            trendSeries = countTrend;
            trendLabel = `${dateField.label} (volume)`;
        }
    }

    return {
        rowCount,
        completionRate,
        completionByField: completionByField.slice(0, 10),
        categoryFieldLabel: bestCategoryField?.field.label ?? null,
        categoryBreakdown,
        numericSummary,
        trendLabel,
        trendSeries,
    };
}

type TopicConfig = {
    topic: string;
    pillar: "E" | "S" | "G";
    keywords: string[];
};

const TOPICS: TopicConfig[] = [
    { topic: "Energie & decarbonation", pillar: "E", keywords: ["energie", "kwh", "carbone", "co2", "scope"] },
    { topic: "Eau & ressources", pillar: "E", keywords: ["eau", "m3", "matiere", "ressource"] },
    { topic: "Dechets & circularite", pillar: "E", keywords: ["dechet", "recycle", "filiere", "tri"] },
    { topic: "Mobilite durable", pillar: "E", keywords: ["mobilite", "transport", "distance", "train", "voiture"] },
    { topic: "Sante & securite", pillar: "S", keywords: ["accident", "sante", "securite", "absenteisme"] },
    { topic: "Emploi & competences", pillar: "S", keywords: ["formation", "salarie", "poste", "contrat", "effectif"] },
    { topic: "Diversite & inclusion", pillar: "S", keywords: ["inclusion", "diversite", "equitable", "egalite"] },
    { topic: "Communautes & engagement", pillar: "S", keywords: ["communaute", "partenariat", "association", "societal"] },
    { topic: "Satisfaction clients", pillar: "S", keywords: ["client", "satisfaction", "qualite", "service"] },
    { topic: "Ethique & conformite", pillar: "G", keywords: ["ethique", "conformite", "transparence", "gouvernance"] },
    { topic: "Risques & resilience", pillar: "G", keywords: ["risque", "opportunite", "maitrise", "priorite"] },
    { topic: "Pilotage & reporting", pillar: "G", keywords: ["kpi", "indicateur", "tableau", "dashboard", "reporting"] },
];

function sectionStakeholderWeight(sectionName: string): number {
    const name = normalizeText(sectionName);
    if (name.includes("parties prenantes") || name.includes("satisfaction") || name.includes("communaute")) return 1.4;
    if (name.includes("impact") || name.includes("engagement")) return 1.2;
    return 1.0;
}

function sectionBusinessWeight(sectionName: string): number {
    const name = normalizeText(sectionName);
    if (name.includes("risque") || name.includes("plan action") || name.includes("kpi")) return 1.5;
    if (name.includes("bilan") || name.includes("consommation") || name.includes("dechet")) return 1.3;
    return 1.0;
}

function scoreToQuadrant(x: number, y: number): string {
    if (x >= 5.5 && y >= 5.5) return "Priorite strategique";
    if (x >= 5.5 && y < 5.5) return "Pilotage economique";
    if (x < 5.5 && y >= 5.5) return "Attente parties prenantes";
    return "Surveillance";
}

function normalizeScore(values: number[], target: number): number {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 5;
    const normalized = ((target - min) / (max - min)) * 10;
    return Math.max(0, Math.min(10, normalized));
}

export function buildMaterialityModel(state: PersistedState, visibleSectionIds: Set<string>): MaterialityModel {
    const aggregate = TOPICS.map((topic) => ({ ...topic, mentions: 0, stakeholderRaw: 0, businessRaw: 0 }));

    state.sections.filter((section) => visibleSectionIds.has(section.id)).forEach((section) => {
        const rows = state.recordsBySection[section.id] ?? [];
        const stakeholderWeight = sectionStakeholderWeight(section.name);
        const businessWeight = sectionBusinessWeight(section.name);

        rows.forEach((row) => {
            const text = normalizeText(Object.values(row.values).map(safeText).join(" | "));
            if (!text) return;
            aggregate.forEach((topic) => {
                const hits = topic.keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
                if (hits === 0) return;
                topic.mentions += hits;
                topic.stakeholderRaw += hits * stakeholderWeight;
                topic.businessRaw += hits * businessWeight;
            });
        });
    });

    const base = aggregate.filter((topic) => topic.mentions > 0);
    const top = [...(base.length > 0 ? base : aggregate)].sort((a, b) => b.mentions - a.mentions).slice(0, 12);
    const xBase = top.map((item) => item.businessRaw);
    const yBase = top.map((item) => item.stakeholderRaw);

    const points: MaterialityPoint[] = top.map((item) => {
        const x = Number(normalizeScore(xBase, item.businessRaw).toFixed(1));
        const y = Number(normalizeScore(yBase, item.stakeholderRaw).toFixed(1));
        return {
            topic: item.topic,
            pillar: item.pillar,
            x,
            y,
            mentions: item.mentions,
            quadrant: scoreToQuadrant(x, y),
        };
    });

    const averageX = points.length === 0 ? 0 : points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const averageY = points.length === 0 ? 0 : points.reduce((sum, point) => sum + point.y, 0) / points.length;

    return {
        points: points.sort((a, b) => b.x * b.y - a.x * a.y),
        averageX: Number(averageX.toFixed(2)),
        averageY: Number(averageY.toFixed(2)),
    };
}
