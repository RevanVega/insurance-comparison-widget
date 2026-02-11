# Testing Checklist

## Basic Functionality Tests

### PDF Import
- [ ] Lafayette Life PDF uploads and parses correctly
- [ ] MassMutual PDF uploads and parses correctly
- [ ] Data appears in correct option column
- [ ] Summary values populate (death benefit, premiums)
- [ ] Custom page ranges work when modified

### CSV Import
- [ ] CSV file uploads successfully
- [ ] All three options populate from single CSV
- [ ] Column names and headers display correctly
- [ ] Numeric values format properly (commas, decimals)

### Comparison Table
- [ ] All three options display side-by-side
- [ ] Years align correctly across options
- [ ] Column headers show option names
- [ ] Table is scrollable horizontally if needed

### Editing & Overrides
- [ ] Click cell to edit value
- [ ] Change is saved on blur/Enter
- [ ] Edited cells turn yellow (override indicator)
- [ ] "Reset Overrides" clears all edits
- [ ] Overrides persist through toggle changes

### Derived Metrics
- [ ] Cash Value Increase toggle adds/removes column
- [ ] Cash Value Efficiency toggle adds/removes column
- [ ] Cash over Cash toggle adds/removes column
- [ ] Calculations appear correct
- [ ] Chart updates when toggling metrics

### Chart
- [ ] Chart displays on initial load (if data present)
- [ ] Three lines show for three options
- [ ] X-axis shows policy years
- [ ] Y-axis shows dollar values with commas
- [ ] Legend shows option names
- [ ] Lines have different colors

### PDF Export
- [ ] "Save Comparison as PDF" button works
- [ ] Generated PDF contains comparison table
- [ ] Generated PDF contains chart
- [ ] Source illustration PDFs are appended
- [ ] PDF downloads with timestamped filename

### Save/Load
- [ ] "Save Comparison" prompts for name
- [ ] Confirmation message shows after save
- [ ] "Load Saved Comparison" lists saved items
- [ ] Loading restores options, overrides, toggles
- [ ] Multiple saves can be managed

## Sample Data Tests

### Test with Provided Sample Files
1. **Lafayette Life**: `Don - LLIC New Option.pdf`
   - Expected: 59 years of data
   - Base premium, PUA premium extracted

2. **MassMutual Conversion**: `Don - MassMutual Conversion Optionmm.pdf`
   - Expected: Handles both active and paid-up years
   - Summary data extracted

3. **MassMutual New**: `Don - MM New Option.pdf`
   - Expected: Full projection data
   - Death benefit and cash value trends

4. **CSV Template**: `Don Johnson Comparison 01-2026.csv`
   - Expected: All three options load simultaneously
   - All columns map correctly

## Edge Cases

- [ ] Upload PDF with no carrier selected (should show error)
- [ ] Upload CSV with wrong format (graceful handling)
- [ ] Edit cell with invalid value (validation)
- [ ] Load comparison when none saved (helpful message)
- [ ] Export PDF with no options loaded (should still work)
- [ ] Very long policy names (UI doesn't break)

## Browser Testing

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS)

## Known Limitations

- Internal IRR is disabled (phase 2)
- PDF parsing assumes specific carrier formats
- LocalStorage has size limits (~5-10MB)
- No server-side storage in phase 1
- Limited to 3 simultaneous options

## Recommended Test Workflow

1. Open `index.html` in browser
2. Import CSV to load all three options at once
3. Toggle derived metrics on/off
4. Edit a few cells and verify override indicators
5. Save comparison with a name
6. Export as PDF and verify it opens correctly
7. Reset overrides and verify cells return to original values
8. Load saved comparison and verify all data restored
