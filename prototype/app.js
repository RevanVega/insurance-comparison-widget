console.log("App.js loading...");

// Test slider immediately
document.addEventListener("DOMContentLoaded", function() {
  const slider = document.getElementById("chartYearMax");
  const badge = document.getElementById("yearRangeDisplay");
  console.log("DOM loaded, slider:", slider, "badge:", badge);

  if (slider && badge) {
    slider.oninput = function() {
      console.log("SLIDER VALUE:", this.value);
      badge.textContent = "1-" + this.value;
    };
    console.log("Slider event attached!");
  }
});

const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const state = {
  options: [null, null, null],
  overrides: {},
  lastImportedOption: null,
  chart: null,
  pdfChart: null,
  sourcePdfs: {},
  debug: false,
  tableYearCap: null, // null = show all years, number = cap at this year
};

function debugLog(...args) {
  if (state.debug) {
    console.log('[DEBUG]', ...args);
  }
}

const carrierSelects = [
  document.getElementById("carrierSelect0"),
  document.getElementById("carrierSelect1"),
  document.getElementById("carrierSelect2"),
];
const reportNameInputs = [
  document.getElementById("reportName0"),
  document.getElementById("reportName1"),
  document.getElementById("reportName2"),
];
const pdfInputs = [
  document.getElementById("pdfInput0"),
  document.getElementById("pdfInput1"),
  document.getElementById("pdfInput2"),
];
const csvInput = document.getElementById("csvInput");

const lafayetteStart = document.getElementById("lafayetteStart");
const lafayetteEnd = document.getElementById("lafayetteEnd");
const lafayetteSummary = document.getElementById("lafayetteSummary");
const massSupplemental = document.getElementById("massSupplemental");
const massReduced = document.getElementById("massReduced");
const massSummary = document.getElementById("massSummary");

// Legacy summary elements (kept for compatibility)
const summaryDeathBenefit = document.getElementById("summaryDeathBenefit");
const summaryBasePremium = document.getElementById("summaryBasePremium");
const summaryPuaPremium = document.getElementById("summaryPuaPremium");
const summaryTermPremium = document.getElementById("summaryTermPremium");
const summarySpuaPremium = document.getElementById("summarySpuaPremium");

// New individual summary cards
const illustrationSummaryCards = [
  document.getElementById("illustrationSummary0"),
  document.getElementById("illustrationSummary1"),
  document.getElementById("illustrationSummary2"),
];

const comparisonTable = document.getElementById("comparisonTable");
const resetOverrides = document.getElementById("resetOverrides");
const matchYearsBtn = document.getElementById("matchYears");
const showAllYearsBtn = document.getElementById("showAllYears");
const exportPdf = document.getElementById("exportPdf");
const saveComparison = document.getElementById("saveComparison");
const loadComparison = document.getElementById("loadComparison");
const uploadStatus = document.getElementById("uploadStatus");

const toggleCashIncrease = document.getElementById("toggleCashIncrease");
const toggleEfficiency = document.getElementById("toggleEfficiency");
const toggleIrr = document.getElementById("toggleIrr");
const debugMode = document.getElementById("debugMode");
const chartMetricRadios = document.querySelectorAll('input[name="chartMetric"]');
const chartYearMax = document.getElementById("chartYearMax");
const yearRangeDisplay = document.getElementById("yearRangeDisplay");
const chartDisclaimer = document.getElementById("chartDisclaimer");
const disclaimerYears = document.getElementById("disclaimerYears");

console.log("Setting up event listeners...");
console.log("debugMode element:", debugMode);
console.log("chartYearMax element:", chartYearMax);

if (debugMode) {
  debugMode.addEventListener("change", () => {
    state.debug = debugMode.checked;
    if (state.debug) {
      console.log('%c🔍 Debug Mode Enabled', 'color: #1fc9e5; font-size: 16px; font-weight: bold;');
    }
  });
}

// Auto-fill report names when PDFs are selected
pdfInputs.forEach((input, index) => {
  input.addEventListener("change", () => {
    if (!reportNameInputs[index].value && input.files[0]) {
      reportNameInputs[index].value = input.files[0].name.replace(/\.pdf$/i, "");
    }
  });
});

// Setup parse buttons for each option
document.getElementById("parsePdf0").addEventListener("click", () => handlePdfParse(0));
document.getElementById("parsePdf1").addEventListener("click", () => handlePdfParse(1));
document.getElementById("parsePdf2").addEventListener("click", () => handlePdfParse(2));

// Setup clear buttons for each option
document.getElementById("clearPdf0").addEventListener("click", () => handleClearOption(0));
document.getElementById("clearPdf1").addEventListener("click", () => handleClearOption(1));
document.getElementById("clearPdf2").addEventListener("click", () => handleClearOption(2));

document.getElementById("parseCsv").addEventListener("click", handleCsvParse);
toggleCashIncrease.addEventListener("change", renderAll);
toggleEfficiency.addEventListener("change", renderAll);
toggleIrr.addEventListener("change", renderAll);

chartMetricRadios.forEach(radio => {
  radio.addEventListener("change", renderChart);
});

if (chartYearMax) {
  chartYearMax.addEventListener("input", function() {
    console.log("Slider moved to:", this.value);
    const maxYear = parseInt(this.value, 10);

    // Update display
    if (yearRangeDisplay) {
      yearRangeDisplay.textContent = `1-${maxYear}`;
    }
    if (disclaimerYears) {
      disclaimerYears.textContent = maxYear;
    }

    // Show/hide disclaimer based on whether all years are shown
    const allYears = new Set();
    state.options.forEach((option) => {
      option?.rows.forEach((row) => allYears.add(row.year));
    });
    const totalYears = allYears.size > 0 ? Math.max(...Array.from(allYears)) : 0;

    if (chartDisclaimer) {
      if (maxYear < totalYears) {
        chartDisclaimer.style.display = "block";
      } else {
        chartDisclaimer.style.display = "none";
      }
    }

    // Destroy and recreate chart to force full re-render with new scale
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    renderChart();
  });
} else {
  console.error("chartYearMax element not found!");
}
resetOverrides.addEventListener("click", () => {
  state.overrides = {};
  renderAll();
});

