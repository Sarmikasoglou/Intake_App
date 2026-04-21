import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ROW_COUNT = 32;
const STORAGE_KEYS = {
  currentDate: "tieStall.currentDate",
  sheetsByDate: "tieStall.sheetsByDate",
  setupRows: "tieStall.setupRows",
};

const INITIAL_SETUP_ROWS = [
  { stall: "1", cow: "5849", binWeight: "63" },
  { stall: "2", cow: "6023", binWeight: "65" },
  { stall: "3", cow: "5703", binWeight: "62" },
  { stall: "4", cow: "5844", binWeight: "63" },
  { stall: "5", cow: "6009", binWeight: "64" },
  { stall: "6", cow: "5950", binWeight: "63" },
  { stall: "7", cow: "3067", binWeight: "60" },
  { stall: "8", cow: "3074", binWeight: "65" },
  { stall: "9", cow: "5992", binWeight: "59" },
  { stall: "10", cow: "2737", binWeight: "61" },
  { stall: "11", cow: "5982", binWeight: "60" },
  { stall: "12", cow: "2804", binWeight: "60" },
  { stall: "13", cow: "5981", binWeight: "61" },
  { stall: "14", cow: "3061", binWeight: "62" },
  { stall: "15", cow: "3085", binWeight: "60" },
  { stall: "16", cow: "3062", binWeight: "91" },
  { stall: "17", cow: "2835", binWeight: "66" },
  { stall: "18", cow: "2780", binWeight: "73" },
  { stall: "19", cow: "5850", binWeight: "67" },
  { stall: "20", cow: "3016", binWeight: "70" },
  { stall: "21", cow: "3083", binWeight: "72" },
  { stall: "22", cow: "5997", binWeight: "60" },
  { stall: "23", cow: "6034", binWeight: "69" },
  { stall: "24", cow: "6016", binWeight: "67" },
  { stall: "25", cow: "5848", binWeight: "73" },
  { stall: "26", cow: "2948", binWeight: "67" },
  { stall: "27", cow: "5972", binWeight: "62" },
  { stall: "28", cow: "2539", binWeight: "62" },
  { stall: "29", cow: "5963", binWeight: "63" },
  { stall: "30", cow: "2451", binWeight: "62" },
  { stall: "31", cow: "5846", binWeight: "61" },
  { stall: "32", cow: "5929", binWeight: "" },
];

function normalizeSetupRows(rows) {
  return Array.from({ length: DEFAULT_ROW_COUNT }, (_, i) => ({
    stall: String(i + 1),
    cow: rows?.[i]?.cow || "",
    binWeight: rows?.[i]?.binWeight || "",
  }));
}

function createDefaultRows(setupRows = INITIAL_SETUP_ROWS) {
  const normalizedSetup = normalizeSetupRows(setupRows);
  return normalizedSetup.map((setupRow, i) => ({
    stall: String(i + 1),
    cow: setupRow.cow || "",
    diet: "",
    binWeight: setupRow.binWeight || "",
    binFedYesterday: "",
    fedYesterday: "",
    ortsBinToday: "",
    ortsToday: "",
    fedBinToday: "",
    manualFedBinToday: "",
    fedToday: "",
  }));
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCalc(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return Number(value.toFixed(1)).toString();
}

function calculateFedBinToday(binFedYesterday, ortsToday) {
  if (binFedYesterday === null || ortsToday === null) return null;
  if (ortsToday < 5) return binFedYesterday + 10;
  if (ortsToday < 8) return binFedYesterday + 5;
  if (ortsToday > 18) return binFedYesterday - 10;
  if (ortsToday > 13) return binFedYesterday - 5;
  // 8 to 13 inclusive: keep same as yesterday
  return binFedYesterday;
}

function recalcRow(row) {
  const binWeight = toNumber(row.binWeight);
  const binFedYesterday = toNumber(row.binFedYesterday);
  const ortsBinToday = toNumber(row.ortsBinToday);
  const manualFedBinToday = toNumber(row.manualFedBinToday);

  const fedYesterday =
    binWeight !== null && binFedYesterday !== null ? binFedYesterday - binWeight : null;

  const ortsToday =
    binWeight !== null && ortsBinToday !== null ? ortsBinToday - binWeight : null;

  const calculatedFedBinToday = calculateFedBinToday(binFedYesterday, ortsToday);
  const finalFedBinToday = manualFedBinToday !== null ? manualFedBinToday : calculatedFedBinToday;

  const fedToday =
    binWeight !== null && finalFedBinToday !== null ? finalFedBinToday - binWeight : null;

  return {
    ...row,
    fedYesterday: formatCalc(fedYesterday),
    ortsToday: formatCalc(ortsToday),
    fedBinToday: formatCalc(finalFedBinToday),
    fedToday: formatCalc(fedToday),
  };
}

function applyDefaultSetup(rows, setupRows = INITIAL_SETUP_ROWS) {
  const defaults = createDefaultRows(setupRows);
  return defaults.map((defaultRow, i) => {
    const existingRow = rows[i] || {};
    return {
      ...defaultRow,
      ...existingRow,
      stall: defaultRow.stall,
      cow:
        existingRow.cow !== undefined && existingRow.cow !== ""
          ? existingRow.cow
          : defaultRow.cow,
      binWeight:
        existingRow.binWeight !== undefined && existingRow.binWeight !== ""
          ? existingRow.binWeight
          : defaultRow.binWeight,
    };
  });
}

function normalizeRows(rows, setupRows = INITIAL_SETUP_ROWS) {
  return applyDefaultSetup(rows, setupRows).map(recalcRow);
}

function getDayInfo(dateString) {
  const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  return {
    date: date.toISOString().slice(0, 10),
    dayOfWeek: date.toLocaleDateString(undefined, { weekday: "long" }),
  };
}

function shiftDate(dateString, days) {
  const baseDate = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() + days);
  return getDayInfo(nextDate.toISOString().slice(0, 10));
}

