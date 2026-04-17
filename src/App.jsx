import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ROW_COUNT = 32;
const STORAGE_KEYS = {
  currentDate: "tieStall.currentDate",
  sheetsByDate: "tieStall.sheetsByDate",
  googleDriveFileId: "tieStall.googleDriveFileId",
};

const GOOGLE_DRIVE_CONFIG = {
  enabled: true,
  clientId: "136823141935-51ejjgto1bmu018rifcmtuilc7g2us3a.apps.googleusercontent.com",
  appName: "Tie Stall Intake",
  fileName: "tie-stall-data.json",
  scopes: ["https://www.googleapis.com/auth/drive.file"],
};

function createDefaultRows() {
  const cows = [
    "5849", "4023", "57402", "5844", "6009", "5950", "3041", "3074", "5992", "2737",
    "5982", "2804", "5981", "3061", "3085", "3062", "2835", "2780", "5850", "3010",
    "3068", "5997", "6034", "6044", "5848", "2948", "3472", "2539", "5463", "2451",
    "5864", "5929",
  ];

  const binWeights = [
    "63", "65", "62", "63", "64", "63", "60", "65", "59", "61",
    "60", "60", "61", "62", "60", "91", "66", "73", "67", "70",
    "72", "60", "69", "67", "73", "67", "62", "62", "63", "62",
    "61", "",
  ];

  return Array.from({ length: DEFAULT_ROW_COUNT }, (_, i) => ({
    stall: String(i + 1),
    cow: cows[i] || "",
    diet: "",
    binWeight: binWeights[i] || "",
    binFedYesterday: "",
    fedYesterday: "",
    ortsBinToday: "",
    ortsToday: "",
    fedBinToday: "",
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
  return null;
}

function recalcRow(row) {
  const binWeight = toNumber(row.binWeight);
  const binFedYesterday = toNumber(row.binFedYesterday);
  const ortsBinToday = toNumber(row.ortsBinToday);

  const fedYesterday =
    binWeight !== null && binFedYesterday !== null ? binFedYesterday - binWeight : null;

  const ortsToday =
    binWeight !== null && ortsBinToday !== null ? ortsBinToday - binWeight : null;

  const fedBinToday = calculateFedBinToday(binFedYesterday, ortsToday);

  const fedToday =
    binWeight !== null && fedBinToday !== null ? fedBinToday - binWeight : null;

  return {
    ...row,
    fedYesterday: formatCalc(fedYesterday),
    ortsToday: formatCalc(ortsToday),
    fedBinToday: formatCalc(fedBinToday),
    fedToday: formatCalc(fedToday),
  };
}

function applyDefaultSetup(rows) {
  const defaults = createDefaultRows();
  return defaults.map((defaultRow, i) => {
    const existingRow = rows[i] || {};
    return {
      ...defaultRow,
      ...existingRow,
      stall: defaultRow.stall,
      cow: defaultRow.cow,
      binWeight: defaultRow.binWeight,
    };
  });
}

function normalizeRows(rows) {
  return applyDefaultSetup(rows).map(recalcRow);
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
      fedToday: "",
    })
  );
}

function buildAppStatePayload(currentDate, sheetsByDate, googleDriveFileId) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    currentDate,
    sheetsByDate,
    googleDriveFileId: googleDriveFileId || null,
  };
}

