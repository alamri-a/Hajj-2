// =====================================================
// Hajj-2 Google Apps Script Web App
// Deploy as: Execute as "Me", Access "Anyone"
// =====================================================

const SPREADSHEET_NAME = "Hajj-2 Data";
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

    const payload = JSON.parse(e.postData.contents);
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
      sheet.appendRow([
        record.recordId,
        record.counter,
        record.date,
        record.time,
        record.duration,
        record.biometric,
        record.delayReason,
        phase
      ]);
      return jsonResponse({ status: "ok", message: "تمت الإضافة" });
    }

    // ── حذف سجل محدد ──
    if (action === "delete") {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ status: "ok", message: "not found" });

      const rowIndex = findRowById(sheet, payload.recordId);
      if (rowIndex === -1) return jsonResponse({ status: "ok", message: "not found" });

      sheet.deleteRow(rowIndex);
      return jsonResponse({ status: "ok", message: "تم الحذف" });
    }

    // ── مسح كل بيانات منفذ + مرحلة ──
    if (action === "reset") {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ status: "ok", message: "لا توجد بيانات" });

      const sheetData = sheet.getDataRange().getValues();
      // احذف من الأسفل لتجنب إزاحة الصفوف
      for (let i = sheetData.length; i >= 2; i--) {
        if (sheetData[i - 1][7] === phase) {
          sheet.deleteRow(i);
        }
      }
      return jsonResponse({ status: "ok", message: "تم المسح" });
    }

    return jsonResponse({ status: "error", message: "action غير معروف: " + action });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
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
    // تنسيق رأس الجدول
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#c8e6c9");
  }
  return sheet;
}

function sanitizeSheetName(name) {
  // Google Sheets لا تسمح بـ: / \ ? * [ ] :
  return name.replace(/[\/\\?\*\[\]':]/g, "_").substring(0, 100);
}

function findRowById(sheet, recordId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(recordId)) {
      return i + 1; // رقم الصف (1-indexed)
    }
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
