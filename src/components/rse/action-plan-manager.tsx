import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
    ActionPlanItem,
    ActionPlanPillar,
    ActionPlanPriority,
    ActionPlanStatus,
    SectionDefinition,
} from "@/lib/rse-manager";

type ActionPlanManagerProps = {
    items: ActionPlanItem[];
    sections: SectionDefinition[];
    onChange: (items: ActionPlanItem[]) => void;
};

const STATUS_LIST: ActionPlanStatus[] = ["A faire", "En cours", "Bloque", "Termine"];
const PRIORITY_LIST: ActionPlanPriority[] = ["Haute", "Moyenne", "Basse"];
const PILLAR_LIST: ActionPlanPillar[] = ["E", "S", "G"];

function nextStatusColor(status: ActionPlanStatus): "default" | "secondary" | "outline" | "destructive" {
    if (status === "Termine") return "default";
    if (status === "En cours") return "secondary";
    if (status === "Bloque") return "destructive";
    return "outline";
}

function emptyDraft(): Omit<ActionPlanItem, "id" | "createdAt" | "updatedAt"> {
    return {
        title: "",
        pillar: "G",
        sectionId: "",
        owner: "",
        dueDate: "",
        priority: "Moyenne",
        status: "A faire",
        progress: 0,
        kpi: "",
        notes: "",
    };
}

