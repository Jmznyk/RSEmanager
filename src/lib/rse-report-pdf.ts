import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MaterialityModel, SectionInsights } from "@/lib/rse-analytics";
import type { OddSummary } from "@/lib/rse-domain";
import type { PersistedState, SectionDefinition } from "@/lib/rse-manager";

type ReportTotals = {
    rows: number;
    fields: number;
    visible: number;
    total: number;
};

type ReportInput = {
    state: PersistedState;
    visibleSections: SectionDefinition[];
    insightsBySection: Map<string, SectionInsights>;
    materialityModel: MaterialityModel;
    oddSummary: OddSummary | null;
    totals: ReportTotals;
};

function getLastTableY(doc: jsPDF): number {
    const cast = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
    return cast.lastAutoTable?.finalY ?? 40;
}

function addSectionTitle(doc: jsPDF, text: string, y: number): number {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(text, 40, y);
    return y + 14;
}

function ensurePageSpace(doc: jsPDF, currentY: number, needed: number): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + needed <= pageHeight - 32) {
        return currentY;
    }
    doc.addPage();
    return 40;
}

function pageFooter(doc: jsPDF): void {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`RSE Manager - Rapport de durabilite`, 40, height - 16);
        doc.text(`Page ${page}/${pages}`, width - 40, height - 16, { align: "right" });
    }
}

export function exportSustainabilityPdf(input: ReportInput): void {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const generatedAt = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
    }).format(new Date());

    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 120, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("Rapport de durabilite", 40, 62);
    doc.setFontSize(13);
    doc.text("RSE Manager", 40, 86);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text(`Genere le ${generatedAt}`, 40, 142);

    let cursorY = 170;
    cursorY = addSectionTitle(doc, "1. Synthese executive", cursorY);

    autoTable(doc, {
        startY: cursorY,
        theme: "grid",
        head: [["Indicateur", "Valeur"]],
        body: [
            ["Sections visibles", String(input.totals.visible)],
            ["Sections totales", String(input.totals.total)],
            ["Lignes consolidees", new Intl.NumberFormat("fr-FR").format(input.totals.rows)],
            ["Champs suivis", new Intl.NumberFormat("fr-FR").format(input.totals.fields)],
            ["Imports en historique", String(input.state.importHistory.length)],
        ],
        headStyles: { fillColor: [15, 118, 110] },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: {
            0: { cellWidth: 240 },
            1: { cellWidth: 120 },
        },
    });

    cursorY = getLastTableY(doc) + 24;
    cursorY = ensurePageSpace(doc, cursorY, 220);
    cursorY = addSectionTitle(doc, "2. Double materialite", cursorY);

    const topPoints = input.materialityModel.points.slice(0, 12);
    autoTable(doc, {
        startY: cursorY,
        theme: "striped",
        head: [["Enjeu", "Pilier", "Impact business", "Importance PP", "Occurrences", "Quadrant"]],
        body: topPoints.map((point) => [
            point.topic,
            point.pillar,
            point.x.toFixed(1),
            point.y.toFixed(1),
            String(point.mentions),
            point.quadrant,
        ]),
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
            0: { cellWidth: 155 },
            1: { cellWidth: 48 },
            2: { cellWidth: 68 },
            3: { cellWidth: 74 },
            4: { cellWidth: 56 },
            5: { cellWidth: 104 },
        },
    });

    cursorY = getLastTableY(doc) + 24;

    if (input.oddSummary) {
        cursorY = ensurePageSpace(doc, cursorY, 260);
        cursorY = addSectionTitle(doc, "3. Couverture ODD", cursorY);

        autoTable(doc, {
            startY: cursorY,
            theme: "plain",
            body: [
                [`ODD detectes`, `${input.oddSummary.detectedOddCount}/17`],
                ["Total de releves ODD", new Intl.NumberFormat("fr-FR").format(input.oddSummary.totalReleves)],
            ],
            styles: { fontSize: 10, cellPadding: 4 },
            columnStyles: {
                0: { fontStyle: "bold", cellWidth: 200 },
                1: { cellWidth: 120 },
            },
        });

        autoTable(doc, {
            startY: getLastTableY(doc) + 10,
            theme: "grid",
            head: [["ODD", "Intitule", "Nombre releves"]],
            body: input.oddSummary.metrics.map((metric) => [
                `ODD ${metric.odd}`,
                metric.description,
                new Intl.NumberFormat("fr-FR").format(metric.count),
            ]),
            headStyles: { fillColor: [8, 145, 178] },
            styles: { fontSize: 9, cellPadding: 5 },
            columnStyles: {
                0: { cellWidth: 56 },
                1: { cellWidth: 320 },
                2: { cellWidth: 100 },
            },
        });

        cursorY = getLastTableY(doc) + 24;
    }

    cursorY = ensurePageSpace(doc, cursorY, 240);
    cursorY = addSectionTitle(doc, input.oddSummary ? "4. Performance par section" : "3. Performance par section", cursorY);

    const sectionRows = input.visibleSections
        .map((section) => {
            const insights = input.insightsBySection.get(section.id);
            const topCategory = insights?.categoryBreakdown[0];
            return [
                section.name,
                new Intl.NumberFormat("fr-FR").format(insights?.rowCount ?? 0),
                `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(insights?.completionRate ?? 0)}%`,
                topCategory ? `${topCategory.label} (${topCategory.count})` : "-",
                insights?.trendLabel ?? "-",
            ];
        })
        .sort((a, b) => Number(b[1].replace(/\s/g, "")) - Number(a[1].replace(/\s/g, "")));

    autoTable(doc, {
        startY: cursorY,
        theme: "striped",
        head: [["Section", "Lignes", "Completion", "Categorie principale", "Tendance"]],
        body: sectionRows,
        headStyles: { fillColor: [15, 118, 110] },
        styles: { fontSize: 8.5, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 165 },
            1: { cellWidth: 56 },
            2: { cellWidth: 70 },
            3: { cellWidth: 140 },
            4: { cellWidth: 125 },
        },
    });

    pageFooter(doc);

    const dateTag = new Date().toISOString().slice(0, 10);
    doc.save(`rapport-durabilite-${dateTag}.pdf`);
}