matchYearsBtn.addEventListener("click", () => {
  // Find the minimum max year across all loaded options
  const loadedOptions = state.options.filter(opt => opt !== null);
  if (loadedOptions.length < 2) {
    return; // Need at least 2 options to match
  }

  const maxYears = loadedOptions.map(opt => {
    const years = opt.rows.map(r => r.year);
    return Math.max(...years);
  });

  state.tableYearCap = Math.min(...maxYears);
  renderTable();
  renderChart();
});

showAllYearsBtn.addEventListener("click", () => {
  // Set cap to the maximum year across all options
  const loadedOptions = state.options.filter(opt => opt !== null);
  if (loadedOptions.length === 0) return;

  const maxYears = loadedOptions.map(opt => {
    const years = opt.rows.map(r => r.year);
    return Math.max(...years);
  });

  state.tableYearCap = Math.max(...maxYears);
  renderTable();
  renderChart();
});
exportPdf.addEventListener("click", exportComparisonPdf);
saveComparison.addEventListener("click", handleSaveComparison);
loadComparison.addEventListener("click", handleLoadComparison);

function setStatus(message) {
  uploadStatus.textContent = message;
}

function formatNumber(value, asPercentage = false, percentageDecimals = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return value;

  if (asPercentage) {
    return (number * 100).toLocaleString("en-US", {
      minimumFractionDigits: percentageDecimals,
      maximumFractionDigits: percentageDecimals,
    }) + "%";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[, ]/g, "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function getOverrideKey(optionIndex, year, field) {
  return `${optionIndex}:${year}:${field}`;
}

function getValueWithOverride(optionIndex, row, field) {
  const key = getOverrideKey(optionIndex, row.year, field);
  if (Object.prototype.hasOwnProperty.call(state.overrides, key)) {
    return state.overrides[key];
  }
  return row[field];
}

function setOverride(optionIndex, year, field, value) {
  const key = getOverrideKey(optionIndex, year, field);
  state.overrides[key] = value;
}

async function handlePdfParse(optionIndex) {
  console.log("handlePdfParse called for option:", optionIndex);
  const pdfInput = pdfInputs[optionIndex];
  const carrierSelect = carrierSelects[optionIndex];
  const reportNameInput = reportNameInputs[optionIndex];

  console.log("pdfInput:", pdfInput);
  console.log("pdfInput.files:", pdfInput?.files);
  console.log("carrierSelect:", carrierSelect);
  console.log("carrierSelect.value:", carrierSelect?.value);

  if (!pdfInput.files[0]) {
    updateOptionStatus(optionIndex, "Please select a PDF illustration.", "error");
    console.log("No file selected");
    return;
  }
  const carrier = carrierSelect.value;
  if (!carrier) {
    updateOptionStatus(optionIndex, "Select a carrier before parsing.", "error");
    console.log("No carrier selected");
    return;
  }
  const name = reportNameInput.value || pdfInput.files[0].name;
  console.log("Parsing PDF:", name, "Carrier:", carrier);
  updateOptionStatus(optionIndex, "Parsing PDF...", "loading");

  console.log("Loading PDF file...");
  const arrayBuffer = await pdfInput.files[0].arrayBuffer();
  console.log("ArrayBuffer size:", arrayBuffer.byteLength);

  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  console.log("PDF loaded, pages:", pdfDoc.numPages);

  // Store a copy of the ArrayBuffer to prevent detachment issues
  state.sourcePdfs[optionIndex] = arrayBuffer.slice(0);

  if (carrier === "lafayette") {
    console.log("Using Lafayette parser...");
    const rows = await parseLafayette(pdfDoc);
    const summary = await extractLafayetteSummary(pdfDoc, rows);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, `✓ ${name}`, "success");
  } else if (carrier === "massmutual") {
    console.log("Using MassMutual parser...");
    const rows = await parseMassMutual(pdfDoc);
    console.log("MassMutual rows parsed:", rows.length);
    const summary = await extractMassMutualSummary(pdfDoc, rows);
    console.log("MassMutual summary:", summary);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, `✓ ${name}`, "success");
  } else {
    console.log("Unknown carrier:", carrier);
    updateOptionStatus(optionIndex, "Unknown carrier", "error");
  }
}

function handleCsvParse() {
  if (!csvInput.files[0]) {
    setStatus("Please select a CSV file.");
    return;
  }
  setStatus("Parsing CSV...");
  Papa.parse(csvInput.files[0], {
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      const [headerRow, columnRow, ...dataRows] = results.data;
      if (!columnRow) {
        setStatus("CSV format not recognized.");
        return;
      }

      const groupIndices = [];
      columnRow.forEach((value, idx) => {
        if (String(value).trim().toLowerCase() === "yr") {
          groupIndices.push(idx);
        }
      });

      groupIndices.forEach((startIdx, groupIndex) => {
        const rows = dataRows.map((row) => {
          const year = parseNumber(row[startIdx]);
          const age = parseNumber(row[startIdx + 1]);
          const annualPremium = parseNumber(row[startIdx + 2]);
          const cumulativeOutlay = parseNumber(row[startIdx + 3]);
          const cashValue = parseNumber(row[startIdx + 4]);
          const deathBenefit = parseNumber(row[startIdx + 5]);
          if (!year) return null;
          return {
            year,
            age,
            annualPremium,
            cumulativeOutlay,
            cashValue,
            deathBenefit,
          };
        }).filter(Boolean);

        if (rows.length > 0 && groupIndex < 3) {
          setOption(
            groupIndex,
            headerRow[startIdx] || `Option ${groupIndex + 1}`,
            "csv",
            rows,
            {},
            csvInput.files[0].name
          );
        }
      });

      setStatus("CSV parsed.");
    },
  });
}

function setOption(index, name, carrier, rows, summary, filename) {
  const withCumulative = applyCumulativeOutlay(rows);
  state.options[index] = {
    name,
    carrier,
    rows: withCumulative,
    summary,
    source: { filename, type: carrier === "csv" ? "csv" : "pdf" },
  };
  state.lastImportedOption = index;
  updateSummary(summary);
  updateIllustrationSummary(index, state.options[index]);
  renderAll();
}

function updateOptionStatus(optionIndex, message, type = "info") {
  const statusSpan = document.getElementById(`status${optionIndex}`);
  statusSpan.textContent = message;
  statusSpan.className = "upload-status";
  if (type === "success") {
    statusSpan.classList.add("success");
  } else if (type === "error") {
    statusSpan.classList.add("error");
  } else if (type === "loading") {
    statusSpan.classList.add("loading");
  }
}

