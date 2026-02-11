# Insurance Comparison Prototype

A standalone web application for comparing life insurance policy illustrations side-by-side. Upload carrier PDFs or CSV exports, view interactive comparisons, and export professional reports.

## Quick Start

1. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, or Safari)
2. Upload carrier illustration PDFs or a CSV template export
3. Compare up to 3 policy options simultaneously
4. Export comparison reports as PDF

## Features

### ✅ Phase 1 Complete

- **PDF Import**: Automated extraction from Lafayette Life and MassMutual illustration PDFs
- **CSV Import**: Bulk load all three comparison options from CSV template
- **3-Up Comparison Table**: Side-by-side policy comparison with editable cells
- **Interactive Chart**: Line graph with selectable metrics (cash value, death benefit, etc.)
- **Derived Metrics**:
  - Cash Value Increase (year-over-year growth)
  - Cash Value Efficiency (cash value / cumulative outlay)
  - Cash over Cash Return (increase / annual premium)
- **Cell-Level Overrides**: Edit any value with visual indicators and reset capability
- **PDF Export**: Generate comparison report with source illustrations appended
- **Local Save/Load**: Save and restore comparison sessions (localStorage)
- **Storage Interface**: Ready for Supabase integration (phase 2)

## How to Use

### Importing PDF Illustrations

1. **Select Carrier**: Choose Lafayette Life or MassMutual from the dropdown
2. **Choose Option Slot**: Select which comparison column (Option 1, 2, or 3) to populate
3. **Name the Policy**: Enter a client-facing name (e.g., "Don Johnson - LLIC New Option")
4. **Upload PDF**: Select the carrier illustration PDF file
5. **Parse**: Click "Parse PDF" to extract and normalize the data

**Advanced**: Expand "Advanced page ranges" to customize which pages contain table data for each carrier.

### Importing CSV Templates

1. **Upload CSV**: Select your comparison template CSV file
2. **Parse**: Click "Parse CSV" to load all three options at once

Expected CSV format: Three option groups side-by-side with columns:
- Yr (policy year)
- Age
- Annual Premium
- Cum Outlay (cumulative outlay)
- Non Guaranteed Cash Value
- Death Benefit

### Editing Values

- Click any value in the comparison table to edit
- Press Enter or click outside to save changes
- Overridden cells are highlighted in yellow
- Click "Reset Overrides" to restore original imported values

### Using Derived Metrics

Toggle checkboxes to show/hide:
- **Cash Value Increase**: Year-over-year cash value growth
- **Cash Value Efficiency**: Ratio of cash value to total premiums paid
- **Cash over Cash**: Return on premium (increase ÷ annual premium)

Chart updates automatically when toggling metrics.

### Exporting

**Save Comparison as PDF**: Generates a PDF containing:
1. The comparison table and chart
2. All uploaded source illustration PDFs (appended pages)

**Save Comparison**: Persist the current comparison to browser storage for later retrieval

**Load Saved Comparison**: Restore a previously saved comparison

## Supported Carriers

### Lafayette Life
- **Default Pages**: Tables on pages 11-14, Summary on page 16
- **Extracted Data**: Base premium, PUA premium, term rider, single premium PUA
- **Parsing**: Extracts year, age, annual premium, cash value, death benefit

### MassMutual
- **Default Pages**: Supplemental on page 13, Reduced Paid-Up on page 14, Summary on page 7
- **Extracted Data**: Base premium, initial death benefit
- **Parsing**: Handles both active premium years and paid-up projection years

## Technical Details

### Canonical Schema

Each policy option is normalized to this structure:
```javascript
{
  year: Number,           // Policy year (1-59)
  age: Number,            // Insured age
  annualPremium: Number,  // Premium paid this year
  cumulativeOutlay: Number, // Total premiums paid to date
  cashValue: Number,      // Non-guaranteed cash value
  deathBenefit: Number    // Total death benefit
}
```

### Storage Interface

The prototype includes an abstraction layer (`storage.js`) that currently uses localStorage but is designed for easy Supabase integration:

```javascript
// Current: LocalStorage (no server required)
await StorageInterface.saveComparison(comparison);

// Future: Swap to Supabase provider
StorageInterface.setProvider(new SupabaseProvider(url, key));
```

### Libraries Used

- **PDF.js**: PDF text extraction
- **Papa Parse**: CSV parsing
- **Chart.js**: Interactive line charts
- **html2pdf.js**: Comparison view to PDF conversion
- **pdf-lib**: PDF merging for bundled exports

## Roadmap

### Phase 2 (Future)
- Internal IRR calculation
- Supabase backend integration
- Multi-user support with authentication
- Client portal integration
- Advanced carrier support (Ohio National, Penn Mutual, etc.)
- Illustration version tracking
- Batch comparison (more than 3 options)

## File Structure

```
prototype/
├── index.html      # Main application interface
├── app.js          # Core logic, parsing, rendering
├── storage.js      # Storage abstraction layer
├── styles.css      # UI styling
└── README.md       # This file
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires modern browser with ES6+ JavaScript support.

## Notes

- PDF parsing is tailored to specific carrier layouts; results may vary with format changes
- All data processing happens client-side; no server uploads
- LocalStorage has size limits (~5-10MB); consider this for large PDF attachments
- Source PDFs are stored in memory during the session for export bundling
