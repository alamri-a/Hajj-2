// ضع هنا رابط Web App بعد نشر Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbx8tdZwe9LV3fdojITj0hHkDw0nQvcYxhIgtIdgYergd4bdFSmaTsnpiSD0CORGqA1M/exec";

let startTime1, startTime2;
let timerInterval1, timerInterval2;
let allDurations = [], withBiometric = [], withoutBiometric = [];
let currentCheckpoint = "";
let currentPhase = "";
let pendingSyncQueue = [];
let pendingDeleteQueue = [];
let timer2Visible = false;

// ══════════════════════════════════════════
// إعداد المنفذ والمرحلة
// ══════════════════════════════════════════

function showSetupModal() {
  document.getElementById("setupModal").style.display = "flex";
}

function saveSetupChoice() {
  const select = document.getElementById("checkpointSelect").value;
  const custom = document.getElementById("checkpointCustom").value.trim();
  const phase  = document.querySelector('input[name="phaseSelect"]:checked')?.value;

  const checkpoint = custom || select;

  if (!checkpoint) {
    alert("الرجاء اختيار المنفذ أو إدخال اسمه.");
    return;
  }
  if (!phase) {
    alert("الرجاء اختيار المرحلة.");
    return;
  }

  // إذا تغيّر المنفذ أو المرحلة امسح البيانات المحلية (للمنافذ العادية فقط)
  if (checkpoint !== "__summary__" && (checkpoint !== currentCheckpoint || phase !== currentPhase)) {
    document.querySelector("#logTable tbody").innerHTML = "";
    allDurations       = [];
    withBiometric      = [];
    withoutBiometric   = [];
    localStorage.removeItem("hajjTableRows");
    updateFooterStats();
  }

  currentCheckpoint = checkpoint;
  currentPhase      = phase;
  localStorage.setItem("hajjCheckpoint", checkpoint);
  localStorage.setItem("hajjPhase", phase);

  document.getElementById("setupModal").style.display = "none";
  updateStatusBar();

  if (checkpoint === "__summary__") {
    document.getElementById("mainContent").style.display = "none";
    document.getElementById("summaryView").style.display = "block";
    loadSummaryData(phase);
    return;
  }

  document.getElementById("mainContent").style.display = "";
  document.getElementById("summaryView").style.display = "none";
  loadFromLocalStorage();
}

async function loadSummaryData(phase) {
  const ids = ["sc-total","sc-avg","sc-min","sc-max","sc-bio"];
  document.getElementById("summaryPhaseLabel").textContent = "المرحلة: " + phase;
  ids.forEach(id => { document.getElementById(id).textContent = "..."; });

  if (API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
    ids.forEach(id => { document.getElementById(id).textContent = "—"; });
    return;
  }

  try {
    const res  = await fetch(API_URL + "?action=getSummary&phase=" + encodeURIComponent(phase));
    const json = await res.json();
    if (json.status === "ok" && json.data) {
      const d = json.data;
      document.getElementById("sc-total").textContent = d.total;
      document.getElementById("sc-avg").textContent   = d.avg;
      document.getElementById("sc-min").textContent   = d.min;
      document.getElementById("sc-max").textContent   = d.max;
      document.getElementById("sc-bio").textContent   = d.bioPct;
    } else {
      ids.forEach(id => { document.getElementById(id).textContent = "خطأ"; });
    }
  } catch(err) {
    ids.forEach(id => { document.getElementById(id).textContent = "خطأ"; });
  }
}

function updateStatusBar() {
  const label = currentCheckpoint === "__summary__" ? "ملخص الأداء" : currentCheckpoint;
  document.getElementById("statusCheckpoint").textContent = label;
  document.getElementById("statusPhase").textContent      = currentPhase;
  document.getElementById("statusBar").style.display      = "flex";
}

// ══════════════════════════════════════════
// التايمر الثاني - إظهار/إخفاء
// ══════════════════════════════════════════

function toggleTimer2() {
  timer2Visible = !timer2Visible;
  const section = document.getElementById("timer2Section");
  const btn     = document.getElementById("toggleTimer2Btn");
  section.style.display = timer2Visible ? "block" : "none";
  btn.textContent       = timer2Visible ? "－ إخفاء التايمر الثاني" : "＋ إظهار التايمر الثاني";
  localStorage.setItem("hajjTimer2Visible", timer2Visible ? "1" : "0");
}

