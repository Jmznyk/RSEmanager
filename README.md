# RSE Manager

RSE Manager est une application web React pour piloter un referentiel RSE a partir de classeurs Excel ou de jeux de donnees precharges. L'outil consolide des sections metier, calcule des indicateurs, construit une matrice de double materialite, suit un plan d'action et genere un rapport PDF de durabilite.

Le projet est pense pour un usage local ou interne: les donnees sont chargees dans l'application et persistees dans le navigateur via `localStorage`.

## Fonctionnalites

- Import de classeurs Excel (`.xlsx`, `.xls`) et normalisation automatique des onglets en sections exploitables.
- Tableau de bord RSE avec indicateurs de volume, completion, couverture analytique et graphiques.
- Matrice de double materialite avec scoring des enjeux E/S/G et quadrants de priorisation.
- Gestion d'un plan d'action RSE avec priorite, statut, responsable, echeance, KPI et progression.
- Analyse de section avec assistant "IA" local base sur les donnees visibles de la section.
- Syntheses metier dediees, notamment pour le registre du personnel et la couverture ODD.
- Personnalisation de logos d'entete et de logos ODD.
- Export d'un rapport PDF de durabilite.
- Export et restauration d'un backup JSON du workspace.

## Stack technique

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Recharts
- jsPDF / jspdf-autotable
- xlsx

## Installation

Prerequis:

- Node.js 20+ recommande
- npm

Installation locale:

```bash
npm install
```

Lancement en developpement:

```bash
npm run dev
```

Build de production:

```bash
npm run build
```

Verification lint:

```bash
npm run lint
```

Preview du build:

```bash
npm run preview
```

## Utilisation

1. Demarrer l'application avec `npm run dev`.
2. Ouvrir l'interface Vite dans le navigateur.
3. Importer un classeur depuis la vue `Imports` ou travailler a partir des donnees fournies par defaut.
4. Explorer les vues `Dashboard`, `Double materialite`, `Plan d'action` et les sections individuelles.
5. Exporter un backup JSON ou generer un rapport PDF depuis l'application.

## Donnees et persistance

- L'etat de travail est conserve dans `localStorage` via la cle `rse_manager_workspace_v1`.
- Les imports Excel sont transformes en sections et lignes internes a l'application.
- Les backups JSON permettent de restaurer un workspace complet.
- Les logos importes sont stockes en Data URL dans l'etat local.

## Structure du projet

```text
src/
  components/
    rse/        composants metier RSE
    ui/         composants UI reutilisables
  data/         schema et donnees par defaut
  lib/          logique metier, import, analytics, PDF
  App.tsx       shell principal de l'application
```

Fichiers centraux:

- [src/App.tsx](C:/Users/cse/Desktop/dev/rse-manager/src/App.tsx)
- [src/lib/rse-manager.ts](C:/Users/cse/Desktop/dev/rse-manager/src/lib/rse-manager.ts)
- [src/lib/rse-analytics.ts](C:/Users/cse/Desktop/dev/rse-manager/src/lib/rse-analytics.ts)
- [src/lib/rse-report-pdf.ts](C:/Users/cse/Desktop/dev/rse-manager/src/lib/rse-report-pdf.ts)

## Limites actuelles

- L'assistant IA est un assistant local base sur des regles et des statistiques, pas une integration LLM distante.
- La persistance est locale au navigateur tant qu'aucun backend n'est ajoute.
- L'import est oriente classeurs tabulaires; des mappings metier plus stricts peuvent etre ajoutes si necessaire.

## GitHub

Depot distant:

- [Jmznyk/RSEmanager](https://github.com/Jmznyk/RSEmanager)

