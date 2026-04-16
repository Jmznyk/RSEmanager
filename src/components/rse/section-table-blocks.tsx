import * as React from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { buildBlockChartModel, type BlockChartModel } from "@/lib/rse-block-analytics";
import { formatFieldValue } from "@/lib/rse-format";
import { blockCoverageLabel, buildSectionBlockModel, type SectionBlock } from "@/lib/rse-section-blocks";
import { emptyRecordFromSection, type SectionDefinition, type SectionRow } from "@/lib/rse-manager";

type SectionTableBlocksProps = {
    section: SectionDefinition;
    rows: SectionRow[];
    onSaveRow: (values: Record<string, string>) => void;
    onDeleteRow: (rowId: string) => void;
};

const PIE_COLORS = ["#0f766e", "#1d4ed8", "#155e75", "#0e7490", "#334155", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#be185d"];

function blockCountLabel(value: number): string {
    return new Intl.NumberFormat("fr-FR").format(value);
}

function formatSerieValue(value: number, format: "number" | "percent" | undefined): string {
    if (format === "percent") {
        return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} %`;
    }
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function readNumeric(item: Record<string, string | number>, key: string): number {
    const value = item[key];
    if (typeof value === "number") return value;
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toAreaGradientId(chartId: string, serieKey: string): string {
    const safe = `${chartId}_${serieKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `area_${safe}`;
}

function renderChart(chart: BlockChartModel, chartId: string) {
    if (chart.kind === "line") {
        return (
            <AreaChart data={chart.data}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} />
                <YAxis />
                <Tooltip />
                <defs>
                    {chart.series.map((serie) => {
                        const gradientId = toAreaGradientId(chartId, serie.key);
                        return (
                            <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={serie.color} stopOpacity={0.5} />
                                <stop offset="95%" stopColor={serie.color} stopOpacity={0.1} />
                            </linearGradient>
                        );
                    })}
                </defs>
                {chart.series.map((serie) => (
                    <Area
                        key={serie.key}
                        type="natural"
                        dataKey={serie.key}
                        name={serie.label}
                        unit={serie.valueFormat === "percent" ? "%" : undefined}
                        stroke={serie.color}
                        fill={`url(#${toAreaGradientId(chartId, serie.key)})`}
                        fillOpacity={0.45}
                        strokeWidth={1.1}
                    />
                ))}
            </AreaChart>
        );
    }

    if (chart.kind === "pie") {
        return (
            <PieChart>
                <Tooltip formatter={(value) => [formatSerieValue(Number(value), "percent"), "%"]} />
                <Pie
                    data={chart.data}
                    dataKey={chart.series[0]?.key ?? "valeur"}
                    nameKey={chart.xKey}
                    outerRadius={96}
                    innerRadius={40}
                    label={false}
                    labelLine={false}
                >
                    {chart.data.map((entry, index) => (
                        <Cell key={`${String(entry[chart.xKey])}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                </Pie>
            </PieChart>
        );
    }

    return (
        <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey} hide />
            <YAxis />
            <Tooltip />
            {chart.series.map((serie) => (
                <Bar
                    key={serie.key}
                    dataKey={serie.key}
                    name={serie.label}
                    unit={serie.valueFormat === "percent" ? "%" : undefined}
                    fill={serie.color}
                    radius={[4, 4, 0, 0]}
                />
            ))}
        </BarChart>
    );
}

export function SectionTableBlocks({ section, rows, onSaveRow, onDeleteRow }: SectionTableBlocksProps) {
    const model = React.useMemo(() => buildSectionBlockModel(section, rows), [section, rows]);
    const chartsByBlock = React.useMemo(
        () => model.blocks.map((block) => ({ block, chart: buildBlockChartModel(section, block) })),
        [model.blocks, section],
    );

    const [openFormBlockId, setOpenFormBlockId] = React.useState<string | null>(null);
    const [draftsByBlock, setDraftsByBlock] = React.useState<Record<string, Record<string, string>>>({});
    const tableMinWidth = React.useMemo(
        () => Math.max(980, section.fields.length * 170),
        [section.fields.length],
    );

    React.useEffect(() => {
        setOpenFormBlockId(null);
        setDraftsByBlock({});
    }, [section.id]);

    const createDraft = React.useCallback(
        (block: SectionBlock) => {
            const base = emptyRecordFromSection(section);
            if (model.anchorFieldKey && block.anchorValue) {
                base[model.anchorFieldKey] = block.anchorValue;
            }
            return base;
        },
        [section, model.anchorFieldKey],
    );

    const ensureDraft = React.useCallback(
        (block: SectionBlock) => {
            setDraftsByBlock((prev) => {
                if (prev[block.id]) return prev;
                return {
                    ...prev,
                    [block.id]: createDraft(block),
                };
            });
        },
        [createDraft],
    );

    const toggleForm = (block: SectionBlock) => {
        ensureDraft(block);
        setOpenFormBlockId((prev) => (prev === block.id ? null : block.id));
    };

    const setField = (blockId: string, key: string, value: string) => {
        setDraftsByBlock((prev) => ({
            ...prev,
            [blockId]: {
                ...(prev[blockId] ?? {}),
                [key]: value,
            },
        }));
    };

    const saveBlockRow = (block: SectionBlock) => {
        const current = draftsByBlock[block.id] ?? createDraft(block);
        if (!Object.values(current).some((value) => value.trim() !== "")) return;
        onSaveRow(current);
        setDraftsByBlock((prev) => ({
            ...prev,
            [block.id]: createDraft(block),
        }));
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Graphiques de la section</CardTitle>
                    <CardDescription>Vue consolidée des graphiques avec etiquettes de donnees precises.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                        {chartsByBlock.map(({ block, chart }) => {
                            const labels = chart.data.slice(0, 4).map((item) => {
                                const serie = chart.series[0];
                                const label = String(item[chart.xKey] ?? "-");
                                const value = readNumeric(item, serie.key);
                                return `${label}: ${formatSerieValue(value, serie.valueFormat)}`;
                            });

                            return (
                                <div key={`chart_${block.id}`} className="min-w-0 rounded-lg border p-3">
                                    <p className="text-sm font-semibold">{block.label}</p>
                                    <p className="text-xs text-muted-foreground">{chart.title} - {chart.description}</p>
                                    <div className="mt-2 h-[260px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {renderChart(chart, block.id)}
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        {labels.map((label) => (
                                            <span key={`${block.id}_${label}`} className="rounded border px-2 py-1">
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                    {chart.kind === "pie" && (
                                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                            {chart.data.map((item, index) => {
                                                const label = String(item[chart.xKey] ?? "-");
                                                const value = readNumeric(item, chart.series[0]?.key ?? "valeur");
                                                return (
                                                    <div key={`${block.id}_pie_${label}_${index}`} className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block h-2.5 w-2.5 rounded-full"
                                                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                                        />
                                                        <span>{label}: {formatSerieValue(value, "percent")}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {model.blocks.map((block) => {
                const isOpen = openFormBlockId === block.id;
                const draft = draftsByBlock[block.id] ?? createDraft(block);

                return (
                    <Card key={block.id} className="overflow-hidden">
                        <CardHeader className="border-b bg-muted/20">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">{block.label}</CardTitle>
                                    <CardDescription>{blockCoverageLabel(section, block)}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{blockCountLabel(block.rows.length)} lignes</Badge>
                                    <Button variant="outline" size="sm" onClick={() => toggleForm(block)}>
                                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        Formulaire de saisie
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        {isOpen && (
                            <CardContent className="border-b bg-background/80 py-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {section.fields.map((field) => (
                                        <div key={field.key} className="space-y-2">
                                            <Label>{field.label}</Label>
                                            {field.inputType === "textarea" ? (
                                                <Textarea
                                                    rows={3}
                                                    value={draft[field.key] ?? ""}
                                                    onChange={(event) => setField(block.id, field.key, event.target.value)}
                                                />
                                            ) : (
                                                <Input
                                                    type={field.inputType}
                                                    value={draft[field.key] ?? ""}
                                                    step={field.inputType === "number" ? "any" : undefined}
                                                    onChange={(event) => setField(block.id, field.key, event.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button onClick={() => saveBlockRow(block)}>
                                        <Save className="h-4 w-4" /> Enregistrer dans ce tableau
                                    </Button>
                                </div>
                            </CardContent>
                        )}

                        <CardContent className="py-4">
                            <ScrollArea className="w-full">
                                <div style={{ minWidth: `${tableMinWidth}px` }}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {section.fields.map((field) => (
                                                    <TableHead key={field.key}>{field.label}</TableHead>
                                                ))}
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {block.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={section.fields.length + 1} className="text-sm text-muted-foreground">
                                                        Aucune ligne.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {block.rows.map((row) => (
                                                <TableRow key={row.id}>
                                                    {section.fields.map((field) => (
                                                        <TableCell key={`${row.id}_${field.key}`} className="align-top whitespace-pre-wrap break-words">
                                                            {formatFieldValue(field, row.values[field.key] ?? "")}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => onDeleteRow(row.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
