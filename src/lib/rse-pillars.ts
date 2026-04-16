import { normalizeText } from "@/lib/rse-format";
import type { SectionDefinition } from "@/lib/rse-manager";

export type RsePillar = "E" | "S" | "G";

export type RsePillarGroup = {
    pillar: RsePillar;
    label: string;
    sections: SectionDefinition[];
};

const LABELS: Record<RsePillar, string> = {
    E: "Environnement",
    S: "Social",
    G: "Gouvernance",
};

const E_KEYWORDS = [
    "environnement",
    "carbone",
    "co2",
    "climat",
    "emission",
    "dechet",
    "eau",
    "energie",
    "biodiversite",
    "ressource",
    "consommation",
    "mobilite",
    "beges",
    "circular",
    "scope",
];

const S_KEYWORDS = [
    "social",
    "personnel",
    "salar",
    "rh",
    "formation",
    "sante",
    "securite",
    "qvt",
    "diversite",
    "inclusion",
    "emploi",
    "client",
    "satisfaction",
    "territoire",
    "communaute",
    "partie prenante",
    "societ",
    "f/h",
    "egalite",
];

const G_KEYWORDS = [
    "gouvernance",
    "ethique",
    "conformite",
    "risque",
    "audit",
    "pilotage",
    "kpi",
    "indicateur",
    "reporting",
    "strategie",
    "plan d'action",
    "plan action",
    "odd",
    "iso",
    "csrd",
    "achats",
    "fournisseur",
    "matrice",
];

function score(normalized: string, keywords: string[]): number {
    return keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0);
}

export function inferSectionPillar(sectionName: string): RsePillar {
    const normalized = normalizeText(sectionName);
    const e = score(normalized, E_KEYWORDS);
    const s = score(normalized, S_KEYWORDS);
    const g = score(normalized, G_KEYWORDS);

    if (e === 0 && s === 0 && g === 0) return "G";
    if (e >= s && e >= g) return "E";
    if (s >= e && s >= g) return "S";
    return "G";
}

export function groupSectionsByPillar(sections: SectionDefinition[]): RsePillarGroup[] {
    const groups: Record<RsePillar, SectionDefinition[]> = { E: [], S: [], G: [] };

    sections.forEach((section) => {
        const pillar = inferSectionPillar(section.name);
        groups[pillar].push(section);
    });

    return (["E", "S", "G"] as const).map((pillar) => ({
        pillar,
        label: LABELS[pillar],
        sections: groups[pillar],
    }));
}