function handleClearOption(optionIndex) {
  // Clear state
  state.options[optionIndex] = null;
  delete state.sourcePdfs[optionIndex];

  // Clear overrides for this option
  Object.keys(state.overrides).forEach(key => {
    if (key.startsWith(`${optionIndex}:`)) {
      delete state.overrides[key];
    }
  });

  // Clear form inputs
  carrierSelects[optionIndex].value = "";
  reportNameInputs[optionIndex].value = "";
  pdfInputs[optionIndex].value = "";

  // Update status
  updateOptionStatus(optionIndex, "Empty", "info");

  // Clear the illustration summary card
  updateIllustrationSummary(optionIndex, null);

  // Clear legacy summary if this was the last imported option
  if (state.lastImportedOption === optionIndex) {
    updateSummary({});
  }

  // Re-render
  renderAll();
}

function applyCumulativeOutlay(rows) {
  let runningTotal = 0;
  return rows.map((row) => {
    const annualPremium = row.annualPremium ?? 0;
    runningTotal += annualPremium;
    return {
      ...row,
      cumulativeOutlay: row.cumulativeOutlay ?? runningTotal,
    };
  });
}

function updateSummary(summary) {
  // Legacy function - kept for compatibility
  if (summaryDeathBenefit) summaryDeathBenefit.textContent = formatNumber(summary.initialDeathBenefit);
  if (summaryBasePremium) summaryBasePremium.textContent = formatNumber(summary.baseAnnualPremium);
  if (summaryPuaPremium) summaryPuaPremium.textContent = formatNumber(summary.puaPremium);
  if (summaryTermPremium) summaryTermPremium.textContent = formatNumber(summary.termPremium);
  if (summarySpuaPremium) summarySpuaPremium.textContent = formatNumber(summary.spuaPremium);
}

function updateIllustrationSummary(optionIndex, option) {
  const card = illustrationSummaryCards[optionIndex];
  if (!card) return;

  const emptyContent = card.querySelector(".summary-content.empty");
  const loadedContent = card.querySelector(".summary-content.loaded");
  const titleEl = card.querySelector("h3");

  if (!option) {
    // Hide the entire card if not loaded
    card.style.display = "none";
    return;
  }

  // Show the card and loaded state
  card.style.display = "block";
  emptyContent.style.display = "none";
  loadedContent.style.display = "block";

  // Update title with option name
  titleEl.textContent = option.name || `Illustration ${optionIndex + 1} Summary`;

  const summary = option.summary || {};
  const isMassMutual = summary.carrier === "massmutual" || option.carrier === "massmutual";

  // Update labels based on carrier
  const setLabel = (field, label) => {
    const row = loadedContent.querySelector(`[data-field="${field}"]`)?.closest(".summary-row");
    if (row) {
      const labelEl = row.querySelector(".label");
      if (labelEl) labelEl.innerHTML = label;
    }
  };

  if (isMassMutual) {
    setLabel("puaPremium", "PUA Premium (ALIR)");
    setLabel("spuaPremium", "Single PUA (ALIR Unscheduled)");
    setLabel("termPremium", "Term Rider (LISR)*");
  } else {
    // Lafayette / default labels
    setLabel("puaPremium", "PUA Premium");
    setLabel("spuaPremium", "Single Lump Sum PUA");
    setLabel("termPremium", "Term Rider Premium");
  }

  // Update values and make them editable
  const setValue = (field, value, summaryKey) => {
    const el = loadedContent.querySelector(`[data-field="${field}"]`);
    if (el) {
      el.textContent = formatNumber(value);
      el.contentEditable = "true";
      el.dataset.optionIndex = optionIndex;
      el.dataset.summaryKey = summaryKey;
      el.classList.add("editable-summary");

      // Remove old listener and add new one
      el.onblur = function() {
        const newValue = parseNumber(this.textContent);
        if (newValue !== null && state.options[optionIndex]) {
          state.options[optionIndex].summary[summaryKey] = newValue;
          // Recalculate total
          updateIllustrationSummary(optionIndex, state.options[optionIndex]);
        }
      };
    }
  };

  setValue("deathBenefit", summary.initialDeathBenefit, "initialDeathBenefit");
  setValue("basePremium", summary.baseAnnualPremium, "baseAnnualPremium");
  setValue("puaPremium", summary.puaPremium, "puaPremium");
  setValue("termPremium", summary.termPremium, "termPremium");
  setValue("spuaPremium", summary.spuaPremium, "spuaPremium");

  // Calculate and display total (not editable)
  const totalFirstYearOutlay =
    (summary.baseAnnualPremium || 0) +
    (summary.puaPremium || 0) +
    (summary.termPremium || 0) +
    (summary.spuaPremium || 0);

  const totalEl = loadedContent.querySelector(`[data-field="totalPremium"]`);
  if (totalEl) {
    totalEl.textContent = formatNumber(totalFirstYearOutlay || option.rows?.[0]?.annualPremium);
    totalEl.contentEditable = "false"; // Total is calculated, not editable
  }

  // Add/remove LISR footnote for MassMutual
  let footnote = card.querySelector(".lisr-footnote");
  if (isMassMutual && summary.termPremium) {
    if (!footnote) {
      footnote = document.createElement("p");
      footnote.className = "lisr-footnote";
      footnote.innerHTML = "<small>*LISR is a term blend rider with a reducing ART. This does not represent the minimum cost, as a portion of this premium builds cash value similar to the PUA/ALIR.</small>";
      loadedContent.appendChild(footnote);
    }
  } else if (footnote) {
    footnote.remove();
  }
}

async function extractLinesFromPage(pdfDoc, pageNumber) {
  debugLog(`Extracting page ${pageNumber}...`);
  const page = await pdfDoc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.map((item) => ({
    text: item.str.trim(),
    x: item.transform[4],
    y: item.transform[5],
  }));

  debugLog(`Page ${pageNumber}: Found ${items.length} text items`);

  const rows = {};
  items.forEach((item) => {
    if (!item.text) return;
    const key = Math.round(item.y);
    rows[key] = rows[key] || [];
    rows[key].push(item);
  });

  const lines = Object.keys(rows)
    .sort((a, b) => Number(b) - Number(a))
    .map((key) => {
      const lineItems = rows[key].sort((a, b) => a.x - b.x);
      return lineItems.map((item) => item.text).join(" ");
    });

  debugLog(`Page ${pageNumber}: Formed ${lines.length} lines`);
  if (state.debug) {
    console.log(`%c📄 Page ${pageNumber} Lines:`, 'color: #1fc9e5; font-weight: bold;');
    lines.forEach((line, i) => console.log(`  ${i + 1}: ${line}`));
  }

  return lines;
}

