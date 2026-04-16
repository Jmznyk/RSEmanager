import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type SectionDefinition, type SectionRow } from "@/lib/rse-manager";
import { buildSectionInsights } from "@/lib/rse-analytics";

type SectionInsightsProps = {
    section: SectionDefinition;
    rows: SectionRow[];
};

const PIE_COLORS = ["#0f766e", "#155e75", "#1d4ed8", "#7c3aed", "#9333ea", "#be185d", "#b45309", "#334155", "#94a3b8"];

function formatNumber(value: number): string {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}

function formatPeriod(value: string): string {
    if (/^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split("-");
        return `${month}/${year}`;
    }
    return value;
}

export function SectionInsights({ section, rows }: SectionInsightsProps) {
    const insights = React.useMemo(() => buildSectionInsights(section, rows), [section, rows]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="py-3">
                        <CardDescription>Fiches section</CardDescription>
                        <CardTitle className="text-xl">{new Intl.NumberFormat("fr-FR").format(insights.rowCount)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="py-3">
                        <CardDescription>Taux de completion</CardDescription>
                        <CardTitle className="text-xl">{formatNumber(insights.completionRate)}%</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="py-3">
                        <CardDescription>Champs modeles</CardDescription>
                        <CardTitle className="text-xl">{new Intl.NumberFormat("fr-FR").format(section.fields.length)}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Completion par champ</CardTitle>
                        <CardDescription>Vision qualite de saisie sur les champs principaux.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={insights.completionByField}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="field" hide />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Bar dataKey="rate" fill="#0f766e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Distribution categories</CardTitle>
                        <CardDescription>
                            {insights.categoryFieldLabel
                                ? `Repartition sur le champ: ${insights.categoryFieldLabel}`
                                : "Aucun champ categoriel exploitable detecte."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px] w-full">
                            {insights.categoryBreakdown.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Tooltip />
                                        <Pie
                                            data={insights.categoryBreakdown}
                                            dataKey="count"
                                            nameKey="label"
                                            outerRadius={95}
                                            innerRadius={35}
                                            paddingAngle={2}
                                            minAngle={4}
                                            label={false}
                                            labelLine={false}
                                        >
                                            {insights.categoryBreakdown.map((entry, index) => (
                                                <Cell key={`${entry.label}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Donnees insuffisantes pour un graphique de repartition.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Mesures numeriques</CardTitle>
                        <CardDescription>Moyennes calculees sur les champs numeriques detectes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px] w-full">
                            {insights.numericSummary.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={insights.numericSummary}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="field" hide />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="avg" fill="#155e75" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Aucun indicateur numerique exploitable dans cette section.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Tendance temporelle</CardTitle>
                        <CardDescription>
                            {insights.trendLabel
                                ? `Serie calculee a partir de ${insights.trendLabel}`
                                : "Aucune serie date + valeur exploitable detectee."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px] w-full">
                            {insights.trendSeries.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={insights.trendSeries}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                        <XAxis dataKey="period" tickFormatter={formatPeriod} />
                                        <YAxis />
                                        <Tooltip labelFormatter={(label) => formatPeriod(String(label))} />
                                        <defs>
                                            <linearGradient id="section-insights-trend-gradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.55} />
                                                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <Area
                                            type="natural"
                                            dataKey="value"
                                            stroke="#1d4ed8"
                                            fill="url(#section-insights-trend-gradient)"
                                            fillOpacity={0.5}
                                            strokeWidth={1.1}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Pas de tendance disponible pour cette section.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
