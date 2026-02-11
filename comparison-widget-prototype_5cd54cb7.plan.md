---
name: comparison-widget-prototype
overview: Build a standalone prototype that ingests CSV + initial carrier PDFs, normalizes tabular values, and renders a 3-up comparison table and line chart with toggleable derived columns; prepare exportable PDF output and hooks for later Supabase integration.
todos:
  - id: ingest-schema
    content: Define canonical schema from template CSV
    status: pending
  - id: pdf-parsers
    content: Implement PDF table extraction per carrier mappings
    status: pending
  - id: ui-compare
    content: Build 3-up comparison table + line chart + toggles
    status: pending
  - id: edit-table
    content: Add editable table with validation + overrides
    status: pending
  - id: export-pdf
    content: Add PDF export for comparison + source docs
    status: pending
  - id: storage-hooks
    content: Stub storage interface for later Supabase
    status: pending
isProject: false
---

## Scope and Inputs

- Build a standalone prototype in this workspace (per your selection) that supports PDF + CSV ingestion and outputs a comparison view matching the template.
- Use the provided carrier table mappings you will share (page ranges + column mappings) and a CSV export of the comparison template.
- Defer Meritas integration (explicitly out of phase 1).

## Key Files and Structure

- Create a small app folder (e.g., `[prototype/](prototype/)`) with:
  - Ingestion layer for PDF tables and CSV uploads.
  - Normalization model that maps raw carrier tables into a common schema (premium, cumulative outlay, cash value, death benefit, plus optional derived metrics).
  - UI with 3-up comparison table and line chart + toggles.
  - Editable table grid with per-cell overrides, validation, and reset to original import.
  - Export module to render a PDF of the comparison plus attached source illustrations.

## Data Mapping and Normalization

- Define a canonical schema based on the CSV template you provide (columns, order, any formulas).
- For each carrier in phase 1:
  - Implement a PDF table extractor using the exact page ranges + column mapping you provide.
  - Normalize values into the canonical schema.
- Support up to 3 policy options simultaneously and align by policy year.

## Calculations and Toggles

- Implement optional columns:
  - Cash value increase.
  - Cash value efficiency.
  - Internal IRR.
- Each toggle updates the table and chart series without re-uploading data.

## UI Output

- Table: 3 side-by-side option columns with rows for year, premium, cumulative outlay, cash value, death benefit.
- Chart: line graph for the three options with selectable metric (default to cash value) and toggleable derived metrics.
- Inline editing for imported values with visual indicators for overridden cells and a reset action.

## Export and Future Integration Hooks

- Provide a “Save as PDF” action that bundles the comparison view and includes uploaded illustrations as attachments or appended pages.
- Stub out a storage interface for later Supabase/client-portal integration (no live upload in phase 1).

## What I Need From You to Start Implementation

- CSV export of the comparison template file.
- Page ranges and column mappings for each carrier’s tabular data (Lafayette Life, MassMutual).

## Minimal Test Plan

- Upload 2–3 sample PDFs and 1 CSV; verify extracted tables match provided mappings.
- Verify derived metrics toggles update the table and chart.
- Export PDF and confirm it includes the comparison plus source illustrations.