function buildNextDayRows(rows) {
  return rows.map((row) =>
    recalcRow({
      ...row,
      cow: row.cow || "",
      diet: row.diet || "",
      binWeight: row.binWeight || "",
      binFedYesterday: row.fedBinToday || "",
      fedYesterday: "",
      ortsBinToday: "",
      ortsToday: "",
      fedBinToday: "",
      manualFedBinToday: "",
      fedToday: "",
    })
  );
}

function buildAppStatePayload(currentDate, sheetsByDate) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    currentDate,
    sheetsByDate,
  };
}

function sanitizeImportedState(payload, setupRows = INITIAL_SETUP_ROWS) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid file format.");
  }

  if (!payload.sheetsByDate || typeof payload.sheetsByDate !== "object") {
    throw new Error("Missing sheet data.");
  }

  const normalizedSheets = Object.fromEntries(
    Object.entries(payload.sheetsByDate).map(([date, sheet]) => {
      const rows = Array.isArray(sheet?.rows)
        ? normalizeRows(sheet.rows, setupRows)
        : normalizeRows(createDefaultRows(setupRows), setupRows);
      const dayOfWeek =
        typeof sheet?.dayOfWeek === "string" ? sheet.dayOfWeek : getDayInfo(date).dayOfWeek;
      return [date, { rows, dayOfWeek }];
    })
  );

  const safeCurrentDate =
    typeof payload.currentDate === "string" && normalizedSheets[payload.currentDate]
      ? payload.currentDate
      : Object.keys(normalizedSheets)[0] || getDayInfo(new Date().toISOString().slice(0, 10)).date;

  return {
    currentDate: safeCurrentDate,
    sheetsByDate: normalizedSheets,
  };
}

function buildExportRows(rows) {
  return rows.map((r) => [r.stall, r.cow, r.diet, r.fedYesterday, r.ortsToday, r.fedToday]);
}

