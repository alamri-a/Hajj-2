const SPREADSHEET_NAME = "Hajj-2 Data";
const STATS_MARKER = "STATS_SECTION";

const HEADERS = [
  "recordId",
  "التعداد",
  "التاريخ",
  "الساعة",
  "المدة بالثواني",
  "مسجل له بصمة سابقًا؟",
  "سبب التأخير",
  "المرحلة",
  "_marker"
];

function doGet(e) {
  return jsonResponse({
    status: "ok",
    message: "Google Sheet API is working. Site should use local data only for display."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const checkpoint = payload.checkpoint;
    const phase = payload.phase;

    if (!action || !checkpoint || !phase) {
      return jsonResponse({
        status: "error",
        message: "action و checkpoint و phase مطلوبة"
      });
    }

    const ss = getOrCreateSpreadsheet();
    const sheetName = sanitizeSheetName(checkpoint);

    if (action === "add") {
      const sheet = getOrCreateSheet(ss, sheetName);
      clearStatsSection(sheet);

      const record = payload.record;

      const counter = getNextCounter(sheet, phase);

      sheet.appendRow([
        record.recordId,
        counter,
        normalizeDate(record.date),
        normalizeTime(record.time),
        Number(record.duration),
        record.biometric,
        record.delayReason || "",
        phase,
        ""
      ]);

      SpreadsheetApp.flush();
      formatDataRows(sheet);
      refreshStats(sheet);

      return jsonResponse({ status: "ok", message: "تمت الإضافة" });
    }

    if (action === "delete") {
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return jsonResponse({ status: "ok", message: "not found" });
      }

      clearStatsSection(sheet);

      const rowIndex = findRowById(sheet, payload.recordId);

      if (rowIndex === -1) {
        refreshStats(sheet);
        return jsonResponse({ status: "ok", message: "not found" });
      }

      sheet.deleteRow(rowIndex);
      resequenceCounters(sheet);
      formatDataRows(sheet);
      refreshStats(sheet);

      return jsonResponse({ status: "ok", message: "تم الحذف" });
    }

    if (action === "reset") {
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return jsonResponse({ status: "ok", message: "لا توجد بيانات" });
      }

      clearStatsSection(sheet);

      const data = sheet.getDataRange().getValues();

      for (let i = data.length; i >= 2; i--) {
        if (String(data[i - 1][7]).trim() === String(phase).trim()) {
          sheet.deleteRow(i);
        }
      }

      resequenceCounters(sheet);
      formatDataRows(sheet);
      refreshStats(sheet);

      return jsonResponse({ status: "ok", message: "تم المسح" });
    }

    return jsonResponse({
      status: "error",
      message: "action غير معروف: " + action
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ─────────────────────────────────────────
// clearStatsSection — حذف دفعة واحدة
// يعتمد على العمود A فقط: صفوف البيانات دائماً لها recordId، صفوف الإحصائيات فارغة
// ─────────────────────────────────────────
function clearStatsSection(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const col1 = sheet.getRange(2, 1, numRows, 1).getValues();

  let lastDataRow = 1;
  for (let i = numRows - 1; i >= 0; i--) {
    if (String(col1[i][0]).trim() !== "") {
      lastDataRow = i + 2;
      break;
    }
  }

  const cutFrom = lastDataRow + 1;
  if (cutFrom <= lastRow) {
    const numToClear = lastRow - cutFrom + 1;
    sheet.getRange(cutFrom, 1, numToClear, sheet.getMaxColumns())
      .clearContent()
      .clearFormat();
  }
}

// ─────────────────────────────────────────
// refreshStats
// ─────────────────────────────────────────
function refreshStats(sheet) {
  clearStatsSection(sheet);

  const data = sheet.getDataRange().getValues();

  const dataRows = data.slice(1).filter(row =>
    String(row[0]).trim() !== "" &&
    String(row[8]).trim() !== STATS_MARKER
  );

  if (dataRows.length === 0) {
    formatHeader(sheet);
    return;
  }

  const phases = [...new Set(dataRows.map(r => r[7]).filter(Boolean))];

  let writeRow = sheet.getLastRow() + 2;

  for (const phase of phases) {
    const phaseRows = dataRows.filter(r => String(r[7]).trim() === String(phase).trim());

    const withBio    = phaseRows.filter(r => r[5] === "نعم").map(r => Number(r[4])).filter(n => !isNaN(n));
    const withoutBio = phaseRows.filter(r => r[5] === "لا").map(r => Number(r[4])).filter(n => !isNaN(n));
    const allDur     = phaseRows.map(r => Number(r[4])).filter(n => !isNaN(n));

    const avg     = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const safeMin = arr => arr.length ? Math.min(...arr) : 0;
    const safeMax = arr => arr.length ? Math.max(...arr) : 0;
    const pct     = (n, total) => total ? Math.round((n / total) * 100) + "%" : "0%";
    const total   = allDur.length;

    // عنوان المرحلة
    sheet.getRange(writeRow, 2, 1, 6)
      .breakApart()
      .merge()
      .setValue("📊 ملخص إحصائي — " + phase)
      .setBackground("#1b5e20")
      .setFontColor("white")
      .setFontWeight("bold")
      .setFontSize(12)
      .setHorizontalAlignment("center");
    sheet.getRange(writeRow, 9).setValue(STATS_MARKER);
    writeRow++;

    // رؤوس الأعمدة
    sheet.getRange(writeRow, 2, 1, 6)
      .setValues([["الفئة","عدد الحجاج","متوسط الزمن (ثانية)","الزمن الأدنى (ثانية)","الزمن الأعلى (ثانية)","النسبة من الإجمالي"]])
      .setBackground("#a5d6a7")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.getRange(writeRow, 9).setValue(STATS_MARKER);
    writeRow++;

    const statsData = [
      ["المسجل لهم بصمة",    withBio.length,    avg(withBio),    safeMin(withBio),    safeMax(withBio),    pct(withBio.length, total)],
      ["غير المسجل لهم بصمة", withoutBio.length, avg(withoutBio), safeMin(withoutBio), safeMax(withoutBio), pct(withoutBio.length, total)],
      ["الإجمالي",             total,             avg(allDur),     safeMin(allDur),     safeMax(allDur),     "—"]
    ];

    sheet.getRange(writeRow, 2, statsData.length, 6)
      .setValues(statsData)
      .setBackground("#e8f5e9")
      .setHorizontalAlignment("center");

    sheet.getRange(writeRow + 2, 2, 1, 6)
      .setBackground("#c8e6c9")
      .setFontWeight("bold");

    // كتابة STATS_MARKER للصفوف الثلاثة دفعة واحدة
    sheet.getRange(writeRow, 9, statsData.length, 1)
      .setValues(statsData.map(() => [STATS_MARKER]));

    writeRow += statsData.length + 1;
  }

  formatHeader(sheet);
  formatDataRows(sheet);
}

// ─────────────────────────────────────────
// formatDataRows — تنسيق دفعة واحدة
// ─────────────────────────────────────────
function formatDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const col1 = sheet.getRange(2, 1, numRows, 1).getValues();
  const col9 = sheet.getRange(2, 9, numRows, 1).getValues();

  // إيجاد آخر صف بيانات حقيقي
  let lastDataRow = 1;
  for (let i = numRows - 1; i >= 0; i--) {
    if (String(col1[i][0]).trim() !== "" && String(col9[i][0]).trim() !== STATS_MARKER) {
      lastDataRow = i + 2;
      break;
    }
  }

  if (lastDataRow < 2) return;

  // تنسيق كل صفوف البيانات دفعة واحدة
  sheet.getRange(2, 1, lastDataRow - 1, 9)
    .setBackground(null)
    .setFontColor("black")
    .setFontWeight("normal")
    .setHorizontalAlignment("center");
}

// ─────────────────────────────────────────
// resequenceCounters — كتابة دفعة واحدة
// ─────────────────────────────────────────
function resequenceCounters(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const countersByPhase = {};

  const col2Values = data.map(row => {
    const recordId = String(row[0]).trim();
    const marker   = String(row[8]).trim();

    if (recordId === "" || marker === STATS_MARKER) return [row[1]];

    const phase = String(row[7]).trim() || "غير محدد";
    if (!countersByPhase[phase]) countersByPhase[phase] = 0;
    countersByPhase[phase]++;
    return [countersByPhase[phase]];
  });

  sheet.getRange(2, 2, col2Values.length, 1).setValues(col2Values);
}

function getNextCounter(sheet, phase) {
  const data = sheet.getDataRange().getValues();
  const phaseRows = data.slice(1).filter(row =>
    String(row[0]).trim() !== "" &&
    String(row[7]).trim() === String(phase).trim() &&
    String(row[8]).trim() !== STATS_MARKER
  );
  return phaseRows.length + 1;
}

function findRowById(sheet, recordId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][8]).trim() === STATS_MARKER) continue;
    if (String(data[i][0]).trim() === String(recordId).trim()) return i + 1;
  }
  return -1;
}

function getOrCreateSpreadsheet() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  formatHeader(sheet);
  try { sheet.hideColumns(1); sheet.hideColumns(9); } catch (e) {}
  return sheet;
}

function formatHeader(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight("bold")
    .setBackground("#c8e6c9")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function sanitizeSheetName(name) {
  return String(name).replace(/[\/\\?\*\[\]':]/g, "_").substring(0, 100);
}

function normalizeDate(value) {
  if (!value) return "";
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  const text = String(value);
  if (text.includes("T")) {
    const d = new Date(text);
    if (!isNaN(d)) return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return text;
}

function normalizeTime(value) {
  if (!value) return "";
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "hh:mm a");
  const text = String(value);
  if (text.includes("T")) {
    const d = new Date(text);
    if (!isNaN(d)) return Utilities.formatDate(d, Session.getScriptTimeZone(), "hh:mm a");
  }
  return text;
}

function fixStats() {
  const ss = getOrCreateSpreadsheet();
  ss.getSheets().forEach(sheet => { refreshStats(sheet); });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