function parseNumberTokens(line) {
  return line
    .split(/\s+/)
    .map((token) => token.replace(/[^0-9,.-]/g, ""))
    .filter((token) => token && /[0-9]/.test(token));
}

async function parseLafayette(pdfDoc) {
  debugLog('Starting Lafayette Life parsing...');
  const startPage = parseNumber(lafayetteStart.value) || 11;
  const endPage = parseNumber(lafayetteEnd.value) || 14;
  debugLog(`Lafayette pages: ${startPage} to ${endPage}`);

  const tablePages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    tablePages.push(page);
  }
  const rows = [];
  for (const pageNumber of tablePages) {
    const lines = await extractLinesFromPage(pdfDoc, pageNumber);
    debugLog(`Processing ${lines.length} lines from page ${pageNumber}`);

    lines.forEach((line, lineIndex) => {
      // Lafayette lines start with Age (2 digits) followed by Year
      if (!/^\d{2}\s+\d/.test(line)) {
        debugLog(`  Line ${lineIndex + 1}: Skipped (doesn't match age+year pattern)`);
        return;
      }

      debugLog(`\n  📋 Line ${lineIndex + 1} RAW TEXT: "${line}"`);
      const tokens = parseNumberTokens(line);
      debugLog(`  Found ${tokens.length} tokens:`, tokens);

      if (tokens.length < 11) {
        debugLog(`    ❌ Skipped: Not enough tokens (need 11+, found ${tokens.length})`);
        return;
      }

      // CORRECT extraction logic based on Lafayette Life table structure
      const ageIndex = 0;              // Column 1: Age
      const yearIndex = 1;             // Column 2: Year
      const annualPremiumIndex = 2;   // Column 3: Contract Premium
      const cashValueIndex = 9;        // Column 10: Non-Guaranteed Cash Value
      const deathBenefitIndex = 10;   // Column 11: Death Benefit

      const year = parseNumber(tokens[yearIndex]);
      const age = parseNumber(tokens[ageIndex]);
      const annualPremium = parseNumber(tokens[annualPremiumIndex]);
      const deathBenefit = parseNumber(tokens[deathBenefitIndex]);
      const cashValue = parseNumber(tokens[cashValueIndex]);

      debugLog(`  📊 COLUMN MAPPING:`);
      debugLog(`     tokens[${ageIndex}] = "${tokens[ageIndex]}" → age = ${age}`);
      debugLog(`     tokens[${yearIndex}] = "${tokens[yearIndex]}" → year = ${year}`);
      debugLog(`     tokens[${annualPremiumIndex}] = "${tokens[annualPremiumIndex]}" → annualPremium = ${annualPremium}`);
      debugLog(`     tokens[${cashValueIndex}] = "${tokens[cashValueIndex]}" → cashValue = ${cashValue}`);
      debugLog(`     tokens[${deathBenefitIndex}] = "${tokens[deathBenefitIndex]}" → deathBenefit = ${deathBenefit}`);

      // Validation: skip invalid rows (summary lines, etc.)
      if (!year || !age) {
        debugLog(`    ❌ Skipped: Missing year or age`);
        return;
      }
      if (year < 1 || year > 100) {
        debugLog(`    ❌ Skipped: Invalid year ${year} (must be 1-100)`);
        return;
      }
      if (age < 18 || age > 120) {
        debugLog(`    ❌ Skipped: Invalid age ${age} (must be 18-120)`);
        return;
      }

      const row = { year, age, annualPremium, cashValue, deathBenefit };
      debugLog(`    ✅ FINAL ROW:`, row);
      debugLog(`\n`);
      rows.push(row);
    });
  }

  debugLog(`Lafayette parsing complete: ${rows.length} rows extracted`);
  console.table(rows);
  return rows.sort((a, b) => a.year - b.year);
}

async function extractLafayetteSummary(pdfDoc, rows) {
  const summaryPage = parseNumber(lafayetteSummary.value) || 16;
  const lines = await extractLinesFromPage(pdfDoc, summaryPage);
  const fullText = lines.join(" ");
  const summary = {
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,
    termPremium: null,
    spuaPremium: null,
  };

  summary.baseAnnualPremium = parseNumber(
    (fullText.match(/Base Policy.*?\$([0-9,]+\.\d{2})/) || [])[1]
  );
  summary.puaPremium = parseNumber(
    (fullText.match(/Level Premium PUA Rider.*?\$([0-9,]+\.\d{2})/) || [])[1]
  );
  summary.termPremium = parseNumber(
    (fullText.match(/10 Year Term Rider.*?\$([0-9,]+\.\d{2})/) || [])[1]
  );
  summary.spuaPremium = parseNumber(
    (fullText.match(/Single Premium PUA Rider.*?\$([0-9,]+\.\d{2})/) || [])[1]
  );
  return summary;
}

