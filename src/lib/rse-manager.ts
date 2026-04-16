import * as XLSX from "xlsx";

export type FieldInputType = "text" | "number" | "date" | "email" | "tel" | "textarea";

export type SectionField = {
    key: string;
    label: string;
    inputType: FieldInputType;
};

export type SectionDefinition = {
    id: string;
    name: string;
    rowCountRaw: number;
    fields: SectionField[];
};

export type SectionRow = {
    id: string;
    values: Record<string, string>;
    createdAt: string;
    updatedAt: string;
};

export type ImportLogEntry = {
    id: string;
    filename: string;
    importedAt: string;
    sheetCount: number;
    rowsCount: number;
};

export type RegisterManualRow = {
    type: string;
    count: string;
    percent: string;
};

export type HeaderBrandLogos = {
    primary: string;
    secondary: string;
};

export type ActionPlanPillar = "E" | "S" | "G";
export type ActionPlanPriority = "Haute" | "Moyenne" | "Basse";
export type ActionPlanStatus = "A faire" | "En cours" | "Bloque" | "Termine";

export type ActionPlanItem = {
    id: string;
    title: string;
    pillar: ActionPlanPillar;
    sectionId: string;
    owner: string;
    dueDate: string;
    priority: ActionPlanPriority;
    status: ActionPlanStatus;
    progress: number;
    kpi: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
};

export type PersistedState = {
    sections: SectionDefinition[];
    recordsBySection: Record<string, SectionRow[]>;
    importHistory: ImportLogEntry[];
    hiddenSectionIds: string[];
    headerBrandLogos: HeaderBrandLogos;
    oddLogos: Record<string, string>;
    registerContractSummaryMode: "auto" | "manual";
    registerContractManualRows: RegisterManualRow[];
    actionPlanItems: ActionPlanItem[];
    aiEnabled: boolean;
};

type RawSchemaPayload = {
    sourceFile: string;
    sheetCount: number;
    sections: Array<{
        id: string;
        name: string;
        rowCountRaw: number;
        fields: Array<{
            key: string;
            label: string;
        }>;
    }>;
};

type RawDataPayload = {
    sourceFile: string;
    sections: Array<{
        id: string;
        rows: Array<Record<string, string>>;
    }>;
};

