import * as React from "react";
import {
    AlertTriangle,
    Database,
    Eye,
    EyeOff,
    FileArchive,
    FileDown,
    FileSpreadsheet,
    FolderKanban,
    LayoutDashboard,
    ListTodo,
    Plus,
    Settings,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ActionPlanManager } from "@/components/rse/action-plan-manager";
import { MaterialityMatrix } from "@/components/rse/materiality-matrix";
import { SectionAiAssistant } from "@/components/rse/section-ai-assistant";
import { SectionTableBlocks } from "@/components/rse/section-table-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import defaultWorkbookData from "@/data/default-workbook-data.json";
import defaultWorkbookSchema from "@/data/default-workbook-schema.json";
import { buildMaterialityModel, buildSectionInsights, type SectionInsights as SectionInsightsModel } from "@/lib/rse-analytics";
import {
    buildOddSummary,
    buildRegisterContractAutoSummary,
    buildRegisterYearFlow,
    isOddSectionName,
    isPersonnelRegisterSectionName,
    ODD_DESCRIPTIONS,
    type ContractSummaryRow,
} from "@/lib/rse-domain";
import { parseNumberFlexible } from "@/lib/rse-format";
import {
    buildInitialState,
    formatSectionShortName,
    normalizeImportedState,
    parseWorkbookFile,
    type PersistedState,
    type RegisterManualRow,
    type SectionRow,
} from "@/lib/rse-manager";
import { groupSectionsByPillar } from "@/lib/rse-pillars";
import { buildSectionBlockModel } from "@/lib/rse-section-blocks";
import { exportSustainabilityPdf } from "@/lib/rse-report-pdf";

const STORAGE_KEY = "rse_manager_workspace_v1";
type Mode = "dashboard" | "materiality" | "actionPlan" | "imports" | "settings" | "section";

const seedState = buildInitialState(defaultWorkbookSchema as never, defaultWorkbookData as never);
const formatCount = (value: number) => new Intl.NumberFormat("fr-FR").format(value);
const formatPct = (ratio: number) => new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(ratio);
const PIE_COLORS = ["#0f766e", "#1d4ed8", "#155e75", "#0e7490", "#334155", "#0891b2"];

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function loadState(): PersistedState {
    if (typeof window === "undefined") return clone(seedState);
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return clone(seedState);
        const normalized = normalizeImportedState(JSON.parse(raw) as unknown);
        return normalized ?? clone(seedState);
    } catch {
        return clone(seedState);
    }
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid file data"));
        };
        reader.onerror = () => reject(new Error("Unable to read file"));
        reader.readAsDataURL(file);
    });
}

function buildManualContractSummary(rows: RegisterManualRow[]): ContractSummaryRow[] {
    const normalized = rows
        .map((row) => {
            const type = row.type.trim();
            const count = parseNumberFlexible(row.count) ?? 0;
            const percentRaw = parseNumberFlexible(row.percent);
            const ratio = percentRaw === null ? null : percentRaw > 1 ? percentRaw / 100 : percentRaw;
            return { type, count: Math.max(0, Math.round(count)), ratio };
        })
        .filter((row) => row.type !== "");

    const total = normalized.reduce((sum, row) => sum + row.count, 0);
    return normalized.map((row) => ({
        type: row.type,
        count: row.count,
        ratio: row.ratio ?? (total > 0 ? row.count / total : 0),
    }));
}

function buildDefaultManualRows(autoRows: ContractSummaryRow[]): RegisterManualRow[] {
    return autoRows.map((row) => ({
        type: row.type,
        count: String(row.count),
        percent: new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(row.ratio),
    }));
}