function sanitizeImportedState(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid file format.");
  }

  if (!payload.sheetsByDate || typeof payload.sheetsByDate !== "object") {
    throw new Error("Missing sheet data.");
  }

  const normalizedSheets = Object.fromEntries(
    Object.entries(payload.sheetsByDate).map(([date, sheet]) => {
      const rows = Array.isArray(sheet?.rows)
        ? normalizeRows(sheet.rows)
        : normalizeRows(createDefaultRows());
      const dayOfWeek = typeof sheet?.dayOfWeek === "string" ? sheet.dayOfWeek : getDayInfo(date).dayOfWeek;
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
    googleDriveFileId: typeof payload.googleDriveFileId === "string" ? payload.googleDriveFileId : "",
  };
}

function buildExportRows(rows) {
  return rows.map((r) => [
    r.stall,
    r.cow,
    r.diet,
    r.fedYesterday,
    r.ortsToday,
    r.fedToday,
  ]);
}

function downloadCsv(rows, date, dayOfWeek) {
  const header1 = ["26KH1 Tie Stall", "", "", "", `Date: ${date}`, ""];
  const header2 = ["", "", "", "", `Day of the Week: ${dayOfWeek}`, ""];
  const header3 = ["Stall", "Cow", "Diet", "Fed (lbs)", "Orts", "Fed"];
  const header4 = ["", "", "", "Yesterday", "Today", "Today"];
  const body = buildExportRows(rows);

  const csv = [header1, header2, header3, header4, ...body]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tie-stall-intake-${date || "sheet"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(currentDate, sheetsByDate, googleDriveFileId) {
  const payload = buildAppStatePayload(currentDate, sheetsByDate, googleDriveFileId);
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

async function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return window.google;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity Services.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return window.google;
}

function createGoogleTokenClient() {
  if (!GOOGLE_DRIVE_CONFIG.enabled) {
    throw new Error("Google Drive is not configured yet. Add your clientId first.");
  }

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services is not loaded yet.");
  }

  return window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_DRIVE_CONFIG.clientId,
    scope: GOOGLE_DRIVE_CONFIG.scopes.join(" "),
    callback: () => {},
  });
}

async function requestGoogleAccessToken(prompt = "consent") {
  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    const tokenClient = createGoogleTokenClient();
    tokenClient.callback = (response) => {
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response.access_token);
    };
    tokenClient.requestAccessToken({ prompt });
  });
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error("Could not load Google account info.");
  return response.json();
}

function createDriveMultipartRequestBody(metadata, fileText) {
  const boundary = `tie-stall-${Date.now()}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;
  const body = [
    delimiter,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    delimiter,
    "Content-Type: application/json",
    "",
    fileText,
    closeDelimiter,
    "",
  ].join("\r\n");

  return { boundary, body };
}

async function uploadJsonToGoogleDrive(accessToken, payload, existingFileId) {
  const metadata = {
    name: GOOGLE_DRIVE_CONFIG.fileName,
    mimeType: "application/json",
  };
  const fileText = JSON.stringify(payload, null, 2);
  const multipart = createDriveMultipartRequestBody(metadata, fileText);

  const isUpdate = Boolean(existingFileId);
  const endpoint = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const response = await fetch(endpoint, {
    method: isUpdate ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${multipart.boundary}`,
    },
    body: multipart.body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Drive save failed: ${message}`);
  }

  return response.json();
}

async function downloadJsonFromGoogleDrive(accessToken, fileId) {
  if (!fileId) {
    throw new Error("No Google Drive file is linked yet. Save once first, or restore from JSON.");
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Drive load failed: ${message}`);
  }

  return response.json();
}