function normalizeAscii(input: string): string {
    return input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function slugify(input: string): string {
    const normalized = normalizeAscii(input).trim();
    const slug = normalized.replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    return slug || "champ";
}

export function inferInputType(label: string): FieldInputType {
    const normalized = normalizeAscii(label);
    if (normalized.includes("date")) return "date";
    if (normalized.includes("email") || normalized.includes("e-mail") || normalized.includes("mail")) return "email";
    if (normalized.includes("telephone") || normalized.includes("tel") || normalized.includes("phone")) return "tel";
    if (
        normalized.includes("budget") ||
        normalized.includes("montant") ||
        normalized.includes("kwh") ||
        normalized.includes("kg") ||
        normalized.includes("m3") ||
        normalized.includes("co2") ||
        normalized.includes("distance") ||
        normalized.includes("score") ||
        normalized.includes("quantite") ||
        normalized.includes("nombre") ||
        normalized.includes("nb") ||
        normalized.includes("%") ||
        normalized.includes("heure") ||
        normalized.includes("minute")
    ) {
        return "number";
    }
    if (label.length > 70 || normalized.includes("commentaire") || normalized.includes("description")) return "textarea";
    return "text";
}

function asText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function normalizeFields(rawFields: Array<{ key: string; label: string }>): SectionField[] {
    return rawFields.map((field) => ({
        key: field.key,
        label: field.label,
        inputType: inferInputType(field.label),
    }));
}

function seedActionPlanItems(now: string): ActionPlanItem[] {
    return [
        {
            id: "ap_seed_1",
            title: "Mettre a jour la cartographie des parties prenantes",
            pillar: "G",
            sectionId: "",
            owner: "Direction RSE",
            dueDate: "2026-05-30",
            priority: "Haute",
            status: "En cours",
            progress: 45,
            kpi: "100% des parties prenantes prioritaires consultees",
            notes: "Inclure clients, collaborateurs, fournisseurs critiques.",
            createdAt: now,
            updatedAt: now,
        },
        {
            id: "ap_seed_2",
            title: "Plan de reduction des consommations energie/eau",
            pillar: "E",
            sectionId: "",
            owner: "Operations",
            dueDate: "2026-09-30",
            priority: "Haute",
            status: "A faire",
            progress: 0,
            kpi: "-8% kWh et -5% m3 sur 12 mois",
            notes: "Prioriser les sites les plus intensifs.",
            createdAt: now,
            updatedAt: now,
        },
        {
            id: "ap_seed_3",
            title: "Programme formation RSE managers",
            pillar: "S",
            sectionId: "",
            owner: "RH",
            dueDate: "2026-07-15",
            priority: "Moyenne",
            status: "A faire",
            progress: 0,
            kpi: "80% managers formes",
            notes: "Module mixte presentiel + e-learning.",
            createdAt: now,
            updatedAt: now,
        },
    ];
}

export function buildInitialState(schema: RawSchemaPayload, data: RawDataPayload): PersistedState {
    const sections: SectionDefinition[] = schema.sections.map((section) => ({
        id: section.id,
        name: section.name,
        rowCountRaw: section.rowCountRaw,
        fields: normalizeFields(section.fields),
    }));

    const dataMap = new Map<string, Array<Record<string, string>>>();
    data.sections.forEach((section) => dataMap.set(section.id, section.rows));

    const now = new Date().toISOString();
    const recordsBySection: Record<string, SectionRow[]> = {};

    sections.forEach((section) => {
        const rawRows = dataMap.get(section.id) ?? [];
        recordsBySection[section.id] = rawRows.map((row, index) => {
            const values: Record<string, string> = {};
            section.fields.forEach((field) => {
                values[field.key] = asText(row[field.key]);
            });
            return {
                id: `${section.id}_seed_${index + 1}`,
                values,
                createdAt: now,
                updatedAt: now,
            };
        });
    });

    return {
        sections,
        recordsBySection,
        importHistory: [
            {
                id: "seed_initial",
                filename: data.sourceFile || schema.sourceFile || "source.xlsx",
                importedAt: now,
                sheetCount: sections.length,
                rowsCount: Object.values(recordsBySection).reduce((total, rows) => total + rows.length, 0),
            },
        ],
        hiddenSectionIds: [],
        headerBrandLogos: { primary: "", secondary: "" },
        oddLogos: {},
        registerContractSummaryMode: "auto",
        registerContractManualRows: [],
        actionPlanItems: seedActionPlanItems(now),
        aiEnabled: false,
    };
}

function scoreHeaderRow(row: unknown[]): number {
    const values = row.map((cell) => asText(cell)).filter(Boolean);
    if (values.length === 0) return -1;
    const nonNumeric = values.filter((value) => !/^[0-9.,]+$/.test(value));
    return nonNumeric.length * 2 + values.length;
}

function pickHeaderRow(rows: unknown[][]): number {
    let bestIndex = 0;
    let bestScore = -1;
    const scanLimit = Math.min(rows.length, 30);
    for (let index = 0; index < scanLimit; index += 1) {
        const score = scoreHeaderRow(rows[index] ?? []);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }
    return bestIndex;
}

function normalizeHeaderCells(cells: string[]): Array<{ key: string; label: string }> {
    const cleaned = cells.map((cell) => cell.trim()).filter(Boolean);
    const fallback = cleaned.length > 0 ? cleaned : ["Champ 1", "Champ 2", "Champ 3"];
    const used: Record<string, number> = {};
    return fallback.map((label) => {
        const base = slugify(label);
        const count = (used[base] ?? 0) + 1;
        used[base] = count;
        const key = count > 1 ? `${base}_${count}` : base;
        return { key, label };
    });
}

export async function parseWorkbookFile(file: File): Promise<PersistedState> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const now = new Date().toISOString();

    const sections: SectionDefinition[] = [];
    const recordsBySection: Record<string, SectionRow[]> = {};
    let totalRows = 0;

    workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: "",
        }) as unknown[][];

        const headerIndex = pickHeaderRow(matrix);
        const headerCells = (matrix[headerIndex] ?? []).map((cell) => asText(cell));
        const fields = normalizeHeaderCells(headerCells).map((field) => ({
            ...field,
            inputType: inferInputType(field.label),
        }));

        const sectionId = `section_${String(index + 1).padStart(2, "0")}_${slugify(sheetName)}`;
        sections.push({
            id: sectionId,
            name: sheetName,
            rowCountRaw: matrix.length,
            fields,
        });

        const rows: SectionRow[] = [];
        for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
            const rawRow = matrix[rowIndex] ?? [];
            const values: Record<string, string> = {};
            fields.forEach((field, fieldIndex) => {
                values[field.key] = asText(rawRow[fieldIndex] ?? "");
            });
            if (Object.values(values).every((value) => value === "")) continue;
            rows.push({
                id: `${sectionId}_${rowIndex}_${Math.random().toString(36).slice(2, 8)}`,
                values,
                createdAt: now,
                updatedAt: now,
            });
        }
        recordsBySection[sectionId] = rows;
        totalRows += rows.length;
    });

    return {
        sections,
        recordsBySection,
        importHistory: [
            {
                id: `import_${Date.now()}`,
                filename: file.name,
                importedAt: now,
                sheetCount: sections.length,
                rowsCount: totalRows,
            },
        ],
        hiddenSectionIds: [],
        headerBrandLogos: { primary: "", secondary: "" },
        oddLogos: {},
        registerContractSummaryMode: "auto",
        registerContractManualRows: [],
        actionPlanItems: seedActionPlanItems(now),
        aiEnabled: false,
    };
}