function buildCsvText(rows, date, dayOfWeek) {
  const header1 = ["26KH1 Tie Stall", "", "", "", `Date: ${date}`, ""];
  const header2 = ["", "", "", "", `Day of the Week: ${dayOfWeek}`, ""];
  const header3 = ["Stall", "Cow", "Diet", "Fed (lbs)", "Orts", "Fed"];
  const header4 = ["", "", "", "Yesterday", "Today", "Today"];
  const body = buildExportRows(rows);

  return [header1, header2, header3, header4, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function downloadCsv(rows, date, dayOfWeek) {
  const csv = buildCsvText(rows, date, dayOfWeek);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tie-stall-intake-${date || "sheet"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function emailCsvToRecipient(rows, date, dayOfWeek, recipientEmail) {
  const trimmedEmail = String(recipientEmail || "").trim();
  if (!trimmedEmail) {
    throw new Error("Enter an email address first.");
  }

  const csvFileName = `tie-stall-intake-${date || "sheet"}.csv`;
  const subject = `Tie Stall Intake CSV - ${date}`;
  const body = [
    "Attached is the exported Tie Stall Intake CSV.",
    "",
    `File name: ${csvFileName}`,
    "The CSV has also been downloaded automatically from the app.",
    "Please attach that downloaded file before sending.",
  ].join("\n");

  window.location.href = `mailto:${encodeURIComponent(trimmedEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function downloadJson(currentDate, sheetsByDate) {
  const payload = buildAppStatePayload(currentDate, sheetsByDate);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tie-stall-backup-${currentDate || "data"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function runSelfChecks() {
  const checks = [];

  const defaultRows = createDefaultRows(INITIAL_SETUP_ROWS);
  checks.push({ name: "32 default stalls", pass: defaultRows.length === 32 });
  checks.push({
    name: "stall 31 prefill",
    pass: defaultRows[30].cow === "5864" && defaultRows[30].binWeight === "61",
  });
  checks.push({
    name: "stall 32 prefill",
    pass: defaultRows[31].cow === "3085" && defaultRows[31].binWeight === "",
  });

  const editableSetup = normalizeSetupRows(INITIAL_SETUP_ROWS);
  editableSetup[0] = { stall: "1", cow: "9999", binWeight: "88" };
  const editedDefaults = createDefaultRows(editableSetup);
  checks.push({
    name: "editable setup",
    pass: editedDefaults[0].cow === "9999" && editedDefaults[0].binWeight === "88",
  });

  const sample = recalcRow({
    stall: "1",
    cow: "123",
    diet: "A",
    binWeight: "11.2",
    binFedYesterday: "135",
    fedYesterday: "",
    ortsBinToday: "18.8",
    ortsToday: "",
    fedBinToday: "",
    manualFedBinToday: "",
    fedToday: "",
  });

  checks.push({
    name: "calculation example",
    pass:
      sample.fedYesterday === "123.8" &&
      sample.ortsToday === "7.6" &&
      sample.fedBinToday === "140" &&
      sample.fedToday === "128.8",
  });

  const mergedRows = normalizeRows([{ stall: "1", cow: "", binWeight: "" }], INITIAL_SETUP_ROWS);
  checks.push({
    name: "default setup merge",
    pass: mergedRows[0].cow === "5849" && mergedRows[0].binWeight === "63",
  });

  const overriddenRows = normalizeRows(
    [{ stall: "1", cow: "9999", binWeight: "11.2" }],
    INITIAL_SETUP_ROWS
  );
  checks.push({
    name: "user edits persist",
    pass: overriddenRows[0].cow === "9999" && overriddenRows[0].binWeight === "11.2",
  });

  const manualOverrideSample = recalcRow({
    stall: "1",
    cow: "123",
    diet: "A",
    binWeight: "63",
    binFedYesterday: "200",
    fedYesterday: "",
    ortsBinToday: "70",
    ortsToday: "",
    fedBinToday: "",
    manualFedBinToday: "205",
    fedToday: "",
  });
  checks.push({
    name: "manual fed + bin edit",
    pass: manualOverrideSample.fedBinToday === "205" && manualOverrideSample.fedToday === "142",
  });

  const exportRow = buildExportRows([sample])[0];
  checks.push({
    name: "export columns",
    pass:
      exportRow.length === 6 &&
      exportRow[0] === "1" &&
      exportRow[3] === "123.8" &&
      exportRow[4] === "7.6" &&
      exportRow[5] === "128.8",
  });

  const logicPreview = [
    { orts: "< 5", action: "+10", example: "200 → 210" },
    { orts: "5 to < 8", action: "+5", example: "200 → 205" },
    { orts: "8 to 13", action: "same as yesterday", example: "200 → 200" },
    { orts: "> 13 to 18", action: "-5", example: "200 → 195" },
    { orts: "> 18", action: "-10", example: "200 → 190" },
  ];

  return { checks, logicPreview };
}

export default function App() {
  const todayInfo = getDayInfo(new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [showSetupEditor, setShowSetupEditor] = useState(false);
  const [setupRows, setSetupRows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.setupRows);
      if (saved) return normalizeSetupRows(JSON.parse(saved));
    } catch {
      // ignore and fall back
    }
    return normalizeSetupRows(INITIAL_SETUP_ROWS);
  });

  const [currentDate, setCurrentDate] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.currentDate) || todayInfo.date;
    } catch {
      return todayInfo.date;
    }
  });

  const [sheetsByDate, setSheetsByDate] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.sheetsByDate);
      const savedSetup = localStorage.getItem(STORAGE_KEYS.setupRows);
      const currentSetupRows = savedSetup
        ? normalizeSetupRows(JSON.parse(savedSetup))
        : normalizeSetupRows(INITIAL_SETUP_ROWS);

      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.fromEntries(
          Object.entries(parsed).map(([date, sheet]) => [
            date,
            {
              rows: normalizeRows(
                Array.isArray(sheet?.rows) ? sheet.rows : createDefaultRows(currentSetupRows),
                currentSetupRows
              ),
              dayOfWeek:
                typeof sheet?.dayOfWeek === "string"
                  ? sheet.dayOfWeek
                  : getDayInfo(date).dayOfWeek,
            },
          ])
        );
      }
    } catch {
      // ignore and fall back
    }

    const currentSetupRows = normalizeSetupRows(INITIAL_SETUP_ROWS);
    return {
      [todayInfo.date]: {
        rows: normalizeRows(createDefaultRows(currentSetupRows), currentSetupRows),
        dayOfWeek: todayInfo.dayOfWeek,
      },
    };
  });

  const selfCheckData = useMemo(() => runSelfChecks(), []);
  const checks = selfCheckData.checks;
  const logicPreview = selfCheckData.logicPreview;
  const allChecksPass = checks.every((check) => check.pass);

  const currentSheet = sheetsByDate[currentDate] || {
    rows: normalizeRows(createDefaultRows(setupRows), setupRows),
    dayOfWeek: getDayInfo(currentDate).dayOfWeek,
  };
  const rows = normalizeRows(currentSheet.rows, setupRows);
  const dayOfWeek = currentSheet.dayOfWeek;

  const totals = useMemo(() => {
    const sum = (key) => rows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);
    return {
      binFedYesterday: formatCalc(sum("binFedYesterday")),
      fedYesterday: formatCalc(sum("fedYesterday")),
      ortsBinToday: formatCalc(sum("ortsBinToday")),
      ortsToday: formatCalc(sum("ortsToday")),
      fedBinToday: formatCalc(sum("fedBinToday")),
      fedToday: formatCalc(sum("fedToday")),
    };
  }, [rows]);

  const averages = useMemo(() => {
    const avg = (key) => {
      const values = rows.map((r) => toNumber(r[key])).filter((v) => v !== null);
      if (values.length === 0) return "";
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return formatCalc(mean);
    };
    return {
      binFedYesterday: avg("binFedYesterday"),
      fedYesterday: avg("fedYesterday"),
      ortsBinToday: avg("ortsBinToday"),
      ortsToday: avg("ortsToday"),
      fedBinToday: avg("fedBinToday"),
      fedToday: avg("fedToday"),
    };
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sheetsByDate, JSON.stringify(sheetsByDate));
      localStorage.setItem(STORAGE_KEYS.currentDate, currentDate);
      localStorage.setItem(STORAGE_KEYS.setupRows, JSON.stringify(setupRows));
    } catch {
      // ignore storage errors
    }
  }, [sheetsByDate, currentDate, setupRows]);

  const updateCurrentSheet = (updater) => {
    setSheetsByDate((current) => {
      const existing = current[currentDate] || {
        rows: normalizeRows(createDefaultRows(setupRows), setupRows),
        dayOfWeek: getDayInfo(currentDate).dayOfWeek,
      };
      const updated = updater(existing);
      return {
        ...current,
        [currentDate]: {
          ...updated,
          rows: normalizeRows(updated.rows, setupRows),
        },
      };
    });
  };

  const updateRow = (index, key, value) => {
    updateCurrentSheet((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row, i) => {
        if (i !== index) return row;
        if (key === "fedBinToday") {
          const nextRow = {
            ...row,
            manualFedBinToday: value,
            fedBinToday: value,
          };
          return recalcRow(nextRow);
        }
        return recalcRow({ ...row, [key]: value });
      }),
    }));
  };

  const updateDayOfWeek = (value) => {
    updateCurrentSheet((sheet) => ({ ...sheet, dayOfWeek: value }));
  };

  const resetSheet = () => {
    const resetInfo = getDayInfo(currentDate);
    setSheetsByDate((current) => ({
      ...current,
      [currentDate]: {
        rows: normalizeRows(createDefaultRows(setupRows), setupRows),
        dayOfWeek: resetInfo.dayOfWeek,
      },
    }));
  };

  const goToDate = (targetDate) => {
    const info = getDayInfo(targetDate);
    setSheetsByDate((current) => {
      if (current[info.date]) return current;
      return {
        ...current,
        [info.date]: {
          rows: normalizeRows(createDefaultRows(setupRows), setupRows),
          dayOfWeek: info.dayOfWeek,
        },
      };
    });
    setCurrentDate(info.date);
  };

  const carryForwardToNextDay = () => {
    const nextDay = shiftDate(currentDate, 1);
    setSheetsByDate((current) => ({
      ...current,
      [nextDay.date]: {
        rows: buildNextDayRows(rows),
        dayOfWeek: nextDay.dayOfWeek,
      },
    }));
    setCurrentDate(nextDay.date);
  };

  const importFromFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const imported = sanitizeImportedState(parsed, setupRows);
      setSheetsByDate(imported.sheetsByDate);
      setCurrentDate(imported.currentDate);
      setEmailStatus("Backup restored.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setEmailStatus(`Import error: ${message}`);
    } finally {
      event.target.value = "";
    }
  };

  const emailExportCsv = () => {
    try {
      downloadCsv(rows, currentDate, dayOfWeek);
      emailCsvToRecipient(rows, currentDate, dayOfWeek, recipientEmail);
      setEmailStatus(
        `Opened an email draft for ${recipientEmail}. Attach the downloaded CSV before sending.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email draft failed.";
      setEmailStatus(message);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    boxSizing: "border-box",
    fontSize: 14,
  };

  const buttonStyle = {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
    cursor: "pointer",
    fontSize: 14,
  };

  const smallMutedStyle = {
    color: "#64748b",
    fontSize: 12,
  };

  const setupInputStyle = {
    ...inputStyle,
    background: "white",
    fontSize: 13,
  };

  const updateSetupRow = (index, key, value) => {
    setSetupRows((current) =>
      normalizeSetupRows(current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
    );
  };

  const applySetupToAllDays = () => {
    setSheetsByDate((current) =>
      Object.fromEntries(
        Object.entries(current).map(([date, sheet]) => [
          date,
          {
            ...sheet,
            rows: normalizeRows(sheet.rows, setupRows),
          },
        ])
      )
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 36 }}>26KH1 Tie Stall</h1>
              <p style={{ color: "#475569" }}>Enter the manual fields. Calculated fields update automatically.</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Date</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={buttonStyle} onClick={() => goToDate(shiftDate(currentDate, -1).date)}>
                    ◀
                  </button>
                  <input
                    style={inputStyle}
                    type="date"
                    value={currentDate}
                    onChange={(e) => goToDate(e.target.value)}
                  />
                  <button style={buttonStyle} onClick={() => goToDate(shiftDate(currentDate, 1).date)}>
                    ▶
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Day of the Week</label>
                <input style={inputStyle} value={dayOfWeek} onChange={(e) => updateDayOfWeek(e.target.value)} />
              </div>
              <button style={buttonStyle} onClick={resetSheet}>Reset Day</button>
              <button style={buttonStyle} onClick={() => setShowSetupEditor((v) => !v)}>
                {showSetupEditor ? "Hide Setup" : "Edit Stall Setup"}
              </button>
              <button style={buttonStyle} onClick={applySetupToAllDays}>Apply Setup</button>
              <button style={buttonStyle} onClick={carryForwardToNextDay}>Start Next Day</button>
              <button style={buttonStyle} onClick={() => downloadCsv(rows, currentDate, dayOfWeek)}>
                Export CSV
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              marginBottom: 12,
              padding: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Backup and email</div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 6 }}>
              Local browser save is active. You can export the CSV, back up the app JSON, or open an email draft for the exported CSV.
            </div>
            <div style={{ ...smallMutedStyle, marginBottom: 10 }}>Status: {emailStatus || "Ready"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={importFromFile}
              />
              <button style={buttonStyle} onClick={() => downloadJson(currentDate, sheetsByDate)}>
                Backup JSON
              </button>
              <button style={buttonStyle} onClick={() => fileInputRef.current?.click()}>
                Restore JSON
              </button>
              <input
                style={{ ...inputStyle, maxWidth: 260, background: "white" }}
                type="email"
                value={recipientEmail}
                placeholder="email@example.com"
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <button style={buttonStyle} onClick={emailExportCsv}>Email CSV</button>
            </div>
          </div>

          {showSetupEditor && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Edit stall setup</div>
              <div style={{ ...smallMutedStyle, marginBottom: 10 }}>
                Update the default Cow and Bin Weight values here. Click Apply Setup to push them into all saved days.
              </div>
              <div style={{ overflowX: "auto", maxHeight: 340, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>Stall</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>Cow</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: 8 }}>Bin Weight (lbs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setupRows.map((row, index) => (
                      <tr key={`setup-${row.stall}`}>
                        <td style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "center" }}>{row.stall}</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                          <input
                            style={setupInputStyle}
                            value={row.cow}
                            onChange={(e) => updateSetupRow(index, "cow", e.target.value)}
                          />
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                          <input
                            style={setupInputStyle}
                            value={row.binWeight}
                            onChange={(e) => updateSetupRow(index, "binWeight", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: allChecksPass ? "#f0fdf4" : "#fef2f2",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Self-checks: {allChecksPass ? "passed" : "failed"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {checks.map((check) => (
                <div
                  key={check.name}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid #cbd5e1",
                    background: check.pass ? "#dcfce7" : "#fecaca",
                    fontSize: 12,
                  }}
                >
                  {check.name}
                </div>
              ))}
            </div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Logic preview</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "white" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>Orts range</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>Fed + Bin rule</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>Example</th>
                  </tr>
                </thead>
                <tbody>
                  {logicPreview.map((row) => (
                    <tr key={row.orts}>
                      <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{row.orts}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{row.action}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{row.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {[
                    "Stall",
                    "Cow",
                    "Diet",
                    "Bin Weight (lbs)",
                    "Bin + Fed Yesterday (lbs)",
                    "Fed (lbs)",
                    "Orts + Bin",
                    "Orts",
                    "Fed + Bin",
                    "Fed",
                  ].map((h) => (
                    <th key={h} style={{ border: "1px solid #cbd5e1", padding: 8 }}>{h}</th>
                  ))}
                </tr>
                <tr style={{ background: "#f8fafc", fontSize: 12, color: "#475569" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}></th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}></th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8 }}></th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#dbeafe" }}>Constant</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fed7aa" }}>Yesterday</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fef08a" }}>Yesterday</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fed7aa" }}>Today</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fef08a" }}>Today</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fef08a" }}>Today</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: 8, background: "#fef08a" }}>Today</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.stall}>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6, textAlign: "center" }}>{row.stall}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#fed7aa" }}
                        value={row.cow}
                        onChange={(e) => updateRow(index, "cow", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#fed7aa" }}
                        value={row.diet}
                        onChange={(e) => updateRow(index, "diet", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#dbeafe" }}
                        type="number"
                        step="any"
                        value={row.binWeight}
                        onChange={(e) => updateRow(index, "binWeight", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#fed7aa" }}
                        type="number"
                        step="any"
                        value={row.binFedYesterday}
                        onChange={(e) => updateRow(index, "binFedYesterday", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.fedYesterday} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#fed7aa" }}
                        type="number"
                        step="any"
                        value={row.ortsBinToday}
                        onChange={(e) => updateRow(index, "ortsBinToday", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.ortsToday} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input
                        style={{ ...inputStyle, background: "#fef08a" }}
                        type="number"
                        step="any"
                        value={row.fedBinToday}
                        onChange={(e) => updateRow(index, "fedBinToday", e.target.value)}
                      />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.fedToday} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }} colSpan={4}>Averages</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.binFedYesterday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.fedYesterday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.ortsBinToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.ortsToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.fedBinToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{averages.fedToday}</td>
                </tr>
                <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }} colSpan={4}>Totals</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.binFedYesterday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.fedYesterday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.ortsBinToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.ortsToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.fedBinToday}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: 8 }}>{totals.fedToday}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