async function parseMassMutual(pdfDoc) {
  console.log('Starting MassMutual parsing...');
  console.log(`PDF has ${pdfDoc.numPages} pages`);
  const rows = [];

  // Parse page 19 (Supplemental Values - active premium years)
  // Column mapping based on user input:
  // [0]=Year, [1]=Age, [2]=Annual Premium, [7]=Cash Value, [10]=Death Benefit
  console.log('Parsing page 19 (active premium years)...');
  const page19Data = await extractLinesFromPage(pdfDoc, 19);
  page19Data.forEach((line, lineIndex) => {
    if (!/^\d+\s+\d+/.test(line)) return;
    const tokens = parseNumberTokens(line);
    if (tokens.length < 11) return;

    const year = parseNumber(tokens[0]);
    const age = parseNumber(tokens[1]);
    const annualPremium = parseNumber(tokens[2]);
    const cashValue = parseNumber(tokens[7]);
    const deathBenefit = parseNumber(tokens[10]);

    if (!year || !age || year > 100) return;

    const row = { year, age, annualPremium, cashValue, deathBenefit };
    console.log(`  Year ${year}: Premium=${annualPremium}, CV=${cashValue}, DB=${deathBenefit}`);
    rows.push(row);
  });

  // Parse page 20 (Reduced Paid-Up - continuation with $0 premiums)
  // Column mapping: [0]=Year, [1]=Age, Premium=0, [6]=Cash Value, [7]=Death Benefit
  console.log('Parsing page 20 (reduced paid-up years)...');
  const page20Data = await extractLinesFromPage(pdfDoc, 20);
  page20Data.forEach((line, lineIndex) => {
    if (!/^\d+\s+\d+/.test(line)) return;
    const tokens = parseNumberTokens(line);
    if (tokens.length < 8) return;

    const year = parseNumber(tokens[0]);
    const age = parseNumber(tokens[1]);
    // Use last two columns for cash value and death benefit
    const cashValue = parseNumber(tokens[tokens.length - 2]);
    const deathBenefit = parseNumber(tokens[tokens.length - 1]);

    if (!year || !age || year > 100) return;
    // Skip if we already have this year from page 19
    if (rows.some(r => r.year === year)) return;

    const row = { year, age, annualPremium: 0, cashValue, deathBenefit };
    console.log(`  Year ${year}: Premium=0, CV=${cashValue}, DB=${deathBenefit}`);
    rows.push(row);
  });

  debugLog(`MassMutual parsing complete: ${rows.length} rows extracted`);
  console.table(rows);
  return rows.sort((a, b) => a.year - b.year);
}