export function emptyRecordFromSection(section: SectionDefinition): Record<string, string> {
    const output: Record<string, string> = {};
    section.fields.forEach((field) => {
        output[field.key] = "";
    });
    return output;
}

export function formatSectionShortName(name: string): string {
    if (name.length <= 38) return name;
    return `${name.slice(0, 35)}...`;
}

export function normalizeImportedState(input: unknown): PersistedState | null {
    if (!input || typeof input !== "object") return null;
    const raw = input as Partial<PersistedState>;
    if (!Array.isArray(raw.sections) || typeof raw.recordsBySection !== "object" || raw.recordsBySection === null) {
        return null;
    }

    const sections: SectionDefinition[] = raw.sections
        .map((section) => {
            if (!section || typeof section !== "object") return null;
            const cast = section as SectionDefinition;
            if (!cast.id || !cast.name || !Array.isArray(cast.fields)) return null;
            const fields = cast.fields
                .map((field) => {
                    if (!field || typeof field !== "object") return null;
                    const f = field as SectionField;
                    if (!f.key || !f.label) return null;
                    return {
                        key: asText(f.key),
                        label: asText(f.label),
                        inputType: inferInputType(asText(f.label)),
                    } as SectionField;
                })
                .filter((field): field is SectionField => field !== null);
            if (fields.length === 0) return null;
            return {
                id: asText(cast.id),
                name: asText(cast.name),
                rowCountRaw: Number(cast.rowCountRaw || 0),
                fields,
            } as SectionDefinition;
        })
        .filter((section): section is SectionDefinition => section !== null);

    if (sections.length === 0) return null;

    const recordsBySection: Record<string, SectionRow[]> = {};
    sections.forEach((section) => {
        const rawRows = Array.isArray(raw.recordsBySection?.[section.id]) ? raw.recordsBySection?.[section.id] : [];
        const normalizedRows: SectionRow[] = [];
        rawRows?.forEach((rawRow, index) => {
            if (!rawRow || typeof rawRow !== "object") return;
            const cast = rawRow as Partial<SectionRow>;
            const values: Record<string, string> = {};
            section.fields.forEach((field) => {
                values[field.key] = asText(cast.values?.[field.key] ?? "");
            });
            normalizedRows.push({
                id: asText(cast.id) || `${section.id}_restored_${index + 1}`,
                values,
                createdAt: asText(cast.createdAt) || new Date().toISOString(),
                updatedAt: asText(cast.updatedAt) || new Date().toISOString(),
            });
        });
        recordsBySection[section.id] = normalizedRows;
    });

    const importHistory: ImportLogEntry[] = Array.isArray(raw.importHistory)
        ? raw.importHistory
              .map((entry) => {
                  if (!entry || typeof entry !== "object") return null;
                  const cast = entry as ImportLogEntry;
                  return {
                      id: asText(cast.id) || `import_${Date.now()}`,
                      filename: asText(cast.filename) || "backup.json",
                      importedAt: asText(cast.importedAt) || new Date().toISOString(),
                      sheetCount: Number(cast.sheetCount || sections.length),
                      rowsCount: Number(cast.rowsCount || 0),
                  } as ImportLogEntry;
              })
              .filter((entry): entry is ImportLogEntry => entry !== null)
        : [];

    const hiddenSet = new Set(
        Array.isArray((raw as { hiddenSectionIds?: unknown }).hiddenSectionIds)
            ? ((raw as { hiddenSectionIds?: unknown }).hiddenSectionIds as unknown[])
                  .map((value) => asText(value))
                  .filter(Boolean)
            : [],
    );
    const hiddenSectionIds = sections.map((section) => section.id).filter((id) => hiddenSet.has(id));

    const rawHeaderBrandLogos = (raw as { headerBrandLogos?: unknown }).headerBrandLogos;
    const headerBrandLogos: HeaderBrandLogos = { primary: "", secondary: "" };
    if (rawHeaderBrandLogos && typeof rawHeaderBrandLogos === "object") {
        const cast = rawHeaderBrandLogos as Partial<Record<keyof HeaderBrandLogos, unknown>>;
        headerBrandLogos.primary = asText(cast.primary);
        headerBrandLogos.secondary = asText(cast.secondary);
    }

    const rawLogos = (raw as { oddLogos?: unknown }).oddLogos;
    const oddLogos: Record<string, string> = {};
    if (rawLogos && typeof rawLogos === "object") {
        Object.entries(rawLogos as Record<string, unknown>).forEach(([key, value]) => {
            const k = asText(key);
            const v = asText(value);
            if (!k || !v) return;
            oddLogos[k] = v;
        });
    }

    const registerContractSummaryMode =
        asText((raw as { registerContractSummaryMode?: unknown }).registerContractSummaryMode).toLowerCase() === "manual"
            ? "manual"
            : "auto";

    const registerContractManualRows: RegisterManualRow[] = Array.isArray(
        (raw as { registerContractManualRows?: unknown }).registerContractManualRows,
    )
        ? ((raw as { registerContractManualRows?: unknown }).registerContractManualRows as unknown[])
              .map((item) => {
                  if (!item || typeof item !== "object") return null;
                  const cast = item as Partial<RegisterManualRow>;
                  return {
                      type: asText(cast.type),
                      count: asText(cast.count),
                      percent: asText(cast.percent),
                  } as RegisterManualRow;
              })
              .filter((item): item is RegisterManualRow => item !== null)
        : [];

    const actionPlanItems: ActionPlanItem[] = Array.isArray((raw as { actionPlanItems?: unknown }).actionPlanItems)
        ? ((raw as { actionPlanItems?: unknown }).actionPlanItems as unknown[])
              .map((item, index) => {
                  if (!item || typeof item !== "object") return null;
                  const cast = item as Partial<ActionPlanItem>;
                  const progress = Number(cast.progress ?? 0);
                  const now = new Date().toISOString();
                  return {
                      id: asText(cast.id) || `ap_restored_${index + 1}`,
                      title: asText(cast.title),
                      pillar: (asText(cast.pillar) as ActionPlanPillar) || "G",
                      sectionId: asText(cast.sectionId),
                      owner: asText(cast.owner),
                      dueDate: asText(cast.dueDate),
                      priority: (asText(cast.priority) as ActionPlanPriority) || "Moyenne",
                      status: (asText(cast.status) as ActionPlanStatus) || "A faire",
                      progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0,
                      kpi: asText(cast.kpi),
                      notes: asText(cast.notes),
                      createdAt: asText(cast.createdAt) || now,
                      updatedAt: asText(cast.updatedAt) || now,
                  } as ActionPlanItem;
              })
              .filter((item): item is ActionPlanItem => item !== null)
        : seedActionPlanItems(new Date().toISOString());

    const aiEnabled = asText((raw as { aiEnabled?: unknown }).aiEnabled).toLowerCase() === "true";

    return {
        sections,
        recordsBySection,
        importHistory,
        hiddenSectionIds,
        headerBrandLogos,
        oddLogos,
        registerContractSummaryMode,
        registerContractManualRows,
        actionPlanItems,
        aiEnabled,
    };
}
