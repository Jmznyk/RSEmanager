import { normalizeText, parseNumberFlexible, parseSpreadsheetDate } from "@/lib/rse-format";
import type { SectionDefinition } from "@/lib/rse-manager";
import type { SectionBlock } from "@/lib/rse-section-blocks";

export type BlockChartSeries = {
    key: string;
    label: string;
    color: string;
    valueFormat?: "number" | "percent";
};

export type BlockChartModel = {
    title: string;
    description: string;
    xKey: string;
    kind: "bar" | "line" | "pie";
    data: Array<Record<string, string | number>>;
    series: BlockChartSeries[];
};

const SERIES_COLORS = ["#0f766e", "#1d4ed8", "#155e75", "#0e7490", "#334155", "#0891b2", "#16a34a", "#d97706"];

type PercentMode = "none" | "ratio" | "percent";

function safeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function normalizeCategory(value: string): string {
    return safeText(value).replace(/\s+/g, " ");
}

function selectNumericField(section: SectionDefinition, block: SectionBlock): string | null {
    const scored = section.fields.map((field) => {
        const values = block.rows.map((row) => parseNumberFlexible(safeText(row.values[field.key]))).filter((v): v is number => v !== null);
        return { key: field.key, count: values.length };
    });

    const best = scored.sort((a, b) => b.count - a.count)[0];
    if (!best || best.count < Math.max(2, Math.floor(block.rows.length * 0.35))) return null;
    return best.key;
}

