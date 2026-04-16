import * as React from "react";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PersistedState } from "@/lib/rse-manager";
import { buildMaterialityModel, type MaterialityPoint } from "@/lib/rse-analytics";

type MaterialityMatrixProps = {
    state: PersistedState;
    visibleSectionIds: string[];
};

const PILLAR_COLORS: Record<MaterialityPoint["pillar"], string> = {
    E: "#0f766e",
    S: "#1d4ed8",
    G: "#7c3aed",
};

const PILLAR_LABEL: Record<MaterialityPoint["pillar"], string> = {
    E: "Environnement",
    S: "Social",
    G: "Gouvernance",
};

const MATERIALITY_THRESHOLD = 5.5;

type ScoreBand = "Faible" | "Modere" | "Eleve" | "Critique";

function scoreBand(score: number): ScoreBand {
    if (score < 3) return "Faible";
    if (score < MATERIALITY_THRESHOLD) return "Modere";
    if (score < 8) return "Eleve";
    return "Critique";
}

function pointSize(mentions: number): number {
    return Math.max(80, Math.min(mentions * 24, 520));
}

export function MaterialityMatrix({ state, visibleSectionIds }: MaterialityMatrixProps) {
    const model = React.useMemo(
        () => buildMaterialityModel(state, new Set(visibleSectionIds)),
        [state, visibleSectionIds],
    );

    const scatterData = model.points.map((point) => ({
        ...point,
        size: pointSize(point.mentions),
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Matrice de double materialite</CardTitle>
                <CardDescription>
                    Positionnement des enjeux RSE selon la materialite financiere (X) et la materialite d impact (Y), sur une echelle 0-10.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Materialite financiere moyenne: {model.averageX}</Badge>
                    <Badge variant="outline">Materialite d impact moyenne: {model.averageY}</Badge>
                    <Badge variant="outline">{model.points.length} enjeux analyses</Badge>
                    <Badge variant="outline">Seuil de priorisation: {MATERIALITY_THRESHOLD}</Badge>
                </div>

                <div className="h-[460px] w-full rounded-lg border bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 24, right: 30, bottom: 24, left: 24 }}>
                            <ReferenceArea x1={0} x2={MATERIALITY_THRESHOLD} y1={0} y2={MATERIALITY_THRESHOLD} fill="#f8fafc" fillOpacity={0.7} />
                            <ReferenceArea x1={MATERIALITY_THRESHOLD} x2={10} y1={0} y2={MATERIALITY_THRESHOLD} fill="#eff6ff" fillOpacity={0.6} />
                            <ReferenceArea x1={0} x2={MATERIALITY_THRESHOLD} y1={MATERIALITY_THRESHOLD} y2={10} fill="#fefce8" fillOpacity={0.6} />
                            <ReferenceArea x1={MATERIALITY_THRESHOLD} x2={10} y1={MATERIALITY_THRESHOLD} y2={10} fill="#fef2f2" fillOpacity={0.65} />
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Materialite financiere"
                                domain={[0, 10]}
                                ticks={[0, 2, 4, 6, 8, 10]}
                                label={{ value: "Abscisse (X): effets financiers sur l entreprise", position: "insideBottom", dy: 14 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Materialite d impact"
                                domain={[0, 10]}
                                ticks={[0, 2, 4, 6, 8, 10]}
                                label={{ value: "Ordonnee (Y): gravite et probabilite des impacts", angle: -90, dx: -8 }}
                            />
                            <ZAxis type="number" dataKey="size" range={[80, 520]} />
                            <ReferenceLine x={MATERIALITY_THRESHOLD} stroke="#475569" strokeDasharray="5 5" />
                            <ReferenceLine y={MATERIALITY_THRESHOLD} stroke="#475569" strokeDasharray="5 5" />
                            <Tooltip
                                cursor={{ strokeDasharray: "3 3" }}
                                formatter={(value, name) => {
                                    if (name === "size") return null;
                                    return [String(value), String(name)];
                                }}
                                content={({ active, payload }) => {
                                    if (!active || !payload || payload.length === 0) return null;
                                    const point = payload[0]?.payload as (MaterialityPoint & { size: number }) | undefined;
                                    if (!point) return null;
                                    return (
                                        <div className="rounded-md border bg-background p-3 text-sm shadow-md">
                                            <p className="font-semibold">{point.topic}</p>
                                            <p className="text-muted-foreground">{PILLAR_LABEL[point.pillar]}</p>
                                            <p>Materialite financiere (X): {point.x} ({scoreBand(point.x)})</p>
                                            <p>Materialite d impact (Y): {point.y} ({scoreBand(point.y)})</p>
                                            <p>Occurrences detectees: {point.mentions}</p>
                                            <p className="text-muted-foreground">{point.quadrant}</p>
                                        </div>
                                    );
                                }}
                            />
                            {(["E", "S", "G"] as const).map((pillar) => (
                                <Scatter key={pillar} name={PILLAR_LABEL[pillar]} data={scatterData.filter((point) => point.pillar === pillar)} fill={PILLAR_COLORS[pillar]} />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-md border bg-[#fef2f2] p-3">
                        <p className="font-medium">X &gt;= {MATERIALITY_THRESHOLD} et Y &gt;= {MATERIALITY_THRESHOLD}</p>
                        <p className="text-muted-foreground">Priorite strategique (double materialite)</p>
                    </div>
                    <div className="rounded-md border bg-[#eff6ff] p-3">
                        <p className="font-medium">X &gt;= {MATERIALITY_THRESHOLD} et Y &lt; {MATERIALITY_THRESHOLD}</p>
                        <p className="text-muted-foreground">Pilotage economique (materialite financiere dominante)</p>
                    </div>
                    <div className="rounded-md border bg-[#fefce8] p-3">
                        <p className="font-medium">X &lt; {MATERIALITY_THRESHOLD} et Y &gt;= {MATERIALITY_THRESHOLD}</p>
                        <p className="text-muted-foreground">Attente parties prenantes (materialite d impact dominante)</p>
                    </div>
                    <div className="rounded-md border bg-[#f8fafc] p-3">
                        <p className="font-medium">X &lt; {MATERIALITY_THRESHOLD} et Y &lt; {MATERIALITY_THRESHOLD}</p>
                        <p className="text-muted-foreground">Surveillance (enjeux a monitorer)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {(["E", "S", "G"] as const).map((pillar) => (
                        <div key={pillar} className="rounded-md border p-3 text-sm">
                            <p className="font-medium" style={{ color: PILLAR_COLORS[pillar] }}>{PILLAR_LABEL[pillar]}</p>
                            <p className="text-muted-foreground">
                                {model.points.filter((point) => point.pillar === pillar).length} enjeu(x) dans la matrice.
                            </p>
                        </div>
                    ))}
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
                    <p className="font-semibold">Definition detaillee des axes (logique DMA)</p>
                    <p>
                        Abscisse X - materialite financiere: effet probable sur la valeur de l entreprise (cash-flow, cout du capital, actifs, chiffre d affaires, exposition reglementaire).
                    </p>
                    <p>
                        Ordonnee Y - materialite d impact: gravite des impacts de l entreprise sur les personnes et l environnement (ampleur, etendue, caractere reversible, probabilite).
                    </p>
                    <p>
                        Niveaux de lecture 0-10: 0-2 faible, 3-5 modere, 5.5-7.9 eleve, 8-10 critique.
                        Les quadrants sont delimites au seuil {MATERIALITY_THRESHOLD} pour identifier les enjeux doublement materiels.
                    </p>
                    <p>
                        Le score est calcule depuis les occurrences detectees dans les sections visibles, avec ponderation contextuelle
                        selon la nature des sections (risques, parties prenantes, indicateurs, plans d action, etc.).
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