// ══════════════════════════════════════════
// معرّف السجل الفريد
// ══════════════════════════════════════════

function generateRecordId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ══════════════════════════════════════════
// التايمر
// ══════════════════════════════════════════

function startTimer(id) {
  const now = new Date();
  if (id === 1) {
    startTime1 = now;
    clearInterval(timerInterval1);
    timerInterval1 = setInterval(() => {
      const s = Math.floor((new Date() - startTime1) / 1000);
      document.getElementById("timer1").textContent = `00:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
  } else {
    startTime2 = now;
    clearInterval(timerInterval2);
    timerInterval2 = setInterval(() => {
      const s = Math.floor((new Date() - startTime2) / 1000);
      document.getElementById("timer2").textContent = `00:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
  }
}

function stopTimer(id) {
  if ((id === 1 && !startTime1) || (id === 2 && !startTime2)) {
    alert("يجب الضغط على زر البدء أولاً.");
    return;
  }

  if (id === 1) clearInterval(timerInterval1);
  else          clearInterval(timerInterval2);

  const now         = new Date();
  const duration    = Math.floor((now - (id === 1 ? startTime1 : startTime2)) / 1000);
  const fingerprint = document.querySelector(`input[name="fingerprint${id}"]:checked`).value;
  const delayText   = document.getElementById(`delayReason${id}`).value.trim();
  const selectedExtra = document.querySelector(`input[name="delayOption${id}"]:checked`);
  const extraReason   = selectedExtra ? selectedExtra.value : "";

  let finalReason = "";
  if (delayText && extraReason)      finalReason = `${extraReason} - ${delayText}`;
  else if (delayText)                finalReason = delayText;
  else if (extraReason)              finalReason = extraReason;

  allDurations.push(duration);
  if (fingerprint === "نعم") withBiometric.push(duration);
  else                        withoutBiometric.push(duration);

  const date = now.toLocaleDateString('en-GB');
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const tbody    = document.querySelector("#logTable tbody");
  const rowNum   = tbody.rows.length + 1;
  const recordId = generateRecordId();

  const row = tbody.insertRow();
  row.dataset.recordId = recordId;
  row.innerHTML = `
    <td>${rowNum}</td>
    <td>${date}</td>
    <td>${time}</td>
    <td>${duration}</td>
    <td>${fingerprint}</td>
    <td>${finalReason}</td>
  `;

  document.getElementById(`timer${id}`).textContent    = "00:00";
  document.getElementById(`delayReason${id}`).value   = "";
  if (selectedExtra) selectedExtra.checked = false;
  if (id === 1) startTime1 = null;
  else          startTime2 = null;

  saveTableData();
  updateFooterStats();

  syncToGoogleSheets({
    recordId, counter: rowNum, date, time,
    duration, biometric: fingerprint, delayReason: finalReason,
    phase: currentPhase
  });
}

function loadFromLocalStorage() {
  const savedRows = localStorage.getItem("hajjTableRows");
  if (!savedRows) return;

  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML  = savedRows;
  allDurations     = [];
  withBiometric    = [];
  withoutBiometric = [];

  tbody.querySelectorAll("tr").forEach(row => {
    const dur      = parseInt(row.cells[3]?.textContent.trim());
    const biometric = row.cells[4]?.textContent.trim();
    if (!isNaN(dur)) {
      allDurations.push(dur);
      if (biometric === "نعم")      withBiometric.push(dur);
      else if (biometric === "لا") withoutBiometric.push(dur);
    }
  });

  updateFooterStats();
  updateRowNumbers();
}

// ══════════════════════════════════════════
// Google Sheets - إرسال / حذف / مسح
// ══════════════════════════════════════════

async function syncToGoogleSheets(record) {
  if (!currentCheckpoint || !currentPhase || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", checkpoint: currentCheckpoint, phase: currentPhase, record })
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (data.status !== "ok") throw new Error(data.message);
  } catch (err) {
    console.warn("فشل الإرسال، يُحفظ مؤقتاً:", err);
    pendingSyncQueue.push({ checkpoint: currentCheckpoint, phase: currentPhase, record });
    localStorage.setItem("hajjPendingQueue", JSON.stringify(pendingSyncQueue));
  }
}

async function deleteFromGoogleSheets(recordId) {
  if (!recordId || !currentCheckpoint || !currentPhase || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete", checkpoint: currentCheckpoint, phase: currentPhase, recordId })
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
  } catch (err) {
    console.warn("فشل الحذف من Sheets:", err);
    pendingDeleteQueue.push({ checkpoint: currentCheckpoint, phase: currentPhase, recordId });
    localStorage.setItem("hajjPendingDeleteQueue", JSON.stringify(pendingDeleteQueue));
  }
}

async function resetGoogleSheets() {
  if (!currentCheckpoint || !currentPhase || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "reset", checkpoint: currentCheckpoint, phase: currentPhase })
    });
  } catch (err) {
    console.warn("فشل مسح Sheets:", err);
  }
}

