// =====================================================
// Hajj-2 Google Apps Script Web App
// Deploy as: Execute as "Me", Access "Anyone"
// =====================================================

const SPREADSHEET_NAME = "Hajj-2 Data";
const STATS_MARKER = "STATS_SECTION"; // علامة داخلية تُميّز صفوف الإحصائيات
const HEADERS = [
  "recordId", "التعداد", "التاريخ", "الساعة",
  "المدة بالثواني", "مسجل له بصمة سابقًا؟", "سبب التأخير", "المرحلة"
];

function doGet(e) {
  try {
    const checkpoint = e.parameter.checkpoint;
    const phase = e.parameter.phase;

    if (!checkpoint || !phase) {
      return jsonResponse({ status: "error", message: "checkpoint و phase مطلوبان" });
    }

    const ss = getOrCreateSpreadsheet();
    const sheetName = sanitizeSheetName(checkpoint);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return jsonResponse({ status: "ok", records: [] });
    }

    const sheetData = sheet.getDataRange().getValues();
    if (sheetData.length <= 1) {
      return jsonResponse({ status: "ok", records: [] });
    }

    const headers = sheetData[0];
    const records = [];

    for (let i = 1; i < sheetData.length; i++) {
      // تخطّ صفوف الإحصائيات
      if ((sheetData[i][8] || "") === STATS_MARKER) continue;

      const row = sheetData[i];
      const record = {};
      headers.forEach((h, j) => { record[h] = row[j]; });

      if (record["المرحلة"] === phase) {
        records.push({
          recordId:    String(record["recordId"]),
          counter:     record["التعداد"],
          date:        record["التاريخ"],
          time:        record["الساعة"],
          duration:    Number(record["المدة بالثواني"]),
          biometric:   record["مسجل له بصمة سابقًا؟"],
          delayReason: record["سبب التأخير"],
          phase:       record["المرحلة"]
        });
      }
    }

    return jsonResponse({ status: "ok", records });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const payload    = JSON.parse(e.postData.contents);
    const action     = payload.action;
    const checkpoint = payload.checkpoint;
    const phase      = payload.phase;

    if (!action || !checkpoint || !phase) {
      return jsonResponse({ status: "error", message: "action و checkpoint و phase مطلوبة" });
    }

    const ss        = getOrCreateSpreadsheet();
    const sheetName = sanitizeSheetName(checkpoint);

    // ── إضافة سجل ──
    if (action === "add") {
      const sheet  = getOrCreateSheet(ss, sheetName);
      const record = payload.record;

      // أدرج الصف قبل قسم الإحصائيات إن وجد، وإلا أضفه في النهاية
      const statsStart = findStatsStartRow(sheet);
      if (statsStart === -1) {
        sheet.appendRow([
          record.recordId, record.counter, record.date, record.time,
          record.duration, record.biometric, record.delayReason, phase
        ]);
      } else {
        sheet.insertRowBefore(statsStart);
        sheet.getRange(statsStart, 1, 1, 8).setValues([[
          record.recordId, record.counter, record.date, record.time,
          record.duration, record.biometric, record.delayReason, phase
        ]]);
      }

      refreshStats(sheet);
      return jsonResponse({ status: "ok", message: "تمت الإضافة" });
    }

    // ── حذف سجل محدد ──
    if (action === "delete") {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ status: "ok", message: "not found" });

      const rowIndex = findRowById(sheet, payload.recordId);
      if (rowIndex === -1) return jsonResponse({ status: "ok", message: "not found" });

      sheet.deleteRow(rowIndex);
      refreshStats(sheet);
      return jsonResponse({ status: "ok", message: "تم الحذف" });
    }

    // ── مسح كل بيانات منفذ + مرحلة ──
    if (action === "reset") {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ status: "ok", message: "لا توجد بيانات" });

      const sheetData = sheet.getDataRange().getValues();
      for (let i = sheetData.length; i >= 2; i--) {
        if ((sheetData[i - 1][8] || "") === STATS_MARKER) continue;
        if (sheetData[i - 1][7] === phase) {
          sheet.deleteRow(i);
        }
      }

      refreshStats(sheet);
      return jsonResponse({ status: "ok", message: "تم المسح" });
    }

    return jsonResponse({ status: "error", message: "action غير معروف: " + action });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════
// الملخص الإحصائي التلقائي في الـ Sheet
// ══════════════════════════════════════════

