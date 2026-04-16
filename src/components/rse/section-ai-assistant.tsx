import * as React from "react";
import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildSectionInsights } from "@/lib/rse-analytics";
import type { SectionDefinition, SectionRow } from "@/lib/rse-manager";

type SectionAiAssistantProps = {
    enabled: boolean;
    onToggle: () => void;
    section: SectionDefinition;
    rows: SectionRow[];
};

function generateSuggestion(section: SectionDefinition, rows: SectionRow[], question: string, importedFileName: string | null): string {
    const insights = buildSectionInsights(section, rows);
    const lines: string[] = [];

    lines.push(`Section analysee: ${section.name}`);
    lines.push(`Question: ${question || "Analyse generale"}`);
    lines.push(`Volume de donnees: ${insights.rowCount} ligne(s), ${section.fields.length} champ(s).`);
    lines.push(`Taux de completion global: ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(insights.completionRate)} %.`);

    const weakFields = insights.completionByField.filter((item) => item.rate < 70).slice(0, 4);
    if (weakFields.length > 0) {
        lines.push("Champs a renforcer en priorite:");
        weakFields.forEach((item) => {
            lines.push(`- ${item.field}: ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(item.rate)} % renseigne`);
        });
    }

    if (insights.numericSummary.length > 0) {
        const top = insights.numericSummary[0];
        lines.push(`Indicateur numerique dominant: ${top.field} (moyenne ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(top.avg)}).`);
    }

    if (insights.categoryBreakdown.length > 0) {
        const topCat = insights.categoryBreakdown[0];
        lines.push(`Categorie principale: ${topCat.label} (${topCat.count} occurrence(s)).`);
    }

    if (insights.trendSeries.length > 0) {
        const first = insights.trendSeries[0];
        const last = insights.trendSeries[insights.trendSeries.length - 1];
        lines.push(`Tendance observee (${insights.trendLabel}): ${first.period} -> ${last.period}.`);
    }

    lines.push("Points de surveillance RSE suggeres:");
    lines.push("- Completer les champs critiques manquants avant extraction du rapport.");
    lines.push("- Verifier la coherence des unites et des pourcentages.");
    lines.push("- Relier les actions en retard au plan d'action (pilier E/S/G).\n");

    if (importedFileName) {
        lines.push(`Fichier joint detecte: ${importedFileName}.`);
        lines.push("Usage recommande: importer puis laisser l'assistant pre-remplir les champs equivalents apres mapping.");
    }

    lines.push("Pour un vrai mode IA (OpenAI/API), activer l'inference externe pour generation de texte de rapport, alertes automatiques et proposition de completions." );
    return lines.join("\n");
}

export function SectionAiAssistant({ enabled, onToggle, section, rows }: SectionAiAssistantProps) {
    const [question, setQuestion] = React.useState("");
    const [importedFileName, setImportedFileName] = React.useState<string | null>(null);
    const [response, setResponse] = React.useState("");

    React.useEffect(() => {
        setResponse("");
        setQuestion("");
        setImportedFileName(null);
    }, [section.id]);

    return (
        <Card className="border-sky-200 bg-sky-50/70">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-sky-900">Assistant IA de section</CardTitle>
                        <CardDescription className="text-sky-800/80">Active ou desactive l'assistant pour cette section.</CardDescription>
                    </div>
                    <Button variant={enabled ? "default" : "outline"} onClick={onToggle}>
                        <Bot className="h-4 w-4" /> {enabled ? "Desactiver IA" : "Activer IA"}
                    </Button>
                </div>
            </CardHeader>
            {enabled && (
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Question IA</Label>
                            <Textarea
                                rows={4}
                                value={question}
                                onChange={(event) => setQuestion(event.target.value)}
                                placeholder="Ex: quels sont les points a ameliorer avant le rapport de durabilite ?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fichier source (optionnel)</Label>
                            <Input
                                type="file"
                                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    setImportedFileName(file?.name ?? null);
                                }}
                            />
                            <p className="text-xs text-sky-900/70">Importer un fichier pour guider un pre-remplissage/mapping de donnees.</p>
                            {importedFileName && <p className="text-xs font-medium text-sky-900">Fichier charge: {importedFileName}</p>}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => setResponse(generateSuggestion(section, rows, question, importedFileName))}
                        >
                            <Sparkles className="h-4 w-4" /> Lancer l'analyse IA
                        </Button>
                    </div>

                    {response && (
                        <div className="rounded-md border border-sky-200 bg-white p-3">
                            <pre className="whitespace-pre-wrap text-sm text-slate-700">{response}</pre>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