function runSelfChecks() {
  const checks = [];

  const defaultRows = createDefaultRows();
  checks.push({
    name: "32 default stalls",
    pass: defaultRows.length === 32,
  });
  checks.push({
    name: "stall 31 prefill",
    pass: defaultRows[30].cow === "5864" && defaultRows[30].binWeight === "61",
  });
  checks.push({
    name: "stall 32 prefill",
    pass: defaultRows[31].cow === "5929" && defaultRows[31].binWeight === "",
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

  const mergedRows = normalizeRows([{ stall: "1", cow: "", binWeight: "" }]);
  checks.push({
    name: "default setup merge",
    pass: mergedRows[0].cow === "5849" && mergedRows[0].binWeight === "63",
  });

  const overriddenRows = normalizeRows([{ stall: "1", cow: "9999", binWeight: "11.2" }]);
  checks.push({
    name: "setup overrides old values",
    pass: overriddenRows[0].cow === "5849" && overriddenRows[0].binWeight === "63",
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

  return checks;
}

export default function App() {
  const todayInfo = getDayInfo(new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef(null);
  const [driveStatus, setDriveStatus] = useState("Not connected");
  const [driveAccountName, setDriveAccountName] = useState("");
  const [googleAccessToken, setGoogleAccessToken] = useState("");
  const [googleDriveFileId, setGoogleDriveFileId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.googleDriveFileId) || "";
    } catch {
      return "";
    }
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
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.fromEntries(
          Object.entries(parsed).map(([date, sheet]) => [
            date,
            {
              rows: normalizeRows(Array.isArray(sheet?.rows) ? sheet.rows : createDefaultRows()),
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

    return {
      [todayInfo.date]: {
        rows: normalizeRows(createDefaultRows()),
        dayOfWeek: todayInfo.dayOfWeek,
      },
    };
  });

  const checks = useMemo(() => runSelfChecks(), []);
  const allChecksPass = checks.every((check) => check.pass);

  const currentSheet = sheetsByDate[currentDate] || {
    rows: normalizeRows(createDefaultRows()),
    dayOfWeek: getDayInfo(currentDate).dayOfWeek,
  };
  const rows = normalizeRows(currentSheet.rows);
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sheetsByDate, JSON.stringify(sheetsByDate));
      localStorage.setItem(STORAGE_KEYS.currentDate, currentDate);
      localStorage.setItem(STORAGE_KEYS.googleDriveFileId, googleDriveFileId);
    } catch {
      // ignore storage errors
    }
  }, [sheetsByDate, currentDate, googleDriveFileId]);

  const updateCurrentSheet = (updater) => {
    setSheetsByDate((current) => {
      const existing = current[currentDate] || {
        rows: normalizeRows(createDefaultRows()),
        dayOfWeek: getDayInfo(currentDate).dayOfWeek,
      };
      const updated = updater(existing);
      return {
        ...current,
        [currentDate]: {
          ...updated,
          rows: normalizeRows(updated.rows),
        },
      };
    });
  };

  const updateRow = (index, key, value) => {
    updateCurrentSheet((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row, i) => (i === index ? recalcRow({ ...row, [key]: value }) : row)),
    }));
  };

  const updateDayOfWeek = (value) => {
    updateCurrentSheet((sheet) => ({ ...sheet, dayOfWeek: value }));
  };

  const resetSheet = () => {
    const resetInfo = getDayInfo(currentDate);
    setSheetsByDate((current) => ({
      ...current,
      [currentDate]: { rows: normalizeRows(createDefaultRows()), dayOfWeek: resetInfo.dayOfWeek },
    }));
  };

  const goToDate = (targetDate) => {
    const info = getDayInfo(targetDate);
    setSheetsByDate((current) => {
      if (current[info.date]) return current;
      return {
        ...current,
        [info.date]: { rows: normalizeRows(createDefaultRows()), dayOfWeek: info.dayOfWeek },
      };
    });
    setCurrentDate(info.date);
  };

  const carryForwardToNextDay = () => {
    const nextDay = shiftDate(currentDate, 1);
    setSheetsByDate((current) => ({
      ...current,
      [nextDay.date]: { rows: buildNextDayRows(rows), dayOfWeek: nextDay.dayOfWeek },
    }));
    setCurrentDate(nextDay.date);
  };

  const importFromFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      const imported = sanitizeImportedState(parsed);
      setSheetsByDate(imported.sheetsByDate);
      setCurrentDate(imported.currentDate);
      setGoogleDriveFileId(imported.googleDriveFileId || "");
      setDriveStatus("Backup restored.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed.";
      setDriveStatus(`Import error: ${message}`);
    } finally {
      event.target.value = "";
    }
  };

  const connectToGoogleDrive = async () => {
    try {
      setDriveStatus("Connecting to Google Drive...");
      const token = await requestGoogleAccessToken("consent");
      const profile = await fetchGoogleProfile(token);
      setGoogleAccessToken(token);
      setDriveAccountName(profile.email || profile.name || "Connected Google account");
      setDriveStatus("Connected to Google Drive");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      setDriveStatus(message);
    }
  };

  const disconnectGoogleDrive = () => {
    if (googleAccessToken && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(googleAccessToken, () => {});
    }
    setGoogleAccessToken("");
    setDriveAccountName("");
    setDriveStatus("Not connected");
  };

  const saveToGoogleDrive = async () => {
    try {
      setDriveStatus("Saving to Google Drive...");
      const token = googleAccessToken || (await requestGoogleAccessToken(""));
      if (!googleAccessToken) {
        const profile = await fetchGoogleProfile(token);
        setDriveAccountName(profile.email || profile.name || "Connected Google account");
      }
      setGoogleAccessToken(token);

      const response = await uploadJsonToGoogleDrive(
        token,
        buildAppStatePayload(currentDate, sheetsByDate, googleDriveFileId),
        googleDriveFileId
      );

      if (response?.id) setGoogleDriveFileId(response.id);
      setDriveStatus(`Saved to Google Drive as ${GOOGLE_DRIVE_CONFIG.fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setDriveStatus(message);
    }
  };

  const loadFromGoogleDrive = async () => {
    try {
      setDriveStatus("Loading from Google Drive...");
      const token = googleAccessToken || (await requestGoogleAccessToken(""));
      if (!googleAccessToken) {
        const profile = await fetchGoogleProfile(token);
        setDriveAccountName(profile.email || profile.name || "Connected Google account");
      }
      setGoogleAccessToken(token);

      const payload = await downloadJsonFromGoogleDrive(token, googleDriveFileId);
      const imported = sanitizeImportedState(payload);
      setSheetsByDate(imported.sheetsByDate);
      setCurrentDate(imported.currentDate);
      setGoogleDriveFileId(imported.googleDriveFileId || googleDriveFileId);
      setDriveStatus(`Loaded from Google Drive file ${googleDriveFileId || GOOGLE_DRIVE_CONFIG.fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed.";
      setDriveStatus(message);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 16, fontFamily: "Arial, sans-serif" }}>
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
                  <button style={buttonStyle} onClick={() => goToDate(shiftDate(currentDate, -1).date)}>◀</button>
                  <input style={inputStyle} type="date" value={currentDate} onChange={(e) => goToDate(e.target.value)} />
                  <button style={buttonStyle} onClick={() => goToDate(shiftDate(currentDate, 1).date)}>▶</button>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Day of the Week</label>
                <input style={inputStyle} value={dayOfWeek} onChange={(e) => updateDayOfWeek(e.target.value)} />
              </div>
              <button style={buttonStyle} onClick={resetSheet}>Reset Day</button>
              <button style={buttonStyle} onClick={carryForwardToNextDay}>Start Next Day</button>
              <button style={buttonStyle} onClick={() => downloadCsv(rows, currentDate, dayOfWeek)}>Export CSV</button>
            </div>
          </div>

          <div style={{ marginTop: 20, marginBottom: 12, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Backup and sync</div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 6 }}>
              Local browser save is active. JSON backup works now. Google Drive is enabled for your personal account setup.
            </div>
            <div style={smallMutedStyle}>Status: {driveStatus}{driveAccountName ? ` · ${driveAccountName}` : ""}</div>
            <div style={{ ...smallMutedStyle, marginBottom: 10 }}>Google Drive file ID: {googleDriveFileId || "not linked yet"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={importFromFile} />
              <button style={buttonStyle} onClick={() => downloadJson(currentDate, sheetsByDate, googleDriveFileId)}>Backup JSON</button>
              <button style={buttonStyle} onClick={() => fileInputRef.current?.click()}>Restore JSON</button>
              <button style={buttonStyle} onClick={connectToGoogleDrive}>Connect Google Drive</button>
              <button style={buttonStyle} onClick={saveToGoogleDrive}>Save to Google Drive</button>
              <button style={buttonStyle} onClick={loadFromGoogleDrive}>Load from Google Drive</button>
              <button style={buttonStyle} onClick={disconnectGoogleDrive} disabled={!googleAccessToken}>Disconnect</button>
            </div>
          </div>

          <div style={{ marginBottom: 20, padding: 12, background: allChecksPass ? "#f0fdf4" : "#fef2f2", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Self-checks: {allChecksPass ? "passed" : "failed"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Stall", "Cow", "Diet", "Bin Weight (lbs)", "Bin + Fed Yesterday (lbs)", "Fed (lbs)", "Orts + Bin", "Orts", "Fed + Bin", "Fed"].map((h) => (
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
                      <input style={{ ...inputStyle, background: "#fed7aa" }} value={row.cow} onChange={(e) => updateRow(index, "cow", e.target.value)} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fed7aa" }} value={row.diet} onChange={(e) => updateRow(index, "diet", e.target.value)} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#dbeafe" }} type="number" step="any" value={row.binWeight} onChange={(e) => updateRow(index, "binWeight", e.target.value)} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fed7aa" }} type="number" step="any" value={row.binFedYesterday} onChange={(e) => updateRow(index, "binFedYesterday", e.target.value)} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.fedYesterday} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fed7aa" }} type="number" step="any" value={row.ortsBinToday} onChange={(e) => updateRow(index, "ortsBinToday", e.target.value)} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.ortsToday} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.fedBinToday} />
                    </td>
                    <td style={{ border: "1px solid #cbd5e1", padding: 6 }}>
                      <input style={{ ...inputStyle, background: "#fef08a" }} readOnly value={row.fedToday} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
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