function refreshStats(sheet) {
  const allData = sheet.getDataRange().getValues();

  // إيجاد آخر صف بيانات حقيقي (تخطّ صفوف الإحصائيات)
  let lastDataRow = 1;
  for (let i = 1; i < allData.length; i++) {
    if ((allData[i][8] || "") === STATS_MARKER) continue;
    if (String(allData[i][0]).trim() !== "") {
      lastDataRow = i + 1; // 1-indexed
    }
  }

  // مسح كل شيء بعد آخر صف بيانات
  const sheetLastRow = sheet.getLastRow();
  if (sheetLastRow > lastDataRow) {
    sheet.getRange(lastDataRow + 1, 1, sheetLastRow - lastDataRow, 9).clear();
  }

  // جمع صفوف البيانات الفعلية
  const dataRows = allData.slice(1).filter(row =>
    (row[8] || "") !== STATS_MARKER && String(row[0]).trim() !== ""
  );

  if (dataRows.length === 0) return;

  // المراحل الموجودة في البيانات
  const phases = [...new Set(dataRows.map(r => r[7]).filter(Boolean))];

  let writeRow = lastDataRow + 2;

  for (const phase of phases) {
    const phaseRows  = dataRows.filter(r => r[7] === phase);
    const withBio    = phaseRows.filter(r => r[5] === "نعم").map(r => Number(r[4])).filter(n => !isNaN(n));
    const withoutBio = phaseRows.filter(r => r[5] === "لا").map(r => Number(r[4])).filter(n => !isNaN(n));
    const allDur     = phaseRows.map(r => Number(r[4])).filter(n => !isNaN(n));

    const avg     = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const safeMin = arr => arr.length ? Math.min(...arr) : 0;
    const safeMax = arr => arr.length ? Math.max(...arr) : 0;
    const pct     = (n, tot) => tot ? Math.round(n / tot * 100) + "%" : "0%";
    const total   = allDur.length;

    // عنوان المرحلة
    sheet.getRange(writeRow, 1, 1, 8).merge()
      .setValue("📊 ملخص إحصائي — " + phase)
      .setBackground("#1b5e20").setFontColor("white")
      .setFontWeight("bold").setFontSize(12)
      .setHorizontalAlignment("center");
    sheet.getRange(writeRow, 9).setValue(STATS_MARKER);
    writeRow++;

    // رؤوس الأعمدة
    sheet.getRange(writeRow, 1, 1, 6).setValues([["الفئة", "عدد الحجاج", "متوسط الزمن (ثانية)", "الزمن الأدنى (ثانية)", "الزمن الأعلى (ثانية)", "النسبة من الإجمالي"]])
      .setBackground("#a5d6a7").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange(writeRow, 9).setValue(STATS_MARKER);
    writeRow++;

    // صفوف الإحصائيات
    const statsData = [
      ["المسجل لهم بصمة",      withBio.length,    avg(withBio),    safeMin(withBio),    safeMax(withBio),    pct(withBio.length, total)],
      ["غير المسجل لهم بصمة", withoutBio.length, avg(withoutBio), safeMin(withoutBio), safeMax(withoutBio), pct(withoutBio.length, total)],
      ["الإجمالي",              total,             avg(allDur),     safeMin(allDur),     safeMax(allDur),     "—"]
    ];

    sheet.getRange(writeRow, 1, statsData.length, 6).setValues(statsData)
      .setBackground("#e8f5e9").setHorizontalAlignment("center");
    // تمييز صف الإجمالي
    sheet.getRange(writeRow + 2, 1, 1, 6).setBackground("#c8e6c9").setFontWeight("bold");

    for (let r = 0; r < statsData.length; r++) {
      sheet.getRange(writeRow + r, 9).setValue(STATS_MARKER);
    }

    writeRow += statsData.length + 2;
  }
}

function findStatsStartRow(sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][8] || "") === STATS_MARKER) return i + 1; // 1-indexed
  }
  return -1;
}

// ── دوال مساعدة ──

function getOrCreateSpreadsheet() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#c8e6c9");
  }
  // عمود recordId داخلي للنظام فقط - يُخفى عن المستخدم
  sheet.hideColumns(1);
  return sheet;
}

function sanitizeSheetName(name) {
  return name.replace(/[\/\\?\*\[\]':]/g, "_").substring(0, 100);
}

function findRowById(sheet, recordId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][8] || "") === STATS_MARKER) continue;
    if (String(data[i][0]) === String(recordId)) {
      return i + 1;
    }
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