export default function App() {
    const [state, setState] = React.useState<PersistedState>(() => loadState());
    const [mode, setMode] = React.useState<Mode>("dashboard");
    const [activeSectionId, setActiveSectionId] = React.useState(state.sections[0]?.id ?? "");
    const [notice, setNotice] = React.useState("RSE Manager pret.");
    const backupInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    const hiddenSet = React.useMemo(() => new Set(state.hiddenSectionIds ?? []), [state.hiddenSectionIds]);
    const visibleSections = React.useMemo(() => state.sections.filter((section) => !hiddenSet.has(section.id)), [state.sections, hiddenSet]);
    const sectionsByPillar = React.useMemo(() => groupSectionsByPillar(visibleSections), [visibleSections]);
    const activeSection = React.useMemo(() => visibleSections.find((section) => section.id === activeSectionId) ?? null, [visibleSections, activeSectionId]);
    const activeRows = activeSection ? state.recordsBySection[activeSection.id] ?? [] : [];

    React.useEffect(() => {
        if (mode !== "section") return;
        if (visibleSections.length === 0) {
            setMode("dashboard");
            setActiveSectionId("");
            return;
        }
        if (!visibleSections.some((section) => section.id === activeSectionId)) {
            setActiveSectionId(visibleSections[0].id);
        }
    }, [mode, visibleSections, activeSectionId]);

    const insightsBySection = React.useMemo(() => {
        const map = new Map<string, SectionInsightsModel>();
        visibleSections.forEach((section) => map.set(section.id, buildSectionInsights(section, state.recordsBySection[section.id] ?? [])));
        return map;
    }, [visibleSections, state.recordsBySection]);

    const totals = React.useMemo(() => {
        const rows = visibleSections.reduce((sum, section) => sum + (state.recordsBySection[section.id] ?? []).length, 0);
        const fields = visibleSections.reduce((sum, section) => sum + section.fields.length, 0);
        return { rows, fields, visible: visibleSections.length, total: state.sections.length };
    }, [visibleSections, state.recordsBySection, state.sections.length]);

    const rowsChart = React.useMemo(
        () => visibleSections
            .map((section) => ({ name: formatSectionShortName(section.name), rows: (state.recordsBySection[section.id] ?? []).length }))
            .sort((a, b) => b.rows - a.rows)
            .slice(0, 14),
        [visibleSections, state.recordsBySection],
    );

    const completionChart = React.useMemo(
        () => visibleSections
            .map((section) => ({ name: formatSectionShortName(section.name), completion: insightsBySection.get(section.id)?.completionRate ?? 0 }))
            .slice(0, 14),
        [visibleSections, insightsBySection],
    );

    const coverageChart = React.useMemo(() => {
        let category = 0;
        let numeric = 0;
        let trend = 0;
        insightsBySection.forEach((insights) => {
            if (insights.categoryBreakdown.length > 0) category += 1;
            if (insights.numericSummary.length > 0) numeric += 1;
            if (insights.trendSeries.length > 0) trend += 1;
        });
        return [{ label: "Categories", value: category }, { label: "Numerique", value: numeric }, { label: "Tendance", value: trend }];
    }, [insightsBySection]);

    const materialityModel = React.useMemo(() => buildMaterialityModel(state, new Set(visibleSections.map((section) => section.id))), [state, visibleSections]);
    const oddSection = React.useMemo(() => state.sections.find((section) => isOddSectionName(section.name)) ?? null, [state.sections]);
    const oddSummary = React.useMemo(() => (oddSection ? buildOddSummary(state.recordsBySection[oddSection.id] ?? []) : null), [oddSection, state.recordsBySection]);
    const activeOddSummary = React.useMemo(() => activeSection && isOddSectionName(activeSection.name) ? buildOddSummary(activeRows) : null, [activeSection, activeRows]);
    const isRegisterSection = React.useMemo(() => activeSection ? isPersonnelRegisterSectionName(activeSection.name) : false, [activeSection]);
    const registerYearFlow = React.useMemo(() => (activeSection && isRegisterSection) ? buildRegisterYearFlow(activeSection, activeRows) : [], [activeSection, activeRows, isRegisterSection]);

    const autoContractRows = React.useMemo(() => (activeSection && isRegisterSection) ? buildRegisterContractAutoSummary(activeSection, activeRows) : [], [activeSection, activeRows, isRegisterSection]);
    const manualRows = React.useMemo(() => state.registerContractManualRows.length > 0 ? state.registerContractManualRows : buildDefaultManualRows(autoContractRows), [state.registerContractManualRows, autoContractRows]);
    const manualContractRows = React.useMemo(() => buildManualContractSummary(manualRows), [manualRows]);
    const contractRowsToDisplay = state.registerContractSummaryMode === "manual" ? manualContractRows : autoContractRows;
    const contractTotal = contractRowsToDisplay.reduce((sum, row) => sum + row.count, 0);

    const activeBlocks = React.useMemo(() => (activeSection ? buildSectionBlockModel(activeSection, activeRows).blocks : []), [activeSection, activeRows]);
    const actionPlanItems = state.actionPlanItems;

    const toggleHidden = (sectionId: string) => setState((prev) => ({ ...prev, hiddenSectionIds: prev.hiddenSectionIds.includes(sectionId) ? prev.hiddenSectionIds.filter((id) => id !== sectionId) : [...prev.hiddenSectionIds, sectionId] }));
    const showAll = () => setState((prev) => ({ ...prev, hiddenSectionIds: [] }));
    const hideInactive = () => setState((prev) => ({ ...prev, hiddenSectionIds: prev.sections.filter((section) => (prev.recordsBySection[section.id] ?? []).length === 0).map((section) => section.id) }));

    const setRegisterMode = (nextMode: "auto" | "manual") => setState((prev) => ({ ...prev, registerContractSummaryMode: nextMode }));
    const syncManualWithAuto = () => setState((prev) => ({ ...prev, registerContractManualRows: buildDefaultManualRows(autoContractRows), registerContractSummaryMode: "manual" }));

    const updateManualRow = (index: number, key: keyof RegisterManualRow, value: string) => {
        setState((prev) => {
            const sourceRows = prev.registerContractManualRows.length > 0 ? prev.registerContractManualRows : buildDefaultManualRows(autoContractRows);
            const nextRows = sourceRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row));
            return { ...prev, registerContractManualRows: nextRows };
        });
    };

    const addManualRow = () => setState((prev) => ({
        ...prev,
        registerContractSummaryMode: "manual",
        registerContractManualRows: [...(prev.registerContractManualRows.length > 0 ? prev.registerContractManualRows : buildDefaultManualRows(autoContractRows)), { type: "", count: "0", percent: "" }],
    }));

    const removeManualRow = (index: number) => setState((prev) => ({ ...prev, registerContractManualRows: prev.registerContractManualRows.filter((_, rowIndex) => rowIndex !== index) }));

    const setActionPlanItems = (items: typeof state.actionPlanItems) =>
        setState((prev) => ({ ...prev, actionPlanItems: items }));

    const toggleAi = () => setState((prev) => ({ ...prev, aiEnabled: !prev.aiEnabled }));

    const setHeaderBrandLogo = (slot: "primary" | "secondary", value: string | null) => setState((prev) => ({
        ...prev,
        headerBrandLogos: {
            ...prev.headerBrandLogos,
            [slot]: value ?? "",
        },
    }));

    async function uploadHeaderBrandLogo(slot: "primary" | "secondary", files: FileList | null): Promise<void> {
        const file = files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        setHeaderBrandLogo(slot, dataUrl);
        setNotice(`Logo ${slot === "primary" ? "1" : "2"} mis a jour.`);
    }

    const setOddLogo = (odd: number, value: string | null) => setState((prev) => {
        const key = String(odd);
        const next = { ...prev.oddLogos };
        if (!value) delete next[key]; else next[key] = value;
        return { ...prev, oddLogos: next };
    });

    async function uploadOddLogo(odd: number, files: FileList | null): Promise<void> {
        const file = files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        setOddLogo(odd, dataUrl);
        setNotice(`Logo ODD ${odd} mis a jour.`);
    }

    const saveRowInActiveSection = (values: Record<string, string>) => {
        if (!activeSection) return;
        const now = new Date().toISOString();
        const row: SectionRow = {
            id: `${activeSection.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            values,
            createdAt: now,
            updatedAt: now,
        };
        setState((prev) => ({ ...prev, recordsBySection: { ...prev.recordsBySection, [activeSection.id]: [row, ...(prev.recordsBySection[activeSection.id] ?? [])] } }));
        setNotice(`Ligne ajoutee dans ${activeSection.name}`);
    };

    const deleteRow = (rowId: string) => {
        if (!activeSection) return;
        setState((prev) => ({ ...prev, recordsBySection: { ...prev.recordsBySection, [activeSection.id]: (prev.recordsBySection[activeSection.id] ?? []).filter((row) => row.id !== rowId) } }));
    };

    const exportBackup = () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "rse-manager-backup.json";
        link.click();
        URL.revokeObjectURL(url);
    };
    async function restoreBackup(files: FileList | null): Promise<void> {
        const file = files?.[0];
        if (!file) return;
        const parsed = normalizeImportedState(JSON.parse(await file.text()) as unknown);
        if (!parsed) {
            setNotice("Backup invalide.");
            return;
        }
        setState(parsed);
        setActiveSectionId(parsed.sections[0]?.id ?? "");
        setMode("section");
        setNotice("Backup restaure.");
    }

    async function importWorkbook(files: FileList | null): Promise<void> {
        const file = files?.[0];
        if (!file) return;
        const parsed = await parseWorkbookFile(file);
        setState((prev) => ({
            ...parsed,
            hiddenSectionIds: [],
            importHistory: [...parsed.importHistory, ...prev.importHistory].slice(0, 40),
            headerBrandLogos: prev.headerBrandLogos,
            oddLogos: prev.oddLogos,
            registerContractSummaryMode: prev.registerContractSummaryMode,
            registerContractManualRows: prev.registerContractManualRows,
            actionPlanItems: prev.actionPlanItems,
            aiEnabled: prev.aiEnabled,
        }));
        setActiveSectionId(parsed.sections[0]?.id ?? "");
        setMode("section");
        setNotice(`Import termine: ${parsed.sections.length} onglets.`);
    }

    const exportReportPdf = () => {
        if (visibleSections.length === 0) {
            setNotice("Aucune section visible pour generer le rapport.");
            return;
        }
        exportSustainabilityPdf({ state, visibleSections, insightsBySection, materialityModel, oddSummary, totals });
        setNotice("Rapport PDF exporte.");
    };

    return (
        <SidebarProvider>
            <Sidebar variant="inset" collapsible="icon">
                <SidebarHeader className="border-b px-2 py-3">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" isActive>
                                <FolderKanban className="size-4" />
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">RSE Manager</span>
                                    <span className="truncate text-xs">Pilotage RSE</span>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                    <div className="mt-3 flex flex-col gap-2 px-2 group-data-[collapsible=icon]:hidden">
                        {(["primary", "secondary"] as const).map((slot, index) => {
                            const logo = state.headerBrandLogos[slot];
                            return (
                                <div key={slot} className="flex h-24 items-center justify-center rounded-md border bg-background/85 p-2">
                                    {logo ? (
                                        <img src={logo} alt={`Logo ${index + 1}`} className="h-full w-full object-contain" />
                                    ) : (
                                        <span className="text-[11px] text-muted-foreground">Logo {index + 1}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup><SidebarGroupLabel>Pilotage</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
                        <SidebarMenuItem><SidebarMenuButton type="button" isActive={mode === "dashboard"} onClick={() => setMode("dashboard")}><LayoutDashboard className="size-4" /><span>Dashboard</span></SidebarMenuButton></SidebarMenuItem>
                        <SidebarMenuItem><SidebarMenuButton type="button" isActive={mode === "materiality"} onClick={() => setMode("materiality")}><AlertTriangle className="size-4" /><span>Double materialite</span></SidebarMenuButton></SidebarMenuItem>
                        <SidebarMenuItem><SidebarMenuButton type="button" isActive={mode === "actionPlan"} onClick={() => setMode("actionPlan")}><ListTodo className="size-4" /><span>Plan d'action</span></SidebarMenuButton></SidebarMenuItem>
                        <SidebarMenuItem><SidebarMenuButton type="button" isActive={mode === "imports"} onClick={() => setMode("imports")}><Upload className="size-4" /><span>Imports</span></SidebarMenuButton></SidebarMenuItem>
                        <SidebarMenuItem><SidebarMenuButton type="button" isActive={mode === "settings"} onClick={() => setMode("settings")}><Settings className="size-4" /><span>Parametres</span></SidebarMenuButton></SidebarMenuItem>
                    </SidebarMenu></SidebarGroupContent></SidebarGroup>

                    <SidebarGroup>
                        <SidebarGroupLabel>Sections par pilier</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <ScrollArea className="h-[56vh] pr-2">
                                <div className="space-y-4">
                                    {sectionsByPillar.filter((group) => group.sections.length > 0).map((group) => (
                                        <div key={group.pillar} className="space-y-1">
                                            <p className="px-2 text-xs font-semibold text-muted-foreground">{group.label}</p>
                                            <SidebarMenu>
                                                {group.sections.map((section) => (
                                                    <SidebarMenuItem key={section.id}>
                                                        <SidebarMenuButton
                                                            type="button"
                                                            isActive={mode === "section" && activeSectionId === section.id}
                                                            onClick={() => {
                                                                setActiveSectionId(section.id);
                                                                setMode("section");
                                                            }}
                                                        >
                                                            <FileSpreadsheet className="size-4" />
                                                            <span>{section.name}</span>
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                ))}
                                            </SidebarMenu>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>

                <SidebarFooter className="gap-2"><p className="px-2 text-xs text-muted-foreground">{notice}</p></SidebarFooter>
                <SidebarRail />
            </Sidebar>

            <SidebarInset className="app-shell">
                <header className="flex h-24 shrink-0 items-center gap-3 border-b px-4 md:px-6">
                    <SidebarTrigger /><Separator orientation="vertical" className="h-4" />
                    <div className="min-w-0 flex-1"><p className="text-lg font-semibold">{mode === "section" && activeSection ? `Section: ${activeSection.name}` : "RSE Manager Workspace"}</p><p className="text-sm text-muted-foreground">Tableaux RSE structures, dates/formats nettoyes, graphiques contextuels par tableau.</p></div>
                    <Button variant="outline" onClick={exportReportPdf} className="hidden md:inline-flex"><FileDown className="h-4 w-4" /> Rapport PDF</Button>
                    <Button variant={state.aiEnabled ? "default" : "outline"} onClick={toggleAi} className="hidden md:inline-flex">{state.aiEnabled ? "IA active" : "IA inactive"}</Button>
                    <Badge variant="outline">{formatCount(totals.visible)} / {formatCount(totals.total)} sections visibles</Badge>
                </header>

                <div className="flex-1 space-y-6 p-4 md:p-6">
                    {mode === "dashboard" && <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Card><CardHeader className="py-3"><CardDescription>Sections visibles</CardDescription><CardTitle className="text-xl">{formatCount(totals.visible)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="py-3"><CardDescription>Lignes consolidees</CardDescription><CardTitle className="text-xl">{formatCount(totals.rows)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="py-3"><CardDescription>Champs suivis</CardDescription><CardTitle className="text-xl">{formatCount(totals.fields)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="py-3"><CardDescription>Sections masquees</CardDescription><CardTitle className="text-xl">{formatCount(state.hiddenSectionIds.length)}</CardTitle></CardHeader></Card>
                        </div>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Volume par section</CardTitle>
                                    <CardDescription>Style area chart (EvilCharts) avec gradient sobre.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={rowsChart}>
                                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                <XAxis dataKey="name" hide />
                                                <YAxis />
                                                <Tooltip />
                                                <defs>
                                                    <linearGradient id="dashboard-rows-gradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.5} />
                                                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0.1} />
                                                    </linearGradient>
                                                </defs>
                                                <Area
                                                    type="monotone"
                                                    dataKey="rows"
                                                    name="Lignes"
                                                    stroke="#0f766e"
                                                    fill="url(#dashboard-rows-gradient)"
                                                    fillOpacity={0.5}
                                                    strokeWidth={1.2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Completion par section</CardTitle>
                                    <CardDescription>Style area chart (EvilCharts) avec gradient sobre.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={completionChart}>
                                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                <XAxis dataKey="name" hide />
                                                <YAxis domain={[0, 100]} />
                                                <Tooltip formatter={(value) => [`${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value))} %`, "Completion"]} />
                                                <defs>
                                                    <linearGradient id="dashboard-completion-gradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.55} />
                                                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.12} />
                                                    </linearGradient>
                                                </defs>
                                                <Area
                                                    type="natural"
                                                    dataKey="completion"
                                                    name="Completion"
                                                    stroke="#1d4ed8"
                                                    fill="url(#dashboard-completion-gradient)"
                                                    fillOpacity={0.55}
                                                    strokeWidth={1.2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Couverture analytique</CardTitle></CardHeader><CardContent><div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={coverageChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#155e75" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
                            <Card><CardHeader><CardTitle className="text-base">Couverture ODD</CardTitle><CardDescription>Comptage des ODD releves dans les donnees.</CardDescription></CardHeader><CardContent className="space-y-2"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">ODD detectes</p><p className="text-xl font-semibold">{oddSummary ? `${oddSummary.detectedOddCount}/17` : "0/17"}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Releves totaux</p><p className="text-xl font-semibold">{oddSummary ? formatCount(oddSummary.totalReleves) : "0"}</p></div><Button className="w-full" variant="outline" onClick={exportReportPdf}><FileDown className="h-4 w-4" /> Exporter rapport PDF</Button></CardContent></Card>
                        </div>
                    </>}

                    {mode === "materiality" && <MaterialityMatrix state={state} visibleSectionIds={visibleSections.map((section) => section.id)} />}
                    {mode === "actionPlan" && <ActionPlanManager items={actionPlanItems} sections={state.sections} onChange={setActionPlanItems} />}
                    {mode === "imports" && <Card><CardHeader><CardTitle>Import et backup</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Importer Excel (.xlsx/.xls)</Label><Input type="file" accept=".xlsx,.xls" onChange={(event) => { void importWorkbook(event.target.files); event.currentTarget.value = ""; }} /></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportBackup}><FileArchive className="h-4 w-4" /> Export backup</Button><Button variant="outline" onClick={() => backupInputRef.current?.click()}><Upload className="h-4 w-4" /> Restore backup</Button><input ref={backupInputRef} className="hidden" type="file" accept=".json" onChange={(event) => { void restoreBackup(event.target.files); event.currentTarget.value = ""; }} /></div></CardContent></Card>}

                    {mode === "settings" && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Parametres</CardTitle>
                                <CardDescription>Configuration de l'interface, des logos et de la visibilite des sections.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="branding" className="space-y-4">
                                    <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                                        <TabsTrigger value="branding">Logos application</TabsTrigger>
                                        <TabsTrigger value="sections">Sections</TabsTrigger>
                                        <TabsTrigger value="odd">Logos ODD</TabsTrigger>
                                        <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="branding" className="space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Logos en haut a gauche</CardTitle>
                                                <CardDescription>
                                                    Ces 2 logos s'affichent sous le titre "RSE Manager" dans la barre laterale.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                                    {([
                                                        { slot: "primary", label: "Logo 1 (principal)" },
                                                        { slot: "secondary", label: "Logo 2 (secondaire)" },
                                                    ] as const).map((item, index) => {
                                                        const logo = state.headerBrandLogos[item.slot];
                                                        return (
                                                            <div key={item.slot} className="space-y-3 rounded-lg border p-3">
                                                                <p className="text-sm font-medium">{item.label}</p>
                                                                <div className="flex h-20 items-center justify-center rounded-md border bg-muted/20">
                                                                    {logo ? (
                                                                        <img src={logo} alt={`Logo ${index + 1}`} className="h-full max-h-16 w-auto object-contain" />
                                                                    ) : (
                                                                        <p className="text-xs text-muted-foreground">Aucun logo</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Input type="file" accept="image/*" onChange={(event) => { void uploadHeaderBrandLogo(item.slot, event.target.files); event.currentTarget.value = ""; }} />
                                                                    <Button type="button" size="sm" variant="ghost" className="w-full justify-start" onClick={() => setHeaderBrandLogo(item.slot, null)}>
                                                                        <X className="h-4 w-4" /> Supprimer
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="sections" className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={hideInactive}><EyeOff className="h-4 w-4" /> Masquer inactives</Button>
                                            <Button variant="outline" onClick={showAll}><Eye className="h-4 w-4" /> Afficher tout</Button>
                                        </div>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Visibilite des sections</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="w-full">
                                                    <div className="min-w-[820px]">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Section</TableHead>
                                                                    <TableHead className="text-right">Lignes</TableHead>
                                                                    <TableHead className="text-right">Etat</TableHead>
                                                                    <TableHead className="text-right">Action</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {state.sections.map((section) => {
                                                                    const hidden = hiddenSet.has(section.id);
                                                                    return (
                                                                        <TableRow key={section.id}>
                                                                            <TableCell className="font-medium">{section.name}</TableCell>
                                                                            <TableCell className="text-right">{formatCount((state.recordsBySection[section.id] ?? []).length)}</TableCell>
                                                                            <TableCell className="text-right">{hidden ? "Masquee" : "Visible"}</TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Button variant="ghost" size="sm" onClick={() => toggleHidden(section.id)}>{hidden ? "Afficher" : "Masquer"}</Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="odd" className="space-y-3">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Logos ODD</CardTitle>
                                                <CardDescription>Importe un logo par ODD. Les cartes ODD sont numerotees et affichent le nombre de releves.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                                    {Array.from({ length: 17 }, (_, index) => index + 1).map((odd) => {
                                                        const logo = state.oddLogos[String(odd)] ?? "";
                                                        const count = oddSummary?.metrics.find((metric) => metric.odd === odd)?.count ?? 0;
                                                        return (
                                                            <div key={odd} className="rounded-lg border bg-background/85 p-3">
                                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-semibold">ODD {odd}</p>
                                                                    <Badge variant="secondary">{formatCount(count)} releves</Badge>
                                                                </div>
                                                                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{ODD_DESCRIPTIONS[odd]}</p>
                                                                <div className="mb-3 flex h-20 items-center justify-center rounded-md border bg-muted/20">
                                                                    {logo ? <img src={logo} alt={`Logo ODD ${odd}`} className="h-full max-h-16 w-auto object-contain" /> : <p className="text-xs text-muted-foreground">Aucun logo</p>}
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Input type="file" accept="image/*" onChange={(event) => { void uploadOddLogo(odd, event.target.files); event.currentTarget.value = ""; }} />
                                                                    <Button type="button" size="sm" variant="ghost" className="w-full justify-start" onClick={() => setOddLogo(odd, null)}>
                                                                        <X className="h-4 w-4" /> Supprimer logo
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="maintenance" className="space-y-3">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Maintenance</CardTitle>
                                                <CardDescription>Actions systeme et sauvegardes.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                    <Button className="justify-start" variant="outline" onClick={exportBackup}><FileArchive className="h-4 w-4" /> Export backup</Button>
                                                    <Button className="justify-start" variant="outline" onClick={() => backupInputRef.current?.click()}><Upload className="h-4 w-4" /> Restore backup</Button>
                                                    <Button className="justify-start" variant="destructive" onClick={() => { setState(clone(seedState)); setMode("dashboard"); }}><Database className="h-4 w-4" /> Reinitialiser</Button>
                                                </div>
                                                <input ref={backupInputRef} className="hidden" type="file" accept=".json" onChange={(event) => { void restoreBackup(event.target.files); event.currentTarget.value = ""; }} />
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    )}
                    {mode === "section" && activeSection && <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <Card><CardHeader className="py-3"><CardDescription>Tableaux detectes</CardDescription><CardTitle className="text-xl">{formatCount(activeBlocks.length)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="py-3"><CardDescription>Lignes section</CardDescription><CardTitle className="text-xl">{formatCount(activeRows.length)}</CardTitle></CardHeader></Card>
                            <Card><CardHeader className="py-3"><CardDescription>Champs section</CardDescription><CardTitle className="text-xl">{formatCount(activeSection.fields.length)}</CardTitle></CardHeader></Card>
                        </div>
                        <SectionAiAssistant enabled={state.aiEnabled} onToggle={toggleAi} section={activeSection} rows={activeRows} />

                        {isRegisterSection && <Card><CardHeader><CardTitle>Registre du personnel - Flux annuel</CardTitle><CardDescription>Lecture RSE pertinente: entrees et sorties par annee (dates correctement interpretees).</CardDescription></CardHeader><CardContent><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={registerYearFlow}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="entrees" fill="#0f766e" radius={[4, 4, 0, 0]} /><Bar dataKey="sorties" fill="#b45309" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>}

                        {isRegisterSection && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Synthese type de contrat</CardTitle>
                                    <CardDescription>
                                        Mode auto: detection depuis le registre actif (date de sortie vide). Mode manuel: saisie libre pour ajustement.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant={state.registerContractSummaryMode === "auto" ? "default" : "outline"} onClick={() => setRegisterMode("auto")}>
                                            Detection auto
                                        </Button>
                                        <Button variant={state.registerContractSummaryMode === "manual" ? "default" : "outline"} onClick={() => setRegisterMode("manual")}>
                                            Saisie manuelle
                                        </Button>
                                        <Button variant="outline" onClick={syncManualWithAuto}>
                                            Synchroniser manuel depuis auto
                                        </Button>
                                    </div>

                                    {state.registerContractSummaryMode === "manual" && (
                                        <div className="rounded-lg border p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-medium">Edition manuelle</p>
                                                <Button variant="ghost" size="sm" onClick={addManualRow}>
                                                    <Plus className="h-4 w-4" /> Ajouter une ligne
                                                </Button>
                                            </div>
                                            <ScrollArea className="w-full">
                                                <div className="min-w-[760px]">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Type contrat</TableHead>
                                                                <TableHead className="text-right">Nb</TableHead>
                                                                <TableHead className="text-right">%</TableHead>
                                                                <TableHead className="text-right">Action</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {manualRows.map((row, index) => (
                                                                <TableRow key={`${index}_${row.type}`}>
                                                                    <TableCell><Input value={row.type} onChange={(event) => updateManualRow(index, "type", event.target.value)} /></TableCell>
                                                                    <TableCell><Input value={row.count} onChange={(event) => updateManualRow(index, "count", event.target.value)} /></TableCell>
                                                                    <TableCell><Input value={row.percent} placeholder="0.25 ou 25" onChange={(event) => updateManualRow(index, "percent", event.target.value)} /></TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="ghost" size="sm" onClick={() => removeManualRow(index)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                                        <Card className="min-w-0">
                                            <CardHeader>
                                                <CardTitle className="text-base">Tableau contrats</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="w-full">
                                                    <div className="min-w-[440px]">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Type contrat</TableHead>
                                                                    <TableHead className="text-right">Nb</TableHead>
                                                                    <TableHead className="text-right">%</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {contractRowsToDisplay.length === 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                                                                            Aucune donnee de contrat detectee.
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                                {contractRowsToDisplay.map((row) => (
                                                                    <TableRow key={row.type}>
                                                                        <TableCell className="font-medium">{row.type}</TableCell>
                                                                        <TableCell className="text-right">{formatCount(row.count)}</TableCell>
                                                                        <TableCell className="text-right">{formatPct(row.ratio)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                                {contractRowsToDisplay.length > 0 && (
                                                                    <TableRow>
                                                                        <TableCell className="font-semibold">Total</TableCell>
                                                                        <TableCell className="text-right font-semibold">{formatCount(contractTotal)}</TableCell>
                                                                        <TableCell className="text-right font-semibold">100 %</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>

                                        <Card className="min-w-0">
                                            <CardHeader>
                                                <CardTitle className="text-base">Camembert contrats</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-[280px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Tooltip formatter={(value) => [`${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value))} %`, "%"]} />
                                                            <Pie
                                                                data={contractRowsToDisplay.map((row) => ({ type: row.type, percent: Number((row.ratio * 100).toFixed(2)) }))}
                                                                dataKey="percent"
                                                                nameKey="type"
                                                                outerRadius={96}
                                                                innerRadius={42}
                                                                paddingAngle={2}
                                                                minAngle={4}
                                                                label={false}
                                                                labelLine={false}
                                                            >
                                                                {contractRowsToDisplay.map((row, index) => (
                                                                    <Cell key={`${row.type}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    {contractRowsToDisplay.map((row) => (
                                                        <span key={`legend_${row.type}`} className="rounded border px-2 py-1">
                                                            {row.type}: {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(row.ratio * 100)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeOddSummary && <Card><CardHeader><CardTitle>Carte ODD numerotee</CardTitle><CardDescription>{activeOddSummary.detectedOddCount}/17 ODD detectes, {formatCount(activeOddSummary.totalReleves)} releves.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{activeOddSummary.metrics.map((metric) => <div key={metric.odd} className="rounded-lg border bg-background/90 p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">ODD {metric.odd}</p><Badge variant="outline">{formatCount(metric.count)}</Badge></div><p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{metric.description}</p><div className="flex h-20 items-center justify-center rounded-md border bg-muted/20">{state.oddLogos[String(metric.odd)] ? <img src={state.oddLogos[String(metric.odd)]} alt={`Logo ODD ${metric.odd}`} className="h-full max-h-16 w-auto object-contain" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold">{metric.odd}</div>}</div><p className="mt-2 text-xs text-muted-foreground">Mentions detectees: {formatCount(metric.mentions)}</p></div>)}</div></CardContent></Card>}

                        <SectionTableBlocks section={activeSection} rows={activeRows} onSaveRow={saveRowInActiveSection} onDeleteRow={deleteRow} />
                    </>}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}