async function extractMassMutualSummary(pdfDoc, rows) {
  console.log("Extracting MassMutual summary from page 8...");
  const page8Lines = await extractLinesFromPage(pdfDoc, 8);
  const fullText = page8Lines.join(" ");

  const summary = {
    carrier: "massmutual",
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,        // ALIR Scheduled
    spuaPremium: null,       // ALIR Unscheduled (lump sum)
    termPremium: null,       // LISR
  };

  // Base Premium $12,080.00
  summary.baseAnnualPremium = parseNumber(
    (fullText.match(/Base Premium\s*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // ALIR Scheduled Purchase Payment $16,914.00 (this is their PUA)
  summary.puaPremium = parseNumber(
    (fullText.match(/ALIR[^$]*Scheduled[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // ALIR Unscheduled First Year Lump Sum $86,000.00 (single PUA)
  summary.spuaPremium = parseNumber(
    (fullText.match(/ALIR[^$]*Unscheduled[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // LISR Premium First Year $10,006.37 (term blend rider)
  summary.termPremium = parseNumber(
    (fullText.match(/LISR Premium[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // Initial Death Benefit from first row
  summary.initialDeathBenefit = rows?.[0]?.deathBenefit ?? null;

  console.log("MassMutual summary extracted:", summary);
  return summary;
}

function renderAll() {
  updateYearSlider();
  autoMatchYears(); // Auto-cap to shortest option by default
  renderTable();
  renderChart();
}

function autoMatchYears() {
  const loadedOptions = state.options.filter(opt => opt !== null);
  if (loadedOptions.length < 2) {
    // Only one or no options, no need to cap
    if (loadedOptions.length === 1) {
      const years = loadedOptions[0].rows.map(r => r.year);
      state.tableYearCap = Math.max(...years);
    }
    return;
  }

  // Find the minimum max year across all loaded options
  const maxYears = loadedOptions.map(opt => {
    const years = opt.rows.map(r => r.year);
    return Math.max(...years);
  });

  state.tableYearCap = Math.min(...maxYears);
}

function updateYearSlider() {
  if (!chartYearMax || !yearRangeDisplay) {
    console.error("Year slider elements not found");
    return;
  }

  // Calculate max years from imported data
  const allYears = new Set();
  state.options.forEach((option) => {
    option?.rows.forEach((row) => allYears.add(row.year));
  });

  if (allYears.size === 0) {
    // No data loaded, use defaults
    return;
  }

  const maxDataYear = Math.max(...Array.from(allYears));
  console.log("Max data year:", maxDataYear);

  chartYearMax.max = maxDataYear;
  chartYearMax.value = maxDataYear;

  yearRangeDisplay.textContent = `1-${maxDataYear}`;
  if (disclaimerYears) {
    disclaimerYears.textContent = maxDataYear;
  }
}

function renderTable() {
  const allYears = new Set();
  state.options.forEach((option) => {
    option?.rows.forEach((row) => allYears.add(row.year));
  });
  let years = Array.from(allYears).sort((a, b) => a - b);

  // Apply year cap if set
  if (state.tableYearCap !== null) {
    years = years.filter(year => year <= state.tableYearCap);
  }

  // Get only loaded options with their original indices
  const loadedOptions = state.options
    .map((option, idx) => ({ option, idx }))
    .filter(({ option }) => option !== null);

  if (loadedOptions.length === 0) {
    comparisonTable.innerHTML = "<p style='color: #9ca3af; text-align: center;'>Upload and parse illustrations to see comparison table.</p>";
    return;
  }

  const metrics = [
    { key: "age", label: "Age" },
    { key: "annualPremium", label: "Annual Premium" },
    { key: "cumulativeOutlay", label: "Cumulative Outlay" },
    { key: "cashValue", label: "Cash Value" },
    { key: "deathBenefit", label: "Death Benefit" },
  ];

  const optionalMetrics = [];
  if (toggleCashIncrease.checked) {
    optionalMetrics.push({ key: "cashValueIncrease", label: "Cash Value Increase" });
  }
  if (toggleEfficiency.checked) {
    optionalMetrics.push({ key: "cashValueEfficiency", label: "Cash Value Efficiency" });
  }
  if (toggleIrr.checked) {
    optionalMetrics.push({ key: "irr", label: "IRR" });
  }

  const totalMetrics = metrics.concat(optionalMetrics);

  // Option color classes
  const optionColors = ["option-color-1", "option-color-2", "option-color-3"];

  // Header row 1: Option names with proper colspan (only loaded options)
  let html = "<table><thead><tr><th class=\"year-header\"></th>";
  loadedOptions.forEach(({ option, idx }) => {
    const name = option.name || `Option ${idx + 1}`;
    html += `<th colspan="${totalMetrics.length}" class="option-header ${optionColors[idx]}">${name}</th>`;
  });
  html += "</tr>";

  // Header row 2: Year + metric labels for each loaded option
  html += "<tr><th class=\"year-header\">Year</th>";
  loadedOptions.forEach(({ idx }) => {
    totalMetrics.forEach((metric) => {
      html += `<th class="${optionColors[idx]}">${metric.label}</th>`;
    });
  });
  html += "</tr></thead><tbody>";

  years.forEach((year) => {
    html += `<tr><td class="year-cell">${year}</td>`;
    loadedOptions.forEach(({ option, idx: optionIndex }) => {
      const row = option.rows.find((r) => r.year === year);
      const previousRow = option.rows.find((r) => r.year === year - 1);
      totalMetrics.forEach((metric) => {
        const value = getMetricValue(optionIndex, row, previousRow, metric.key);
        const overrideKey = row
          ? getOverrideKey(optionIndex, row.year, metric.key)
          : null;
        const isOverride =
          overrideKey && Object.prototype.hasOwnProperty.call(state.overrides, overrideKey);
        const baseClass = optionColors[optionIndex];
        const editableClass = isOverride ? "editable override" : "editable";

        // Format as percentage for efficiency metrics
        const isPercentage = metric.key === "cashValueEfficiency" || metric.key === "irr";
        const decimals = metric.key === "irr" ? 2 : 0;  // IRR shows 2 decimals

        if (
          row &&
          metric.key !== "cashValueIncrease" &&
          metric.key !== "cashValueEfficiency" &&
          metric.key !== "irr" &&
          metric.key !== "age"  // Age should not be editable
        ) {
          html += `<td contenteditable="true" data-option="${optionIndex}" data-year="${row.year}" data-field="${metric.key}" class="${baseClass} ${editableClass}">${formatNumber(value, isPercentage, decimals)}</td>`;
        } else {
          html += `<td class="${baseClass}">${formatNumber(value, isPercentage, decimals)}</td>`;
        }
      });
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  comparisonTable.innerHTML = html;

  comparisonTable.querySelectorAll("[contenteditable]").forEach((cell) => {
    cell.addEventListener("blur", (event) => {
      const target = event.target;
      const optionIndex = Number(target.dataset.option);
      const year = Number(target.dataset.year);
      const field = target.dataset.field;
      const value = parseNumber(target.textContent);
      if (value !== null) {
        setOverride(optionIndex, year, field, value);
      }
      renderAll();
    });
  });
}

function getMetricValue(optionIndex, row, previousRow, key) {
  if (!row) return null;
  const age = getValueWithOverride(optionIndex, row, "age");
  const annualPremium = getValueWithOverride(optionIndex, row, "annualPremium");
  const cumulativeOutlay = getValueWithOverride(optionIndex, row, "cumulativeOutlay");
  const cashValue = getValueWithOverride(optionIndex, row, "cashValue");
  const deathBenefit = getValueWithOverride(optionIndex, row, "deathBenefit");

  if (key === "age") return age;
  if (key === "annualPremium") return annualPremium;
  if (key === "cumulativeOutlay") return cumulativeOutlay;
  if (key === "cashValue") return cashValue;
  if (key === "deathBenefit") return deathBenefit;
  if (key === "cashValueIncrease") {
    const prevValue = previousRow
      ? getValueWithOverride(optionIndex, previousRow, "cashValue")
      : 0;
    return cashValue !== null ? cashValue - prevValue : null;
  }
  if (key === "cashValueEfficiency") {
    if (!cumulativeOutlay) return null;
    return cashValue / cumulativeOutlay;
  }
  if (key === "irr") {
    // Calculate IRR: the rate of return if policy is surrendered at this year
    return calculateIRR(optionIndex, row);
  }
  return null;
}

// IRR Calculation using Newton-Raphson method
function calculateIRR(optionIndex, currentRow) {
  if (!currentRow || !state.options[optionIndex]) return null;

  const option = state.options[optionIndex];
  const years = option.rows.filter(r => r.year <= currentRow.year);

  // Build cash flows: negative for premiums, positive for ending cash value
  const cashFlows = years.map((row, index) => {
    const premium = getValueWithOverride(optionIndex, row, "annualPremium") || 0;
    const cashValue = getValueWithOverride(optionIndex, row, "cashValue") || 0;

    // Last year: return cash value (surrender)
    if (index === years.length - 1) {
      return cashValue - premium;
    }
    // Other years: just the premium outflow
    return -premium;
  });

  // Newton-Raphson iteration to find IRR
  let irr = 0.05; // Initial guess: 5%
  const maxIterations = 100;
  const tolerance = 0.0001;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;

    cashFlows.forEach((cf, t) => {
      npv += cf / Math.pow(1 + irr, t);
      derivative -= t * cf / Math.pow(1 + irr, t + 1);
    });

    if (Math.abs(npv) < tolerance) {
      return irr; // Found it!
    }

    if (derivative === 0) return null; // Can't continue

    irr = irr - npv / derivative;

    // Prevent extreme values
    if (irr < -0.99) irr = -0.99;
    if (irr > 10) irr = 10;
  }

  return irr; // Return best guess after max iterations
}

function renderChart() {
  // Get selected metric from radio buttons
  const selectedMetric = document.querySelector('input[name="chartMetric"]:checked')?.value || "cashValue";
  const maxYear = parseInt(chartYearMax.value, 10) || 50;

  const labels = [];
  state.options.forEach((option) => {
    option?.rows.forEach((row) => labels.push(row.year));
  });
  const allLabels = Array.from(new Set(labels)).sort((a, b) => a - b);

  // Filter labels by max year
  const uniqueLabels = allLabels.filter(year => year <= maxYear);

  // Update disclaimer visibility
  if (allLabels.length > 0 && maxYear < Math.max(...allLabels)) {
    chartDisclaimer.style.display = "block";
  } else {
    chartDisclaimer.style.display = "none";
  }

  const colors = ["#1fc9e5", "#24ce62", "#35f1ce"];
  const datasets = state.options
    .map((option, index) => {
      if (!option) return null;
      const data = uniqueLabels.map((year) => {
        const row = option.rows.find((r) => r.year === year);
        return row ? getValueWithOverride(index, row, selectedMetric) : null;
      });
      return {
        label: option.name || `Option ${index + 1}`,
        data,
        borderColor: colors[index],
        backgroundColor: "transparent",
        spanGaps: true,
        tension: 0.1,
      };
    })
    .filter(Boolean);

  const chartEl = document.getElementById("comparisonChart");
  if (state.chart) {
    state.chart.data.labels = uniqueLabels;
    state.chart.data.datasets = datasets;
    state.chart.update('none'); // Update without animation for immediate effect
    return;
  }

  state.chart = new Chart(chartEl, {
    type: "line",
    data: {
      labels: uniqueLabels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          ticks: {
            callback: (value) => Number(value).toLocaleString("en-US"),
          },
        },
      },
    },
  });
}

async function exportComparisonPdf() {
  setStatus("Generating comparison PDF...");

  // Prepare PDF export container
  const container = document.getElementById("pdfExportContainer");
  container.style.left = "0";
  container.style.position = "fixed";
  container.style.zIndex = "9999";

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Set dates
  container.querySelector(".pdf-date").textContent = dateStr;
  const disclaimerDate = container.querySelector(".disclaimer-date");
  if (disclaimerDate) {
    disclaimerDate.textContent = dateStr;
  }

  // Populate summaries for each option
  console.log("Populating summaries...");
  populatePdfSummaries();

  // Render chart for PDF
  console.log("Rendering chart...");
  try {
    await renderPdfChart();
  } catch (chartError) {
    console.error("Chart render error:", chartError);
  }

  // Render table for PDF
  console.log("Rendering table...");
  renderPdfTable();

  // Give browser time to render
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Get the continuous content element
  const pdfContent = container.querySelector(".pdf-content");
  console.log("PDF content element:", pdfContent);

  const opt = {
    margin: [0.4, 0.3, 0.5, 0.3], // top, left, bottom, right
    filename: `comparison-${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "in", format: "letter", orientation: "landscape" },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    // Generate entire document as one continuous PDF
    console.log("Generating PDF...");
    const pdfBlob = await html2pdf().set(opt).from(pdfContent).output("blob");
    console.log("PDF done, size:", pdfBlob.size);

    // Load into pdf-lib to add page numbers and branding
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.load(await pdfBlob.arrayBuffer());
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Add page numbers and branding to each page
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const pageNum = index + 1;

      // Add page number on right
      page.drawText(`Page ${pageNum} of ${totalPages}`, {
        x: width - 100,
        y: 15,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Add branding on left
      page.drawText('Insurance Policy Comparison Tool', {
        x: 22,
        y: 15,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    const mergedPdf = pdfDoc;

    // Append source PDFs if available
    const sourcePdfCount = Object.keys(state.sourcePdfs).length;
    for (let i = 0; i < 3; i++) {
      if (state.sourcePdfs[i]) {
        try {
          // Use slice(0) to create a copy of the ArrayBuffer
          // Use ignoreEncryption for carrier PDFs that are copy-protected
          const sourcePdf = await PDFDocument.load(state.sourcePdfs[i].slice(0), {
            ignoreEncryption: true,
          });
          const sourcePages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          sourcePages.forEach((page) => mergedPdf.addPage(page));
        } catch (sourceError) {
          console.warn(`Could not attach source PDF ${i}:`, sourceError);
        }
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opt.filename;
    a.click();
    URL.revokeObjectURL(url);

    if (sourcePdfCount > 0) {
      setStatus(`PDF saved with ${sourcePdfCount} source illustration(s) attached.`);
    } else {
      setStatus("Comparison PDF saved.");
    }
  } catch (error) {
    console.error("PDF export error:", error);
    setStatus("Error: " + error.message);
    alert("PDF Error: " + error.message + "\n\nCheck console for details.");
  } finally {
    // Hide container again
    container.style.left = "-9999px";
    container.style.position = "absolute";
    container.style.zIndex = "";
  }
}

function populatePdfSummaries() {
  state.options.forEach((option, index) => {
    const card = document.getElementById(`pdfSummary${index}`);
    if (!card) return;

    const nameEl = card.querySelector(".pdf-option-name");
    const values = card.querySelectorAll(".value");

    if (!option) {
      // Hide empty options completely
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");
    nameEl.textContent = option.name || `Option ${index + 1}`;

    const summary = option.summary || {};
    const totalFirstYearOutlay =
      (summary.baseAnnualPremium || 0) +
      (summary.puaPremium || 0) +
      (summary.termPremium || 0) +
      (summary.spuaPremium || 0);

    values[0].textContent = formatNumber(summary.initialDeathBenefit);
    values[1].textContent = formatNumber(summary.baseAnnualPremium);
    values[2].textContent = formatNumber(summary.puaPremium);
    values[3].textContent = formatNumber(summary.termPremium);
    values[4].textContent = formatNumber(totalFirstYearOutlay || option.rows?.[0]?.annualPremium);
  });
}

async function renderPdfChart() {
  console.log("Rendering PDF chart...");
  const canvas = document.getElementById("pdfChart");
  if (!canvas) {
    console.error("PDF chart canvas not found!");
    return;
  }
  const ctx = canvas.getContext("2d");

  // Destroy existing chart if any
  if (state.pdfChart) {
    state.pdfChart.destroy();
    state.pdfChart = null;
  }

  // Use the same year filter as the main chart
  const maxYear = parseInt(chartYearMax.value, 10) || 50;

  const labels = [];
  state.options.forEach((option) => {
    option?.rows.forEach((row) => labels.push(row.year));
  });
  const allLabels = Array.from(new Set(labels)).sort((a, b) => a - b);
  const uniqueLabels = allLabels.filter(year => year <= maxYear);

  // Update PDF chart disclaimer
  const pdfChartDisclaimer = document.getElementById("pdfChartDisclaimer");
  if (pdfChartDisclaimer) {
    if (allLabels.length > 0 && maxYear < Math.max(...allLabels)) {
      pdfChartDisclaimer.textContent = `Chart displays years 1 through ${maxYear} only. See detailed projections table for complete data.`;
      pdfChartDisclaimer.style.display = "block";
    } else {
      pdfChartDisclaimer.style.display = "none";
    }
  }

  const datasets = state.options
    .map((option, index) => {
      if (!option) return null;
      const data = uniqueLabels.map((year) => {
        const row = option.rows.find((r) => r.year === year);
        return row ? getValueWithOverride(index, row, "cashValue") : null;
      });
      return {
        label: option.name || `Option ${index + 1}`,
        data,
        borderColor: ["#1fc9e5", "#24ce62", "#35f1ce"][index],
        backgroundColor: "transparent",
        spanGaps: true,
        tension: 0.1,
        borderWidth: 2,
      };
    })
    .filter(Boolean);

  state.pdfChart = new Chart(ctx, {
    type: "line",
    data: { labels: uniqueLabels, datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } },
      },
      scales: {
        x: {
          ticks: {
            callback: function (value, index) {
              const year = this.getLabelForValue(value);
              if (year <= 10 || year % 5 === 0) return year;
              return "";
            },
            font: { size: 9 },
          },
        },
        y: {
          ticks: {
            callback: (value) => "$" + Number(value).toLocaleString("en-US"),
            font: { size: 9 },
          },
        },
      },
    },
  });

  // Wait for chart to render
  await new Promise((resolve) => setTimeout(resolve, 100));
}

function renderPdfTable() {
  const container = document.getElementById("pdfTableContainer");

  // Collect all years and map to ages
  const allYears = new Set();
  state.options.forEach((option) => {
    option?.rows.forEach((row) => allYears.add(row.year));
  });
  const years = Array.from(allYears).sort((a, b) => a - b);

  // Build columns list based on toggles
  const columns = [
    { key: "annualPremium", label: "Premium", show: true },
    { key: "cashValue", label: "Cash Value", show: true },
    { key: "deathBenefit", label: "Death Benefit", show: true },
    { key: "cashValueIncrease", label: "CV Increase", show: toggleCashIncrease.checked },
    { key: "cashValueEfficiency", label: "CV Efficiency", show: toggleEfficiency.checked },
    { key: "irr", label: "IRR", show: toggleIrr.checked },
  ].filter(col => col.show);

  const optionColors = ["option-color-1", "option-color-2", "option-color-3"];
  const activeOptionCount = state.options.filter(opt => opt !== null).length;

  let html = "<table><thead>";
  html += "<tr><th class=\"year-header\"></th>";
  state.options.forEach((option, idx) => {
    if (!option) return;
    const name = option.name || `Option ${idx + 1}`;
    html += `<th colspan="${columns.length}" class="${optionColors[idx]}">${name}</th>`;
  });
  html += "</tr>";
  html += "<tr><th class=\"year-header\">Age</th>";
  state.options.forEach((option, idx) => {
    if (!option) return;
    columns.forEach(col => {
      html += `<th class="${optionColors[idx]}">${col.label}</th>`;
    });
  });
  html += "</tr></thead><tbody>";

  years.forEach((year) => {
    // Get age from the first loaded option that has this year
    let age = year;
    for (const option of state.options) {
      if (option) {
        const row = option.rows.find((r) => r.year === year);
        if (row && row.age) {
          age = row.age;
          break;
        }
      }
    }

    html += `<tr class="pdf-table-row" data-html2pdf-page-break-avoid><td class="year-cell">${age}</td>`;
    state.options.forEach((option, optionIndex) => {
      if (!option) return;
      const row = option.rows.find((r) => r.year === year);
      const previousRow = option.rows.find((r) => r.year === year - 1);

      columns.forEach(col => {
        let value = null;
        let isPercentage = false;
        let decimals = 0;

        if (row) {
          if (col.key === "cashValueIncrease") {
            const currentCV = getValueWithOverride(optionIndex, row, "cashValue");
            const prevCV = previousRow ? getValueWithOverride(optionIndex, previousRow, "cashValue") : 0;
            value = currentCV !== null ? currentCV - prevCV : null;
          } else if (col.key === "cashValueEfficiency") {
            const cv = getValueWithOverride(optionIndex, row, "cashValue");
            const outlay = getValueWithOverride(optionIndex, row, "cumulativeOutlay");
            value = outlay ? cv / outlay : null;
            isPercentage = true;
          } else if (col.key === "irr") {
            value = calculateIRR(optionIndex, row);
            isPercentage = true;
            decimals = 2;
          } else {
            value = getValueWithOverride(optionIndex, row, col.key);
          }
        }

        html += `<td class="${optionColors[optionIndex]}">${formatNumber(value, isPercentage, decimals)}</td>`;
      });
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  container.innerHTML = html;
}

async function handleSaveComparison() {
  const name = prompt("Enter a name for this comparison:", `Comparison ${new Date().toLocaleDateString()}`);
  if (!name) return;

  try {
    const comparison = {
      name,
      options: state.options,
      overrides: state.overrides,
      toggles: {
        cashIncrease: toggleCashIncrease.checked,
        efficiency: toggleEfficiency.checked,
        irr: toggleIrr.checked,
      },
    };

    const id = await window.StorageInterface.saveComparison(comparison);
    setStatus(`Comparison saved as "${name}" (ID: ${id})`);
  } catch (error) {
    console.error("Save error:", error);
    setStatus("Error saving comparison.");
  }
}

async function handleLoadComparison() {
  try {
    const comparisons = await window.StorageInterface.listComparisons();
    if (comparisons.length === 0) {
      setStatus("No saved comparisons found.");
      return;
    }

    const options = comparisons
      .map((comp, idx) => `${idx + 1}. ${comp.name} (${new Date(comp.updatedAt).toLocaleString()})`)
      .join("\n");
    const choice = prompt(`Select a comparison to load:\n\n${options}\n\nEnter the number:`);

    if (!choice) return;
    const index = parseInt(choice, 10) - 1;
    if (index < 0 || index >= comparisons.length) {
      setStatus("Invalid selection.");
      return;
    }

    const comparison = await window.StorageInterface.loadComparison(comparisons[index].id);
    state.options = comparison.options || [null, null, null];
    state.overrides = comparison.overrides || {};

    if (comparison.toggles) {
      toggleCashIncrease.checked = comparison.toggles.cashIncrease;
      toggleEfficiency.checked = comparison.toggles.efficiency;
      toggleIrr.checked = comparison.toggles.irr;
    }

    renderAll();
    // Update status displays and illustration summaries
    for (let i = 0; i < 3; i++) {
      if (state.options[i]) {
        updateOptionStatus(i, `✓ ${state.options[i].name}`, "success");
        updateIllustrationSummary(i, state.options[i]);
      } else {
        updateIllustrationSummary(i, null);
      }
    }
    setStatus(`Loaded comparison: ${comparison.name}`);
  } catch (error) {
    console.error("Load error:", error);
    setStatus("Error loading comparison.");
  }
}

// Initialize
renderAll();

// Hide empty illustration summary cards on load
for (let i = 0; i < 3; i++) {
  updateIllustrationSummary(i, state.options[i]);
}
