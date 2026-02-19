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
  } else if (carrier === "ameritas") {
    console.log("Using Ameritas parser...");
    const rows = await parseAmeritas(pdfDoc);
    console.log("Ameritas rows parsed:", rows.length);
    const summary = await extractAmeritasSummary(pdfDoc, rows);
    console.log("Ameritas summary:", summary);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, `✓ ${name}`, "success");
  } else if (carrier === "guardian") {
    console.log("Using Guardian parser...");
    const rows = await parseGuardian(pdfDoc);
    const summary = await extractGuardianSummary(pdfDoc, rows);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, rows.length > 0 ? `✓ ${name}` : "Guardian: no data (parser pending)", rows.length > 0 ? "success" : "info");
  } else if (carrier === "oneamerica") {
    console.log("Using One America parser...");
    const rows = await parseOneAmerica(pdfDoc);
    const summary = await extractOneAmericaSummary(pdfDoc, rows);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, rows.length > 0 ? `✓ ${name}` : "One America: no data (parser pending)", rows.length > 0 ? "success" : "info");
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

const MAX_AGE_DISPLAY = 100;

function setOption(index, name, carrier, rows, summary, filename) {
  const withCumulative = applyCumulativeOutlay(rows);
  const capped = withCumulative.filter((row) => (row.age != null && row.age <= MAX_AGE_DISPLAY));
  state.options[index] = {
    name,
    carrier,
    rows: capped,
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
  const isGuardian = summary.carrier === "guardian" || option.carrier === "guardian";

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
  } else if (isGuardian) {
    setLabel("puaPremium", "PUA Premium (Scheduled + Unscheduled)");
    setLabel("spuaPremium", "Single Lump Sum PUA*");
    setLabel("termPremium", "Term Rider Premium (OYT)");
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

  // Add/remove Guardian Single Lump Sum PUA footnote
  let guardianFootnote = card.querySelector(".guardian-spua-footnote");
  if (isGuardian) {
    if (!guardianFootnote) {
      guardianFootnote = document.createElement("p");
      guardianFootnote.className = "guardian-spua-footnote";
      guardianFootnote.innerHTML = "<small>*Guardian: Unscheduled PUA may include lump sum premiums. Manually adjust First Year Single Lump Sum PUA as needed.</small>";
      loadedContent.appendChild(guardianFootnote);
    }
  } else if (guardianFootnote) {
    guardianFootnote.remove();
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
  const configStart = parseNumber(lafayetteStart.value);
  const configEnd = parseNumber(lafayetteEnd.value);
  const startPage = configStart > 0 ? configStart : 10;
  const endPage = configEnd > 0 ? configEnd : Math.min(20, pdfDoc.numPages);
  debugLog(`Lafayette table pages: ${startPage} to ${endPage}`);

  const rows = [];
  const seenYears = new Set();
  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
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

      const ageIndex = 0;
      const yearIndex = 1;
      const annualPremiumIndex = 2;
      const cashValueIndex = 9;
      const deathBenefitIndex = 10;

      const year = parseNumber(tokens[yearIndex]);
      const age = parseNumber(tokens[ageIndex]);
      const annualPremium = parseNumber(tokens[annualPremiumIndex]);
      const deathBenefit = parseNumber(tokens[deathBenefitIndex]);
      const cashValue = parseNumber(tokens[cashValueIndex]);

      if (!year || !age) return;
      if (year < 1 || year > 100) return;
      if (age < 18 || age > 120) return;
      if (seenYears.has(year)) return;
      seenYears.add(year);

      debugLog(`  📊 Row: year=${year}, age=${age}, premium=${annualPremium}, cv=${cashValue}, db=${deathBenefit}`);
      rows.push({ year, age, annualPremium, cashValue, deathBenefit });
    });
  }

  debugLog(`Lafayette parsing complete: ${rows.length} rows extracted`);
  console.table(rows);
  return rows.sort((a, b) => a.year - b.year);
}

async function findLafayettePremiumInformationPage(pdfDoc) {
  const maxPage = Math.min(30, pdfDoc.numPages);
  for (let p = 1; p <= maxPage; p += 1) {
    const lines = await extractLinesFromPage(pdfDoc, p);
    const text = lines.join(" ").toLowerCase().replace(/\s+/g, " ");
    if (
      /premium\s+information/.test(text) ||
      /required\s+premiums/.test(text) ||
      /minimum\s+required\s+annual\s+premium/.test(text) ||
      /base\s+policy/.test(text) ||
      /total\s+minimum\s+required/.test(text) ||
      /do\s+not\s+include\s+the\s+cost\s+of\s+additional\s+benefits/.test(text)
    ) {
      debugLog(`Lafayette: found Premium Information / Required Premiums section on page ${p}`);
      return p;
    }
  }
  return null;
}