export function ActionPlanManager({ items, sections, onChange }: ActionPlanManagerProps) {
    const [statusFilter, setStatusFilter] = React.useState<ActionPlanStatus | "Tous">("Tous");
    const [pillarFilter, setPillarFilter] = React.useState<ActionPlanPillar | "Tous">("Tous");
    const [draft, setDraft] = React.useState(emptyDraft());

    const filteredItems = React.useMemo(() => {
        return items.filter((item) => {
            if (statusFilter !== "Tous" && item.status !== statusFilter) return false;
            if (pillarFilter !== "Tous" && item.pillar !== pillarFilter) return false;
            return true;
        });
    }, [items, statusFilter, pillarFilter]);

    const byStatus = React.useMemo(() => {
        const base: Record<ActionPlanStatus, number> = {
            "A faire": 0,
            "En cours": 0,
            Bloque: 0,
            Termine: 0,
        };
        items.forEach((item) => {
            base[item.status] += 1;
        });
        return base;
    }, [items]);

    const setDraftField = (key: keyof Omit<ActionPlanItem, "id" | "createdAt" | "updatedAt">, value: string | number) => {
        setDraft((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const addItem = () => {
        if (!draft.title.trim()) return;
        const now = new Date().toISOString();
        const next: ActionPlanItem = {
            id: `ap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...draft,
            progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)),
            createdAt: now,
            updatedAt: now,
        };
        onChange([next, ...items]);
        setDraft(emptyDraft());
    };

    const updateItem = (id: string, patch: Partial<ActionPlanItem>) => {
        const now = new Date().toISOString();
        onChange(
            items.map((item) => {
                if (item.id !== id) return item;
                const nextProgress = patch.progress ?? item.progress;
                return {
                    ...item,
                    ...patch,
                    progress: Math.max(0, Math.min(100, Number(nextProgress) || 0)),
                    updatedAt: now,
                };
            }),
        );
    };

    const removeItem = (id: string) => {
        onChange(items.filter((item) => item.id !== id));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logiciel de plan d'action RSE</CardTitle>
                <CardDescription>
                    Consolide, priorise et pilote les actions avec responsables, echeances, KPI et progression.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {STATUS_LIST.map((status) => (
                        <div key={status} className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">{status}</p>
                            <p className="text-xl font-semibold">{byStatus[status]}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-lg border bg-muted/10 p-3">
                    <p className="mb-3 text-sm font-medium">Nouvelle action</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 xl:col-span-2">
                            <Label>Action</Label>
                            <Input value={draft.title} onChange={(event) => setDraftField("title", event.target.value)} placeholder="Ex: Structurer plan de reduction des emissions" />
                        </div>
                        <div className="space-y-2">
                            <Label>Pilier</Label>
                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.pillar} onChange={(event) => setDraftField("pillar", event.target.value as ActionPlanPillar)}>
                                {PILLAR_LIST.map((pillar) => <option key={pillar} value={pillar}>{pillar}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Section</Label>
                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.sectionId} onChange={(event) => setDraftField("sectionId", event.target.value)}>
                                <option value="">-</option>
                                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Responsable</Label>
                            <Input value={draft.owner} onChange={(event) => setDraftField("owner", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Echeance</Label>
                            <Input type="date" value={draft.dueDate} onChange={(event) => setDraftField("dueDate", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Priorite</Label>
                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.priority} onChange={(event) => setDraftField("priority", event.target.value as ActionPlanPriority)}>
                                {PRIORITY_LIST.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.status} onChange={(event) => setDraftField("status", event.target.value as ActionPlanStatus)}>
                                {STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                            <Label>KPI cible</Label>
                            <Input value={draft.kpi} onChange={(event) => setDraftField("kpi", event.target.value)} placeholder="Ex: -12% CO2 scope 2" />
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                            <Label>Notes</Label>
                            <Textarea rows={2} value={draft.notes} onChange={(event) => setDraftField("notes", event.target.value)} />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button onClick={addItem}><Plus className="h-4 w-4" /> Ajouter l'action</Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Filtres</Badge>
                    <select className="h-8 rounded-md border bg-background px-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ActionPlanStatus | "Tous")}>
                        <option value="Tous">Tous les statuts</option>
                        {STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select className="h-8 rounded-md border bg-background px-2 text-sm" value={pillarFilter} onChange={(event) => setPillarFilter(event.target.value as ActionPlanPillar | "Tous")}>
                        <option value="Tous">Tous les piliers</option>
                        {PILLAR_LIST.map((pillar) => <option key={pillar} value={pillar}>{pillar}</option>)}
                    </select>
                </div>

                <ScrollArea className="w-full">
                    <div className="min-w-[1200px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Pilier</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead>Echeance</TableHead>
                                    <TableHead>Priorite</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progression</TableHead>
                                    <TableHead>KPI</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell><Input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} /></TableCell>
                                        <TableCell>
                                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={item.pillar} onChange={(event) => updateItem(item.id, { pillar: event.target.value as ActionPlanPillar })}>
                                                {PILLAR_LIST.map((pillar) => <option key={pillar} value={pillar}>{pillar}</option>)}
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={item.sectionId} onChange={(event) => updateItem(item.id, { sectionId: event.target.value })}>
                                                <option value="">-</option>
                                                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                                            </select>
                                        </TableCell>
                                        <TableCell><Input value={item.owner} onChange={(event) => updateItem(item.id, { owner: event.target.value })} /></TableCell>
                                        <TableCell><Input type="date" value={item.dueDate} onChange={(event) => updateItem(item.id, { dueDate: event.target.value })} /></TableCell>
                                        <TableCell>
                                            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={item.priority} onChange={(event) => updateItem(item.id, { priority: event.target.value as ActionPlanPriority })}>
                                                {PRIORITY_LIST.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as ActionPlanStatus })}>
                                                    {STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                                                </select>
                                                <Badge variant={nextStatusColor(item.status)}>{item.status}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell><Input type="number" min={0} max={100} value={item.progress} onChange={(event) => updateItem(item.id, { progress: Number(event.target.value) || 0 })} /></TableCell>
                                        <TableCell><Input value={item.kpi} onChange={(event) => updateItem(item.id, { kpi: event.target.value })} /></TableCell>
                                        <TableCell><Textarea rows={1} value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} /></TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                                {filteredItems.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-sm text-muted-foreground">Aucune action pour ces filtres.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