// ══════════════════════════════════════════
// قوائم الانتظار (offline sync)
// ══════════════════════════════════════════

async function processPendingQueue() {
  if (!pendingSyncQueue.length || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;

  const queue = [...pendingSyncQueue];
  for (const item of queue) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "add", ...item })
      });
      if (!response.ok) break;
      pendingSyncQueue.shift();
      localStorage.setItem("hajjPendingQueue", JSON.stringify(pendingSyncQueue));
    } catch (err) {
      break;
    }
  }
}

async function processPendingDeleteQueue() {
  if (!pendingDeleteQueue.length || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;

  const queue = [...pendingDeleteQueue];
  for (const item of queue) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", ...item })
      });
      if (!response.ok) break;
      pendingDeleteQueue.shift();
      localStorage.setItem("hajjPendingDeleteQueue", JSON.stringify(pendingDeleteQueue));
    } catch (err) {
      break;
    }
  }
}

// ══════════════════════════════════════════
// الإحصائيات
// ══════════════════════════════════════════

function updateFooterStats() {
  const sum     = arr => arr.reduce((a, b) => a + b, 0);
  const avg     = arr => arr.length ? Math.round(sum(arr) / arr.length) : 0;
  const min     = arr => arr.length ? Math.min(...arr) : 0;
  const max     = arr => arr.length ? Math.max(...arr) : 0;
  const total      = allDurations.length;
  const withCount  = withBiometric.length;
  const withoutCount = withoutBiometric.length;
  const percent  = val => total ? Math.round((val / total) * 100) + "%" : "0%";

  document.getElementById("countWith").textContent    = withCount;
  document.getElementById("countWithout").textContent = withoutCount;
  document.getElementById("countTotal").textContent   = total;

  document.getElementById("avgWith").textContent    = avg(withBiometric);
  document.getElementById("avgWithout").textContent = avg(withoutBiometric);
  document.getElementById("avgTotal").textContent   = avg(allDurations);

  document.getElementById("minWith").textContent    = min(withBiometric);
  document.getElementById("minWithout").textContent = min(withoutBiometric);
  document.getElementById("minTotal").textContent   = min(allDurations);

  document.getElementById("maxWith").textContent    = max(withBiometric);
  document.getElementById("maxWithout").textContent = max(withoutBiometric);
  document.getElementById("maxTotal").textContent   = max(allDurations);

  document.getElementById("percentWith").textContent    = percent(withCount);
  document.getElementById("percentWithout").textContent = percent(withoutCount);
}

// ══════════════════════════════════════════
// التصدير Excel
// ══════════════════════════════════════════

function saveTableAsExcel() {
  const table    = document.querySelector("#logTable");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.table_to_sheet(table, { raw: true });

  worksheet["!cols"] = [];
  if (worksheet["A1"]) worksheet["A1"].s = { alignment: { readingOrder: 2 } };

  const filename = currentCheckpoint
    ? `سجل_${currentCheckpoint}_${currentPhase}.xlsx`
    : "سجل_الحجاج.xlsx";

  XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الحجاج");
  XLSX.writeFile(workbook, filename, { bookType: "xlsx", type: "binary", compression: true });
}