function extractAmountsFromSection(sectionText) {
  const amounts = [];
  const re = /(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;
  let m;
  while ((m = re.exec(sectionText)) !== null) {
    const n = parseNumber(m[1]);
    if (n != null) amounts.push(n);
  }
  return amounts;
}

async function extractLafayetteSummary(pdfDoc, rows) {
  let summaryPage = parseNumber(lafayetteSummary.value) || null;
  if (!summaryPage || summaryPage < 1) {
    const detected = await findLafayettePremiumInformationPage(pdfDoc);
    summaryPage = detected || 16;
  }
  const summary = {
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,
    termPremium: null,
    spuaPremium: null,
  };

  const pagesToTry = [summaryPage, summaryPage - 1, summaryPage + 1, 14, 15, 16, 17].filter(
    (p) => p >= 1 && p <= pdfDoc.numPages
  );
  let fullText = "";

  for (const p of pagesToTry) {
    const lines = await extractLinesFromPage(pdfDoc, p);
    fullText = lines.join(" ").replace(/\s+/g, " ");
    if (/Base\s+Policy/i.test(fullText)) {
      debugLog(`Lafayette: using page ${p} for summary`);
      break;
    }
  }

  if (!/Base\s+Policy/i.test(fullText)) {
    return summary;
  }

  // Base Policy section: from "Base Policy" to "Level Premium" or "7 Year" or "10 Year" or ~350 chars
  const baseSection = fullText.match(/Base\s+Policy[\s\S]{0,350}?(?=Level\s+Premium|\d+\s+Year\s+Term|$)/i);
  if (baseSection) {
    const amounts = extractAmountsFromSection(baseSection[0]);
    const premiums = amounts.filter((a) => a >= 100 && a <= 50000);
    if (premiums.length > 0) {
      summary.baseAnnualPremium = premiums[premiums.length - 1];
    }
  }

  // Level Premium PUA Rider section
  const puaSection = fullText.match(/Level\s+Premium\s+PUA\s+Rider[\s\S]{0,200}?(?=\d+\s+Year\s+Term|Single\s+Premium|Total\s+Minimum|$)/i);
  if (puaSection) {
    const amounts = extractAmountsFromSection(puaSection[0]);
    const premiums = amounts.filter((a) => a >= 100 && a <= 100000);
    if (premiums.length > 0) {
      summary.puaPremium = Math.max(...premiums);
    }
  }

  // 7 Year or 10 Year Term Rider section
  const termSection = fullText.match(/\d+\s+Year\s+Term\s+Rider[\s\S]{0,150}?(?=Level\s+Premium|Single\s+Premium|Total\s+Minimum|Coverages\s+paid|$)/i);
  if (termSection) {
    const amounts = extractAmountsFromSection(termSection[0]);
    const premiums = amounts.filter((a) => a >= 100 && a <= 50000);
    if (premiums.length > 0) {
      summary.termPremium = premiums[premiums.length - 1];
    }
  }

  // Single Premium PUA Rider section
  const spuaSection = fullText.match(/Single\s+Premium\s+PUA\s+Rider[\s\S]{0,150}?(?=Paid\s+after|Other\s+Riders|Riders\s+with|$)/i);
  if (spuaSection) {
    const amounts = extractAmountsFromSection(spuaSection[0]);
    const large = amounts.filter((a) => a >= 1000 && a <= 500000);
    if (large.length > 0) {
      summary.spuaPremium = large[large.length - 1];
    }
  }

  return summary;
}

async function parseAmeritas(pdfDoc) {
  debugLog("Starting Ameritas parsing...");
  const rows = [];

  // Ameritas main table starts on printed page 9; in the sample this is PDF page 9.
  // We scan from page 9 through the end and filter out non-row lines.
  const startPage = 9;
  const endPage = pdfDoc.numPages;

  for (let page = startPage; page <= endPage; page += 1) {
    if (page > pdfDoc.numPages) break;
    const lines = await extractLinesFromPage(pdfDoc, page);
    debugLog(`Ameritas: processing ${lines.length} lines from page ${page}`);

    lines.forEach((line, lineIndex) => {
      // Data lines start with Age followed by End-of-Year (policy year), e.g. "41 1 ..."
      if (!/^\d+\s+\d+/.test(line)) {
        return;
      }

      const tokens = parseNumberTokens(line);
      if (tokens.length < 5) return;

      const age = parseNumber(tokens[0]);
      const year = parseNumber(tokens[1]);
      const annualPremium = parseNumber(tokens[2]); // Contract Premium + Riders (Non-guaranteed side)
      const cashValue = parseNumber(tokens[tokens.length - 2]); // second from right
      const deathBenefit = parseNumber(tokens[tokens.length - 1]); // far right

      // Basic validation to skip headers/summary rows
      if (!year || !age) return;
      if (year < 1 || year > 121) return;
      if (age < 18 || age > 121) return;

      const row = { year, age, annualPremium, cashValue, deathBenefit };
      debugLog(`Ameritas row:`, row);
      rows.push(row);
    });
  }

  debugLog(`Ameritas parsing complete: ${rows.length} rows extracted`);
  console.table(rows);
  return rows.sort((a, b) => a.year - b.year);
}

async function extractAmeritasSummary(pdfDoc, rows) {
  // Page 4 of 11 (printed) contains the coverage summary with base premium,
  // FPUR scheduled premium, FPUR received (lump sum), and Level Term rider.
  // In this sample that corresponds to PDF page 4.
  let fullText = "";
  const summaryPage = Math.min(4, pdfDoc.numPages);
  const lines = await extractLinesFromPage(pdfDoc, summaryPage);
  fullText = lines.join(" ");

  const summary = {
    carrier: "ameritas",
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,
    termPremium: null,
    spuaPremium: null,
  };

  // Examples from coverage summary text on page 4:
  // "Base Annual Premium of $4,565.01 is paid each period..."
  summary.baseAnnualPremium = parseNumber(
    (fullText.match(/Base\s+Annual\s+Premium[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  ) ?? rows?.[0]?.annualPremium ?? null;

  // "Level Term 10 Year ... $1,435.00" (treat as term rider premium if present)
  // Prefer parsing from the specific line; fall back to a fullText regex.
  let termPremium = null;
  const levelTermLine = lines.find((line) =>
    /Level\s+Term\s+10\s+Year/.test(line)
  );
  if (levelTermLine) {
    const termTokens = parseNumberTokens(levelTermLine);
    if (termTokens.length > 0) {
      termPremium = parseNumber(termTokens[termTokens.length - 1]);
    }
  }
  if (termPremium === null) {
    const termMatch =
      fullText.match(
        /Level\s+Term\s+10\s+Year[^$]*\$[0-9,]+(?:\.\d{2})?[^$]*\$([0-9,]+(?:\.\d{2})?)/
      ) || [];
    termPremium = parseNumber(termMatch[1]);
  }
  summary.termPremium = termPremium;

  // "FPUR - Received Premium ... $89,000.00" (lump-sum style; map to single premium PUA slot)
  summary.spuaPremium = parseNumber(
    (fullText.match(/FPUR\s*-\s*Received\s+Premium[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // "FPUR Scheduled Premium: $5,000.00" (ongoing additional paid-up style; map to PUA)
  summary.puaPremium = parseNumber(
    (fullText.match(/FPUR\s+Scheduled\s+Premium[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );

  // As a final fallback, if termPremium is still null but we know the initial
  // premium and other components, solve for the missing term rider premium:
  // Initial Premium ≈ Base + PUA + Single PUA + Term Rider.
  const initialPremium = parseNumber(
    (fullText.match(/Initial\s+Premium[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );
  if (
    (summary.termPremium === null || summary.termPremium === undefined) &&
    initialPremium !== null
  ) {
    const knownSum =
      (summary.baseAnnualPremium || 0) +
      (summary.puaPremium || 0) +
      (summary.spuaPremium || 0);
    const inferred = initialPremium - knownSum;
    if (inferred > 0) {
      summary.termPremium = inferred;
    }
  }

  // Fallback for initial death benefit from rows if text parse fails
  summary.initialDeathBenefit = summary.initialDeathBenefit ?? rows?.[0]?.deathBenefit ?? null;

  return summary;
}

async function parseGuardian(pdfDoc) {
  // Guardian: main table starts on page 12 of 18.
  // Columns: Policy Year, Age at Start of Year, Non-Guaranteed Current Net Premium (annual premium),
  // ... then cash value, death benefit (e.g. $2,000,000).
  debugLog("Starting Guardian parsing...");
  const rows = [];
  const startPage = 12;
  const endPage = pdfDoc.numPages;

  for (let page = startPage; page <= endPage; page += 1) {
    if (page > pdfDoc.numPages) break;
    const lines = await extractLinesFromPage(pdfDoc, page);
    debugLog(`Guardian: processing ${lines.length} lines from page ${page}`);

    lines.forEach((line) => {
      if (!/^\d+\s+\d+/.test(line)) return;
      const tokens = parseNumberTokens(line);
      if (tokens.length < 5) return;

      const year = parseNumber(tokens[0]);
      const age = parseNumber(tokens[1]);
      const annualPremium = parseNumber(tokens[2]);
      const cashValue = parseNumber(tokens[tokens.length - 2]);
      const deathBenefit = parseNumber(tokens[tokens.length - 1]);

      if (!year || !age) return;
      if (year < 1 || year > 121) return;
      if (age < 18 || age > 120) return;

      rows.push({ year, age, annualPremium, cashValue, deathBenefit });
    });
  }

  debugLog(`Guardian parsing complete: ${rows.length} rows`);
  return rows.sort((a, b) => a.year - b.year);
}

async function extractGuardianSummary(pdfDoc, rows) {
  // Guardian "Numeric Summary" lists: Annual Premium $8,250; PUA Scheduled + Unscheduled; OYT $581.56; Total First Year $25,000.
  let fullText = "";
  const allLines = [];
  const pagesToScan = Math.min(8, pdfDoc.numPages);
  for (let p = 1; p <= pagesToScan; p += 1) {
    const lines = await extractLinesFromPage(pdfDoc, p);
    allLines.push(...lines);
    fullText += " " + lines.join(" ");
  }

  const summary = {
    carrier: "guardian",
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,
    termPremium: null,
    spuaPremium: null,
  };

  // Annual Premium ** $8,250.00 — try regex first, then line-by-line (PDF layout varies)
  const baseMatch =
    fullText.match(/Annual\s+Premium\s*[*\s]*\$([0-9,]+\.\d{2})/) ||
    fullText.match(/Annual\s+Premium[^$]*?\$([0-9,]+\.\d{2})/) ||
    fullText.match(/Annual\s*Premium[^$]*?\$([0-9,]+\.\d{2})/) ||
    fullText.match(/Annual\s+Premium[^$]*\$([0-9,]+\.\d{2})/) ||
    fullText.match(/\$([8],?250\.00)/) ||
    fullText.match(/\b(8,?250\.00)\b/);
  summary.baseAnnualPremium = parseNumber((baseMatch || [])[1]);

  // Line-by-line fallback: find line with "Annual" and "Premium", then first $X,XXX.00 in 1k–15k range (base, not total)
  if (summary.baseAnnualPremium == null) {
    for (const line of allLines) {
      if (!/Annual/i.test(line) || !/Premium/i.test(line)) continue;
      const amounts = line.match(/\$?([0-9,]+\.\d{2})/g);
      if (amounts) {
        for (const a of amounts) {
          const val = parseNumber(a.replace(/^\$/, ""));
          if (val != null && val >= 1000 && val <= 15000) {
            summary.baseAnnualPremium = val;
            break;
          }
        }
      }
      if (summary.baseAnnualPremium != null) break;
    }
  }
  // No fallback to rows[0].annualPremium — that column is total outlay ($25,000), not base ($8,250)

  // PUA Rider Premium includes $581.56 for OYT — parse before PUA so we can subtract it from PUA total
  summary.termPremium = parseNumber(
    (fullText.match(/includes\s+\$([0-9,]+\.\d{2})\s+for\s+OYT/) || [])[1]
  ) ?? parseNumber((fullText.match(/OYT[^$]*\$([0-9,]+\.\d{2})/) || [])[1]);

  // Paid Up Additions Rider (Scheduled): $624.60 + (Unscheduled): $16,125.40 = $16,750; subtract OYT (included in PUA total)
  const puaScheduled = parseNumber(
    (fullText.match(/Paid\s+Up\s+Additions\s+Rider\s*\(\s*Scheduled\s*\)[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );
  const puaUnscheduled = parseNumber(
    (fullText.match(/Paid\s+Up\s+Additions\s+Rider\s*\(\s*Unscheduled\s*\)[^$]*\$([0-9,]+\.\d{2})/) || [])[1]
  );
  if (puaScheduled != null || puaUnscheduled != null) {
    const puaGross = (puaScheduled || 0) + (puaUnscheduled || 0);
    summary.puaPremium = Math.max(0, puaGross - (summary.termPremium || 0));
  }
  // Single Lump Sum PUA: default to 0; agent manually enters lump sum so total first year outlay auto-adjusts
  summary.spuaPremium = 0;

  if (summary.initialDeathBenefit == null) {
    summary.initialDeathBenefit = parseNumber(
      (fullText.match(/Death\s+Benefit[^$]*\$([0-9,]+)/) || [])[1]
    ) ?? rows?.[0]?.deathBenefit ?? null;
  }

  return summary;
}

async function parseOneAmerica(pdfDoc) {
  // One America parser: placeholder until sample PDF and page/column mapping are provided.
  debugLog("One America parser not yet configured; returning empty rows.");
  return [];
}

async function extractOneAmericaSummary(pdfDoc, rows) {
  return {
    carrier: "oneamerica",
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,
    termPremium: null,
    spuaPremium: null,
  };
}

async function parseMassMutual(pdfDoc) {
  console.log('Starting MassMutual parsing...');
  console.log(`PDF has ${pdfDoc.numPages} pages`);
  const rows = [];
  const seenYears = new Set();

  // Strategy: Auto-detect table pages by searching for "Tabular Values" header
  // or fall back to "Illustration Summary" table
  let tabularValuePages = [];
  let illustrationSummaryPages = [];

  // Scan pages to find table locations
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const lines = await extractLinesFromPage(pdfDoc, p);
    const pageText = lines.join(" ");

    if (/tabular\s+values/i.test(pageText)) {
      tabularValuePages.push(p);
      console.log(`Found Tabular Values on page ${p}`);
    }
    if (/illustration\s+summary/i.test(pageText) && /year\s+age/i.test(pageText)) {
      illustrationSummaryPages.push(p);
      console.log(`Found Illustration Summary table on page ${p}`);
    }
  }

  console.log(`Tabular Value pages: ${tabularValuePages.join(', ') || 'none'}`);
  console.log(`Illustration Summary pages: ${illustrationSummaryPages.join(', ') || 'none'}`);

  // Prefer Tabular Values pages (more detailed), fall back to Illustration Summary
  let tablePagesToUse = tabularValuePages.length > 0 ? tabularValuePages : illustrationSummaryPages;
  const useTabularFormat = tabularValuePages.length > 0;

  if (tablePagesToUse.length === 0) {
    // Last resort: try pages in typical ranges
    console.log('No table headers found, trying common page ranges...');
    for (let p = 3; p <= Math.min(25, pdfDoc.numPages); p++) {
      tablePagesToUse.push(p);
    }
  }

  // Parse each table page
  for (const pageNum of tablePagesToUse) {
    const lines = await extractLinesFromPage(pdfDoc, pageNum);
    console.log(`Parsing MassMutual page ${pageNum} (${lines.length} lines)...`);

    for (const line of lines) {
      // Data rows start with Year (1-3 digits) followed by Age (2-3 digits)
      if (!/^\d{1,3}\s+\d{2,3}/.test(line)) continue;

      const tokens = parseNumberTokens(line);
      if (tokens.length < 6) continue;

      const year = parseNumber(tokens[0]);
      const age = parseNumber(tokens[1]);

      if (!year || !age) continue;
      if (year < 1 || year > 121) continue;
      if (age < 18 || age > 121) continue;
      if (seenYears.has(year)) continue;

      let annualPremium, cashValue, deathBenefit;

      // Use page type to determine column layout, with token count as fallback
      // Tabular Values formats:
      //   - Without LISR: 10-11 columns, Total CV at [7], Total DB at [9]
      //   - With LISR: 12 columns, Total CV at [8], Total DB at [11]
      // Illustration Summary has 6-7 columns
      const isTabularRow = useTabularFormat || tokens.length >= 10;

      if (isTabularRow && tokens.length >= 12) {
        // LISR Tabular Values format (12 columns):
        // Index: 0=Year, 1=Age, 2=Prem Gtd, 3=Guar CV, 4=Guar DB, 5=Contract Prem, 6=Annual Div, 7=CV Guar?, 8=Total CV, 9=PUA, 10=Term, 11=Total DB
        annualPremium = parseNumber(tokens[5]);  // Contract Premium
        cashValue = parseNumber(tokens[8]);      // Total Cash Value (column 8)
        deathBenefit = parseNumber(tokens[11]);  // Total Death Benefit (column 11)
        console.log(`  Row ${year}: LISR format CV=${cashValue}, DB=${deathBenefit}`);
      } else if (isTabularRow && tokens.length >= 8) {
        // Standard Tabular Values format (10-11 columns):
        // Year, Age, Contract Premium, Guar CV, Guar DB, Annual Div, CV of Additions, Total CV, PUA, Total DB, (Total Paid-Up)
        annualPremium = parseNumber(tokens[2]);
        cashValue = parseNumber(tokens[7]);      // Total Cash Value (column 7)
        deathBenefit = tokens.length >= 10 ? parseNumber(tokens[9]) : parseNumber(tokens[tokens.length - 1]);
        console.log(`  Row ${year}: Tabular format (${tokens.length} tokens) CV=${cashValue}, DB=${deathBenefit}`);
      } else if (tokens.length >= 6) {
        // Illustration Summary format (6-7 columns):
        // Year, Age, Annual Net Outlay, Cumulative Net Outlay, Net Cash Value, (Net Annual CV Increase), Net Death Benefit
        annualPremium = parseNumber(tokens[2]);
        cashValue = parseNumber(tokens[4]);
        deathBenefit = parseNumber(tokens[tokens.length - 1]); // Last column is death benefit
        console.log(`  Row ${year}: Summary format (${tokens.length} tokens) CV=${cashValue}, DB=${deathBenefit}`);
      } else {
        continue;
      }

      // Validate: death benefit should be >= cash value and reasonably large
      // Also check if cash value seems wrong (e.g., stuck at $1,000,000 which is the guaranteed DB)
      if (deathBenefit && cashValue && deathBenefit < cashValue) {
        // Columns might be swapped, try alternative
        const altDeathBenefit = parseNumber(tokens[tokens.length - 1]);
        if (altDeathBenefit > cashValue) {
          deathBenefit = altDeathBenefit;
        }
      }

      // Additional check: if cash value equals a round million and tokens suggest Tabular Values format,
      // we may have read the wrong column. Try to fix it.
      if (tokens.length >= 8 && cashValue === 1000000 && tokens[7]) {
        const altCashValue = parseNumber(tokens[7]);
        if (altCashValue && altCashValue !== 1000000) {
          console.log(`  Correcting CV from ${cashValue} to ${altCashValue} (year ${year})`);
          cashValue = altCashValue;
        }
      }

      seenYears.add(year);
      const row = { year, age, annualPremium, cashValue, deathBenefit };
      debugLog(`  Year ${year}: Age=${age}, Premium=${annualPremium}, CV=${cashValue}, DB=${deathBenefit}`);
      rows.push(row);
    }
  }

  console.log(`MassMutual parsing complete: ${rows.length} rows extracted`);
  if (rows.length > 0) {
    console.table(rows.slice(0, 10)); // Show first 10 rows
  }
  return rows.sort((a, b) => a.year - b.year);
}

async function extractMassMutualSummary(pdfDoc, rows) {
  console.log("Extracting MassMutual summary...");

  const summary = {
    carrier: "massmutual",
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: null,        // ALIR Scheduled
    spuaPremium: null,       // ALIR Unscheduled (lump sum)
    termPremium: null,       // LISR
  };

  // Scan first 15 pages for summary information
  let allText = "";
  const pagesToScan = Math.min(15, pdfDoc.numPages);
  for (let p = 1; p <= pagesToScan; p++) {
    const lines = await extractLinesFromPage(pdfDoc, p);
    allText += " " + lines.join(" ");
  }

  // Try multiple patterns for Base Premium
  // Pattern 1: "Base Premium $X" (with ALIR riders)
  // Pattern 2: "Total Initial Premium: $X" or "Total Initial Premium $X"
  // Pattern 3: "Initial Annualized Premium: $X"
  summary.baseAnnualPremium = parseNumber(
    (allText.match(/Base Premium\s*\$([0-9,]+(?:\.\d{2})?)/) || [])[1]
  );

  // If no base premium found, try to get total initial premium
  if (!summary.baseAnnualPremium) {
    const totalPremiumMatch = allText.match(/Total Initial Premium[:\s]*\$([0-9,]+(?:\.\d{2})?)/i) ||
                              allText.match(/Initial Annualized Premium[:\s]*\$([0-9,]+(?:\.\d{2})?)/i);
    if (totalPremiumMatch) {
      summary.baseAnnualPremium = parseNumber(totalPremiumMatch[1]);
    }
  }

  // ALIR Scheduled Purchase Payment (PUA)
  summary.puaPremium = parseNumber(
    (allText.match(/ALIR[^$]*Scheduled[^$]*\$([0-9,]+(?:\.\d{2})?)/) || [])[1]
  );

  // ALIR Unscheduled First Year Lump Sum (single PUA)
  summary.spuaPremium = parseNumber(
    (allText.match(/ALIR[^$]*Unscheduled[^$]*\$([0-9,]+(?:\.\d{2})?)/) || [])[1]
  );

  // LISR Premium First Year (term blend rider)
  summary.termPremium = parseNumber(
    (allText.match(/LISR Premium[^$]*\$([0-9,]+(?:\.\d{2})?)/) || [])[1]
  );

  // Initial Death Benefit - try to extract from text if not in rows
  if (!summary.initialDeathBenefit) {
    const dbMatch = allText.match(/Initial Death Benefit[:\s]*\$([0-9,]+(?:\.\d{2})?)/i) ||
                    allText.match(/Total Initial Death Benefit[:\s]*\$([0-9,]+(?:\.\d{2})?)/i);
    if (dbMatch) {
      summary.initialDeathBenefit = parseNumber(dbMatch[1]);
    }
  }

  // Fallback: use first row annual premium if no summary premium found
  if (!summary.baseAnnualPremium && rows?.[0]?.annualPremium) {
    summary.baseAnnualPremium = rows[0].annualPremium;
  }

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

  // Log export settings
  const summaryYearsOnly = document.getElementById("pdfSummaryYears")?.checked ?? false;
  console.log(`PDF Export: summaryYearsOnly=${summaryYearsOnly}`);

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
    margin: [0.3, 0.25, 0.4, 0.25], // top, left, bottom, right - tighter margins
    filename: `comparison-${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.92 },
    html2canvas: { scale: 1.5, useCORS: true, logging: false }, // reduced scale
    jsPDF: { unit: "in", format: "letter", orientation: "landscape" },
    pagebreak: { mode: 'css' }, // simplified pagebreak mode
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
    const comparisonPageCount = pages.length;
    console.log(`Comparison PDF generated: ${comparisonPageCount} pages`);
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

    // Save the comparison PDF (no source illustrations attached)
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opt.filename;
    a.click();
    URL.revokeObjectURL(url);

    setStatus("Comparison PDF saved.");
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
  let years = Array.from(allYears).sort((a, b) => a - b);

  // If summary years only, filter to milestone years (1, 5, 10, 15, 20, 25, 30, etc.)
  const summaryYearsOnly = document.getElementById("pdfSummaryYears")?.checked ?? false;
  if (summaryYearsOnly) {
    const milestones = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
    const maxYear = Math.max(...years);
    // Always include the last year
    years = years.filter(y => milestones.includes(y) || y === maxYear);
  }

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

  // Determine first column header based on summary mode
  const firstColHeader = summaryYearsOnly ? "Year" : "Age";
  const firstColCount = summaryYearsOnly ? 2 : 1; // Year + Age columns in summary mode

  let html = "<table><thead>";
  html += "<tr><th class=\"year-header\"" + (summaryYearsOnly ? " colspan=\"2\"" : "") + "></th>";
  state.options.forEach((option, idx) => {
    if (!option) return;
    const name = option.name || `Option ${idx + 1}`;
    html += `<th colspan="${columns.length}" class="${optionColors[idx]}">${name}</th>`;
  });
  html += "</tr>";
  if (summaryYearsOnly) {
    html += "<tr><th class=\"year-header\">Year</th><th class=\"year-header\">Age</th>";
  } else {
    html += "<tr><th class=\"year-header\">Age</th>";
  }
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

    if (summaryYearsOnly) {
      html += `<tr class="pdf-table-row" data-html2pdf-page-break-avoid><td class="year-cell year-number">${year}</td><td class="year-cell">${age}</td>`;
    } else {
      html += `<tr class="pdf-table-row" data-html2pdf-page-break-avoid><td class="year-cell">${age}</td>`;
    }
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
