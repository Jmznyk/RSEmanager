import { normalizeText, parseNumberFlexible } from "@/lib/rse-format";
import { slugify, type SectionDefinition, type SectionField, type SectionRow } from "@/lib/rse-manager";

export type SectionBlock = {
    id: string;
    label: string;
    anchorValue: string | null;
    rows: SectionRow[];
};

export type SectionBlockModel = {
    anchorFieldKey: string | null;
    blocks: SectionBlock[];
};

function safeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function chooseAnchorField(section: SectionDefinition): SectionField | null {
    const priorityWords = [
        "type",
        "theme",
        "thematique",
        "objet",
        "intitule",
        "categorie",
        "libelle",
        "poste",
        "nom",
    ];

    const textFields = section.fields.filter((field) => field.inputType !== "number" && field.inputType !== "date");

    const priority = textFields.find((field) => {
        const normalized = normalizeText(`${field.label} ${field.key}`);
        return priorityWords.some((word) => normalized.includes(word));
    });

    if (priority) return priority;
    if (textFields.length > 0) return textFields[0];
    return section.fields[0] ?? null;
}

function isHeaderLikeRow(values: string[]): boolean {
    if (values.length < 2) return false;

    const normalized = values.map((value) => normalizeText(value));
    const headerToken = normalized.filter((value) =>
        /^odd\s*(?:[1-9]|1[0-7])$/.test(value) ||
        value === "nb" ||
        value === "%" ||
        value === "type" ||
        value.includes("type de") ||
        value.includes("nom") ||
        value.includes("prenom") ||
        value.includes("date") ||
        value.includes("theme") ||
        value.includes("thematique"),
    ).length;

    return headerToken >= Math.max(2, Math.floor(values.length / 2));
}

function cleanBlockLabel(value: string): string {
    const text = safeText(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function buildSectionBlockModel(section: SectionDefinition, rows: SectionRow[]): SectionBlockModel {
    const anchorField = chooseAnchorField(section);
    const anchorKey = anchorField?.key ?? null;

    const blocks: SectionBlock[] = [];
    let currentRows: SectionRow[] = [];
    let pendingLabel: string | null = null;
    let blockCounter = 1;

    const flush = () => {
        if (currentRows.length === 0) return;
        const label = pendingLabel && pendingLabel !== "" ? pendingLabel : `Tableau ${blockCounter}`;
        blocks.push({
            id: `${section.id}_table_${blockCounter}_${slugify(label)}`,
            label,
            anchorValue: pendingLabel,
            rows: currentRows,
        });
        currentRows = [];
        pendingLabel = null;
        blockCounter += 1;
    };

    for (const row of rows) {
        const entries = section.fields
            .map((field) => ({ key: field.key, value: safeText(row.values[field.key]) }))
            .filter((item) => item.value !== "");

        if (entries.length === 0) {
            flush();
            continue;
        }

        const rowValues = entries.map((item) => item.value);

        const singleValueLabel =
            entries.length === 1 &&
            parseNumberFlexible(entries[0].value) === null;

        const anchorOnlyLabel = anchorKey
            ? (() => {
                const anchorValue = safeText(row.values[anchorKey]);
                const otherCount = entries.filter((entry) => entry.key !== anchorKey).length;
                return anchorValue !== "" && otherCount === 0 && parseNumberFlexible(anchorValue) === null;
            })()
            : false;

        if (singleValueLabel || anchorOnlyLabel) {
            flush();
            pendingLabel = cleanBlockLabel(entries[0].value);
            continue;
        }

        if (isHeaderLikeRow(rowValues)) {
            flush();
            const firstText = rowValues.find((value) => parseNumberFlexible(value) === null) ?? rowValues[0];
            pendingLabel = cleanBlockLabel(firstText);
            continue;
        }

        currentRows.push(row);
    }

    flush();

    if (blocks.length === 0) {
        return {
            anchorFieldKey: anchorKey,
            blocks: [
                {
                    id: `${section.id}_table_1_principal`,
                    label: "Tableau principal",
                    anchorValue: null,
                    rows,
                },
            ],
        };
    }

    const seen = new Map<string, number>();
    const deduped = blocks.map((block) => {
        const key = normalizeText(block.label);
        const count = (seen.get(key) ?? 0) + 1;
        seen.set(key, count);
        if (count === 1) return block;
        return {
            ...block,
            label: `${block.label} (${count})`,
        };
    });

    return {
        anchorFieldKey: anchorKey,
        blocks: deduped,
    };
}

export function blockCoverageLabel(section: SectionDefinition, block: SectionBlock): string {
    const rowCount = block.rows.length;
    if (rowCount === 0) return "Aucune ligne";

    let filled = 0;
    const total = rowCount * section.fields.length;
    block.rows.forEach((row) => {
        section.fields.forEach((field) => {
            if (safeText(row.values[field.key]) !== "") filled += 1;
        });
    });

    const rate = total > 0 ? (filled / total) * 100 : 0;
    return `${rowCount} ligne(s) · ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(rate)}% renseigne`;
}