// ══════════════════════════════════════════
// الحفظ المحلي
// ══════════════════════════════════════════

function saveTableData() {
  const tbody = document.querySelector("#logTable tbody");
  localStorage.setItem("hajjTableRows", tbody.innerHTML);
}

// ══════════════════════════════════════════
// مسح / تراجع / حذف صف
// ══════════════════════════════════════════

function undoLastEntry() {
  const tbody   = document.querySelector("#logTable tbody");
  const lastRow = tbody.lastElementChild;
  if (!lastRow) return;

  const duration  = parseInt(lastRow.cells[3]?.textContent.trim());
  const biometric = lastRow.cells[4]?.textContent.trim();
  const recordId  = lastRow.dataset.recordId;

  if (!isNaN(duration)) {
    allDurations.pop();
    if (biometric === "نعم") withBiometric.pop();
    else                      withoutBiometric.pop();
  }

  tbody.removeChild(lastRow);
  updateRowNumbers();
  saveTableData();
  updateFooterStats();

  if (recordId) deleteFromGoogleSheets(recordId);
}

function deleteRowByNumber() {
  const rowNum = parseInt(document.getElementById("rowToDelete").value);
  if (!rowNum || rowNum < 1) return alert("أدخل رقم صف صحيح");

  const tbody    = document.querySelector("#logTable tbody");
  const rows     = Array.from(tbody.rows);
  const rowIndex = rows.findIndex(row => parseInt(row.cells[0].textContent) === rowNum);
  if (rowIndex === -1) return alert("لم يتم العثور على الصف");
  if (!confirm("هل أنت متأكد من حذف الصف؟")) return;

  const row      = rows[rowIndex];
  const duration = parseInt(row.cells[3].textContent.trim());
  const biometric = row.cells[4].textContent.trim();
  const recordId  = row.dataset.recordId;

  allDurations = allDurations.filter(d => d !== duration);
  if (biometric === "نعم") withBiometric      = withBiometric.filter(d => d !== duration);
  else                      withoutBiometric   = withoutBiometric.filter(d => d !== duration);

  tbody.deleteRow(rowIndex);
  updateRowNumbers();
  saveTableData();
  updateFooterStats();

  if (recordId) deleteFromGoogleSheets(recordId);
}

// ══════════════════════════════════════════
// تحديث أرقام الصفوف
// ══════════════════════════════════════════

function updateRowNumbers() {
  document.querySelectorAll("#logTable tbody tr").forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
}

// ══════════════════════════════════════════
// التهيئة عند تحميل الصفحة
// ══════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  // استعادة قوائم الانتظار
  pendingSyncQueue   = JSON.parse(localStorage.getItem("hajjPendingQueue")       || "[]");
  pendingDeleteQueue = JSON.parse(localStorage.getItem("hajjPendingDeleteQueue") || "[]");

  // استعادة حالة التايمر الثاني
  if (localStorage.getItem("hajjTimer2Visible") === "1") {
    timer2Visible = false;
    toggleTimer2();
  }

  // التحقق من المنفذ والمرحلة المحفوظَين
  const savedCheckpoint = localStorage.getItem("hajjCheckpoint");
  const savedPhase      = localStorage.getItem("hajjPhase");

  if (savedCheckpoint && savedPhase) {
    currentCheckpoint = savedCheckpoint;
    currentPhase      = savedPhase;
    const selectEl = document.getElementById("checkpointSelect");
    const isKnown  = Array.from(selectEl.options).some(o => o.value === savedCheckpoint);
    if (isKnown) {
      selectEl.value = savedCheckpoint;
    } else {
      document.getElementById("checkpointCustom").value = savedCheckpoint;
    }
    const phaseRadio = document.querySelector(`input[name="phaseSelect"][value="${savedPhase}"]`);
    if (phaseRadio) phaseRadio.checked = true;

    document.getElementById("setupModal").style.display = "none";
    updateStatusBar();

    if (savedCheckpoint === "__summary__") {
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("summaryView").style.display = "block";
      loadSummaryData(savedPhase);
    } else {
      loadFromLocalStorage();
      processPendingQueue();
      processPendingDeleteQueue();
    }
  } else {
    document.getElementById("setupModal").style.display = "flex";
  }
});