function selectDateField(section: SectionDefinition, block: SectionBlock): string | null {
    const scored = section.fields.map((field) => {
        const label = normalizeText(field.label);
        const parsed = block.rows
            .map((row) => parseSpreadsheetDate(safeText(row.values[field.key])))
            .filter((v): v is Date => v !== null);
        const bonus = label.includes("date") ? 2 : 0;
        return { key: field.key, count: parsed.length, score: parsed.length + bonus };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (!best || best.count < Math.max(2, Math.floor(block.rows.length * 0.35))) return null;
    return best.key;
}

function selectCategoryField(section: SectionDefinition, block: SectionBlock, exclude: Set<string>): string | null {
    const candidates = section.fields
        .filter((field) => !exclude.has(field.key))
        .map((field) => {
            const values = block.rows.map((row) => normalizeCategory(safeText(row.values[field.key]))).filter(Boolean);
            const unique = new Set(values).size;
            return { key: field.key, count: values.length, unique };
        })
        .filter((item) => item.count >= 2 && item.unique >= 2 && item.unique <= Math.max(20, Math.floor(block.rows.length * 0.8)))
        .sort((a, b) => b.count - a.count);

    return candidates[0]?.key ?? null;
}

function topN<T>(rows: T[], n: number): T[] {
    return rows.slice(0, n);
}

function looksPercentLabel(input: string): boolean {
    const text = normalizeText(input);
    return text.includes("%") || text.includes("pourcentage") || text.includes("taux") || text.includes("ratio") || text.includes("part");
}

function detectPercentMode(fieldLabel: string, values: number[]): PercentMode {
    if (values.length === 0) return "none";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const ratioCount = values.filter((value) => value >= 0 && value <= 1).length;
    const ratioShare = ratioCount / values.length;
    const isPercentLabel = looksPercentLabel(fieldLabel);

    if (isPercentLabel && max <= 100 && min >= 0 && ratioShare < 0.6) {
        return "percent";
    }
    if (isPercentLabel && ratioShare >= 0.5 && max <= 1.2) {
        return "ratio";
    }
    if (!isPercentLabel && ratioShare >= 0.9 && max <= 1.05 && min >= 0) {
        return "ratio";
    }
    return "none";
}

function toDisplayValue(value: number, mode: PercentMode): number {
    if (mode === "ratio") return Number((value * 100).toFixed(2));
    return Number(value.toFixed(2));
}

function allowTemporal(sectionName: string, blockLabel: string, periods: number): boolean {
    if (periods < 4) return false;
    const text = normalizeText(`${sectionName} ${blockLabel}`);
    const hints = [
        "annee",
        "mois",
        "date",
        "historique",
        "evolution",
        "tendance",
        "registre",
        "consommation",
        "emission",
        "carbone",
        "energie",
        "dechet",
        "eau",
    ];
    return hints.some((hint) => text.includes(hint));
}

export function buildBlockChartModel(section: SectionDefinition, block: SectionBlock): BlockChartModel {
    const dateKey = selectDateField(section, block);
    const numericKey = selectNumericField(section, block);
    const exclude = new Set<string>([...(dateKey ? [dateKey] : []), ...(numericKey ? [numericKey] : [])]);
    const categoryKey = selectCategoryField(section, block, exclude);

    if (categoryKey && numericKey) {
        const numericField = section.fields.find((field) => field.key === numericKey);
        const map = new Map<string, number>();
        const rawValues: number[] = [];
        block.rows.forEach((row) => {
            const category = normalizeCategory(safeText(row.values[categoryKey]));
            const value = parseNumberFlexible(safeText(row.values[numericKey]));
            if (!category || value === null) return;
            rawValues.push(value);
            map.set(category, (map.get(category) ?? 0) + value);
        });

        const percentMode = detectPercentMode(numericField?.label ?? numericKey, rawValues);
        const formatted = topN(
            [...map.entries()]
                .map(([categorie, valeur]) => ({
                    categorie,
                    valeur: toDisplayValue(valeur, percentMode),
                }))
                .sort((a, b) => b.valeur - a.valeur),
            12,
        );

        if (formatted.length > 0) {
            if (percentMode !== "none") {
                return {
                    title: "Repartition en pourcentage",
                    description: `${numericField?.label ?? numericKey} par categorie`,
                    kind: "pie",
                    xKey: "categorie",
                    data: formatted,
                    series: [{ key: "valeur", label: "Pourcentage", color: SERIES_COLORS[0], valueFormat: "percent" }],
                };
            }

            return {
                title: "Repartition par categorie",
                description: `Somme de ${numericField?.label ?? numericKey} par categorie`,
                kind: "bar",
                xKey: "categorie",
                data: formatted,
                series: [{ key: "valeur", label: "Valeur", color: SERIES_COLORS[2], valueFormat: "number" }],
            };
        }
    }

    if (categoryKey) {
        const map = new Map<string, number>();
        block.rows.forEach((row) => {
            const category = normalizeCategory(safeText(row.values[categoryKey]));
            if (!category) return;
            map.set(category, (map.get(category) ?? 0) + 1);
        });

        const data = topN(
            [...map.entries()]
                .map(([categorie, volume]) => ({ categorie, volume }))
                .sort((a, b) => b.volume - a.volume),
            12,
        );

        if (data.length > 0) {
            return {
                title: "Repartition des occurrences",
                description: `Volume par ${categoryKey}`,
                kind: "bar",
                xKey: "categorie",
                data,
                series: [{ key: "volume", label: "Volume", color: SERIES_COLORS[3], valueFormat: "number" }],
            };
        }
    }

    if (dateKey && numericKey) {
        const numericField = section.fields.find((field) => field.key === numericKey);
        const map = new Map<string, number>();
        const rawValues: number[] = [];
        block.rows.forEach((row) => {
            const date = parseSpreadsheetDate(safeText(row.values[dateKey]));
            const value = parseNumberFlexible(safeText(row.values[numericKey]));
            if (!date || value === null) return;
            rawValues.push(value);
            const year = String(date.getFullYear());
            map.set(year, (map.get(year) ?? 0) + value);
        });

        const percentMode = detectPercentMode(numericField?.label ?? numericKey, rawValues);
        const data = [...map.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([periode, valeur]) => ({
                periode,
                valeur: toDisplayValue(valeur, percentMode),
            }));

        if (allowTemporal(section.name, block.label, data.length)) {
            return {
                title: "Evolution temporelle",
                description: `Somme de ${numericField?.label ?? numericKey} par annee`,
                kind: "line",
                xKey: "periode",
                data,
                series: [{ key: "valeur", label: percentMode === "none" ? "Valeur" : "Pourcentage", color: SERIES_COLORS[1], valueFormat: percentMode === "none" ? "number" : "percent" }],
            };
        }
    }

    if (dateKey) {
        const map = new Map<string, number>();
        block.rows.forEach((row) => {
            const date = parseSpreadsheetDate(safeText(row.values[dateKey]));
            if (!date) return;
            const year = String(date.getFullYear());
            map.set(year, (map.get(year) ?? 0) + 1);
        });

        const data = [...map.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([periode, volume]) => ({ periode, volume }));

        if (allowTemporal(section.name, block.label, data.length)) {
            return {
                title: "Volume temporel",
                description: "Nombre de lignes par annee",
                kind: "line",
                xKey: "periode",
                data,
                series: [{ key: "volume", label: "Volume", color: SERIES_COLORS[4], valueFormat: "number" }],
            };
        }
    }

    const data = section.fields.map((field) => {
        let filled = 0;
        block.rows.forEach((row) => {
            if (safeText(row.values[field.key]) !== "") filled += 1;
        });
        const taux = block.rows.length > 0 ? (filled / block.rows.length) * 100 : 0;
        return {
            champ: field.label.length > 32 ? `${field.label.slice(0, 29)}...` : field.label,
            taux: Number(taux.toFixed(1)),
        };
    });

    return {
        title: "Qualite de remplissage",
        description: "Taux de remplissage des champs du tableau",
        kind: "bar",
        xKey: "champ",
        data,
        series: [{ key: "taux", label: "Taux %", color: SERIES_COLORS[5], valueFormat: "percent" }],
    };
}
