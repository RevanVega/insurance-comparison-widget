const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const state = {
  options: [null, null, null],
  overrides: {},
  lastImportedOption: null,
  chart: null,
  sourcePdfs: {},
  debug: false,
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

const summaryDeathBenefit = document.getElementById("summaryDeathBenefit");
const summaryBasePremium = document.getElementById("summaryBasePremium");
const summaryPuaPremium = document.getElementById("summaryPuaPremium");
const summaryTermPremium = document.getElementById("summaryTermPremium");
const summarySpuaPremium = document.getElementById("summarySpuaPremium");

const comparisonTable = document.getElementById("comparisonTable");
const resetOverrides = document.getElementById("resetOverrides");
const exportPdf = document.getElementById("exportPdf");
const saveComparison = document.getElementById("saveComparison");
const loadComparison = document.getElementById("loadComparison");

const toggleCashIncrease = document.getElementById("toggleCashIncrease");
const toggleEfficiency = document.getElementById("toggleEfficiency");
const toggleIrr = document.getElementById("toggleIrr");
const debugMode = document.getElementById("debugMode");
const chartMetricRadios = document.querySelectorAll('input[name="chartMetric"]');

debugMode.addEventListener("change", () => {
  state.debug = debugMode.checked;
  if (state.debug) {
    console.log('%c🔍 Debug Mode Enabled', 'color: #1fc9e5; font-size: 16px; font-weight: bold;');
  }
});

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
resetOverrides.addEventListener("click", () => {
  state.overrides = {};
  renderAll();
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
  const pdfInput = pdfInputs[optionIndex];
  const carrierSelect = carrierSelects[optionIndex];
  const reportNameInput = reportNameInputs[optionIndex];

  if (!pdfInput.files[0]) {
    updateOptionStatus(optionIndex, "Please select a PDF illustration.", "error");
    return;
  }
  const carrier = carrierSelect.value;
  if (!carrier) {
    updateOptionStatus(optionIndex, "Select a carrier before parsing.", "error");
    return;
  }
  const name = reportNameInput.value || pdfInput.files[0].name;
  updateOptionStatus(optionIndex, "Parsing PDF...", "loading");

  const arrayBuffer = await pdfInput.files[0].arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  state.sourcePdfs[optionIndex] = arrayBuffer;

  if (carrier === "lafayette") {
    const rows = await parseLafayette(pdfDoc);
    const summary = await extractLafayetteSummary(pdfDoc, rows);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, `✓ ${name}`, "success");
  } else if (carrier === "massmutual") {
    const rows = await parseMassMutual(pdfDoc);
    const summary = await extractMassMutualSummary(pdfDoc, rows);
    setOption(optionIndex, name, carrier, rows, summary, pdfInput.files[0].name);
    updateOptionStatus(optionIndex, `✓ ${name}`, "success");
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

  // Clear summary if this was the last imported option
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
  summaryDeathBenefit.textContent = formatNumber(summary.initialDeathBenefit);
  summaryBasePremium.textContent = formatNumber(summary.baseAnnualPremium);
  summaryPuaPremium.textContent = formatNumber(summary.puaPremium);
  summaryTermPremium.textContent = formatNumber(summary.termPremium);
  summarySpuaPremium.textContent = formatNumber(summary.spuaPremium);
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
  debugLog('Starting MassMutual parsing...');
  const supplementalPage = parseNumber(massSupplemental.value) || 13;
  const reducedPaidUpPage = parseNumber(massReduced.value) || 14;
  debugLog(`MassMutual supplemental page: ${supplementalPage}, reduced paid-up: ${reducedPaidUpPage}`);
  const rows = [];

  debugLog('Parsing supplemental page (active premium years)...');
  const supplementalLines = await extractLinesFromPage(pdfDoc, supplementalPage);
  supplementalLines.forEach((line, lineIndex) => {
    if (!/^\d+\s+\d+/.test(line)) {
      debugLog(`  Line ${lineIndex + 1}: Skipped (doesn't match pattern)`);
      return;
    }
    const tokens = parseNumberTokens(line);
    debugLog(`  Line ${lineIndex + 1}: Found ${tokens.length} tokens:`, tokens);

    if (tokens.length < 11) {
      debugLog(`    Skipped: Not enough tokens (need 11+)`);
      return;
    }
    const year = parseNumber(tokens[0]);
    const age = parseNumber(tokens[1]);
    const annualPremium = parseNumber(tokens[2]);
    const cashValue = parseNumber(tokens[7]);
    const deathBenefit = parseNumber(tokens[10]);
    if (!year || !age) {
      debugLog(`    Skipped: Missing year or age`);
      return;
    }

    const row = { year, age, annualPremium, cashValue, deathBenefit };
    debugLog(`    ✓ Parsed:`, row);
    rows.push(row);
  });

  debugLog('Parsing reduced paid-up page...');
  const reducedLines = await extractLinesFromPage(pdfDoc, reducedPaidUpPage);
  reducedLines.forEach((line, lineIndex) => {
    if (!/^\d+\s+\d+/.test(line)) {
      debugLog(`  Line ${lineIndex + 1}: Skipped (doesn't match pattern)`);
      return;
    }
    const tokens = parseNumberTokens(line);
    debugLog(`  Line ${lineIndex + 1}: Found ${tokens.length} tokens:`, tokens);

    if (tokens.length < 8) {
      debugLog(`    Skipped: Not enough tokens (need 8+)`);
      return;
    }
    const year = parseNumber(tokens[0]);
    const age = parseNumber(tokens[1]);
    const cashValue = parseNumber(tokens[tokens.length - 2]);
    const deathBenefit = parseNumber(tokens[tokens.length - 1]);
    if (!year || !age) {
      debugLog(`    Skipped: Missing year or age`);
      return;
    }

    const row = { year, age, annualPremium: 0, cashValue, deathBenefit };
    debugLog(`    ✓ Parsed:`, row);
    rows.push(row);
  });

  debugLog(`MassMutual parsing complete: ${rows.length} rows extracted`);
  console.table(rows);
  return rows.sort((a, b) => a.year - b.year);
}

async function extractMassMutualSummary(pdfDoc, rows) {
  const summaryPage = parseNumber(massSummary.value) || 7;
  const lines = await extractLinesFromPage(pdfDoc, summaryPage);
  const fullText = lines.join(" ");
  const summary = {
    initialDeathBenefit: rows?.[0]?.deathBenefit ?? null,
    baseAnnualPremium: null,
    puaPremium: 0,
    termPremium: 0,
    spuaPremium: 0,
  };

  summary.baseAnnualPremium = parseNumber(
    (fullText.match(/Base Premium\s*\$([0-9,]+\.\d{2})/) || [])[1]
  );
  summary.initialDeathBenefit = parseNumber(
    (fullText.match(/Initial Death Benefit:\s*\$([0-9,]+\.\d{2})/) || [])[1]
  );
  return summary;
}

function renderAll() {
  renderTable();
  renderChart();
}

function renderTable() {
  const allYears = new Set();
  state.options.forEach((option) => {
    option?.rows.forEach((row) => allYears.add(row.year));
  });
  const years = Array.from(allYears).sort((a, b) => a - b);

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

  // Header row 1: Option names with proper colspan (including Year column)
  let html = "<table><thead><tr><th></th>";
  state.options.forEach((option, idx) => {
    const name = option?.name || `Option ${idx + 1}`;
    html += `<th colspan="${totalMetrics.length}">${name}</th>`;
  });
  html += "</tr>";

  // Header row 2: Year + metric labels for each option
  html += "<tr><th>Year</th>";
  state.options.forEach(() => {
    totalMetrics.forEach((metric) => {
      html += `<th>${metric.label}</th>`;
    });
  });
  html += "</tr></thead><tbody>";

  years.forEach((year) => {
    html += `<tr><td>${year}</td>`;
    state.options.forEach((option, optionIndex) => {
      const row = option?.rows.find((r) => r.year === year);
      const previousRow = option?.rows.find((r) => r.year === year - 1);
      totalMetrics.forEach((metric) => {
        const value = getMetricValue(optionIndex, row, previousRow, metric.key);
        const overrideKey = row
          ? getOverrideKey(optionIndex, row.year, metric.key)
          : null;
        const isOverride =
          overrideKey && Object.prototype.hasOwnProperty.call(state.overrides, overrideKey);
        const className = isOverride ? "editable override" : "editable";

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
          html += `<td contenteditable="true" data-option="${optionIndex}" data-year="${row.year}" data-field="${metric.key}" class="${className}">${formatNumber(value, isPercentage, decimals)}</td>`;
        } else {
          html += `<td>${formatNumber(value, isPercentage, decimals)}</td>`;
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

  const labels = [];
  state.options.forEach((option) => {
    option?.rows.forEach((row) => labels.push(row.year));
  });
  const uniqueLabels = Array.from(new Set(labels)).sort((a, b) => a - b);

  const datasets = state.options.map((option, index) => {
    const data = uniqueLabels.map((year) => {
      const row = option?.rows.find((r) => r.year === year);
      return row ? getValueWithOverride(index, row, selectedMetric) : null;
    });
    return {
      label: option?.name || `Option ${index + 1}`,
      data,
      borderColor: ["#1fc9e5", "#24ce62", "#35f1ce"][index],
      backgroundColor: "transparent",
      spanGaps: true,
      tension: 0.1,
    };
  });

  const chartEl = document.getElementById("comparisonChart");
  if (state.chart) {
    state.chart.data.labels = uniqueLabels;
    state.chart.data.datasets = datasets;
    state.chart.update();
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
  const element = document.getElementById("comparisonView");
  const opt = {
    margin: 0.3,
    filename: `comparison-${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
  };

  setStatus("Generating comparison PDF...");

  const comparisonPdfBlob = await html2pdf().set(opt).from(element).output("blob");
  const sourcePdfCount = Object.keys(state.sourcePdfs).length;

  if (sourcePdfCount === 0) {
    const url = URL.createObjectURL(comparisonPdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opt.filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Comparison PDF saved (no source PDFs attached).");
    return;
  }

  try {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    const comparisonArrayBuffer = await comparisonPdfBlob.arrayBuffer();
    const comparisonPdf = await PDFDocument.load(comparisonArrayBuffer);
    const comparisonPages = await mergedPdf.copyPages(comparisonPdf, comparisonPdf.getPageIndices());
    comparisonPages.forEach((page) => mergedPdf.addPage(page));

    for (let i = 0; i < 3; i++) {
      if (state.sourcePdfs[i]) {
        const sourcePdf = await PDFDocument.load(state.sourcePdfs[i]);
        const sourcePages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        sourcePages.forEach((page) => mergedPdf.addPage(page));
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
    setStatus(`Comparison PDF saved with ${sourcePdfCount} source illustration(s) attached.`);
  } catch (error) {
    console.error("PDF merge error:", error);
    setStatus("Error merging PDFs. Saving comparison only.");
    const url = URL.createObjectURL(comparisonPdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opt.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
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
        cashOverCash: toggleCashOverCash.checked,
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
      toggleCashOverCash.checked = comparison.toggles.cashOverCash;
    }

    renderAll();
    // Update status displays
    for (let i = 0; i < 3; i++) {
      if (state.options[i]) {
        updateOptionStatus(i, `✓ ${state.options[i].name}`, "success");
      }
    }
    setStatus(`Loaded comparison: ${comparison.name}`);
  } catch (error) {
    console.error("Load error:", error);
    setStatus("Error loading comparison.");
  }
}

renderAll();
