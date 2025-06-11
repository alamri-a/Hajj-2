let startTime1, startTime2;
let timerInterval1, timerInterval2;
let count = 1;
let allDurations = [], withBiometric = [], withoutBiometric = [];

function startTimer(id) {
  const now = new Date();
  if (id === 1) {
    startTime1 = now;
    clearInterval(timerInterval1);
    timerInterval1 = setInterval(() => {
      const seconds = Math.floor((new Date() - startTime1) / 1000);
      document.getElementById("timer1").textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
    }, 1000);
  } else {
    startTime2 = now;
    clearInterval(timerInterval2);
    timerInterval2 = setInterval(() => {
      const seconds = Math.floor((new Date() - startTime2) / 1000);
      document.getElementById("timer2").textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
    }, 1000);
  }
}

function stopTimer(id) {
  if ((id === 1 && !startTime1) || (id === 2 && !startTime2)) {
    alert("يجب الضغط على زر البدء أولاً.");
    return;
  }

  if (id === 1) clearInterval(timerInterval1);
  else clearInterval(timerInterval2);

  const now = new Date();
  const duration = Math.floor((now - (id === 1 ? startTime1 : startTime2)) / 1000);
  const fingerprint = document.querySelector(`input[name="fingerprint${id}"]:checked`).value;

  const delayText = document.getElementById(`delayReason${id}`).value.trim();
  const selectedExtra = document.querySelector(`input[name="delayOption${id}"]:checked`);
  const extraReason = selectedExtra ? selectedExtra.value : "";

  let finalReason = "";
  if (delayText && extraReason) {
    finalReason = `${extraReason} - ${delayText}`;
  } else if (delayText) {
    finalReason = delayText;
  } else if (extraReason) {
    finalReason = extraReason;
  }

  allDurations.push(duration);
  if (fingerprint === "نعم") withBiometric.push(duration);
  else withoutBiometric.push(duration);

  const date = now.toLocaleDateString('en-GB');
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const row = document.getElementById("logTable").querySelector("tbody").insertRow();
  row.innerHTML = `
    <td>${count++}</td>
    <td>${date}</td>
    <td>${time}</td>
    <td>${duration}</td>
    <td>${fingerprint}</td>
    <td>${finalReason}</td>
  `;

  document.getElementById(`timer${id}`).textContent = "00:00";
  document.getElementById(`delayReason${id}`).value = "";
  if (selectedExtra) selectedExtra.checked = false;

  if (id === 1) startTime1 = null;
  else startTime2 = null;

  saveTableData();
  updateFooterStats();
}

function updateFooterStats() {
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const avg = arr => arr.length ? Math.round(sum(arr) / arr.length) : 0;
  const min = arr => arr.length ? Math.min(...arr) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;
  const total = allDurations.length;
  const withCount = withBiometric.length;
  const withoutCount = withoutBiometric.length;

  const percent = (val) => total ? Math.round((val / total) * 100) + "%" : "0%";

  document.getElementById("countWith").textContent = withCount;
  document.getElementById("countWithout").textContent = withoutCount;
  document.getElementById("countTotal").textContent = total;

  document.getElementById("avgWith").textContent = avg(withBiometric);
  document.getElementById("avgWithout").textContent = avg(withoutBiometric);
  document.getElementById("avgTotal").textContent = avg(allDurations);

  document.getElementById("minWith").textContent = min(withBiometric);
  document.getElementById("minWithout").textContent = min(withoutBiometric);
  document.getElementById("minTotal").textContent = min(allDurations);

  document.getElementById("maxWith").textContent = max(withBiometric);
  document.getElementById("maxWithout").textContent = max(withoutBiometric);
  document.getElementById("maxTotal").textContent = max(allDurations);

  document.getElementById("percentWith").textContent = percent(withCount);
  document.getElementById("percentWithout").textContent = percent(withoutCount);
}

function saveTableAsExcel() {
  const table = document.querySelector("#logTable");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.table_to_sheet(table, { raw: true });

  // ضبط اتجاه الورقة RTL
  worksheet["!cols"] = [];
  worksheet["A1"].s = { alignment: { readingOrder: 2 } };

  XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الحجاج");

  XLSX.writeFile(workbook, "سجل_الحجاج.xlsx", { bookType: "xlsx", type: "binary", compression: true });
}

function saveTableData() {
  const tbody = document.querySelector("#logTable tbody");
  localStorage.setItem("hajjTableRows", tbody.innerHTML);
}

function clearData() {
  const confirmed = confirm("هل أنت متأكد أنك تريد البدء من جديد؟ سيتم مسح جميع البيانات.");
  if (!confirmed) return;

  localStorage.removeItem("hajjTableRows");
  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML = "";
  count = 1;
  allDurations = [];
  withBiometric = [];
  withoutBiometric = [];
  document.getElementById("timer1").textContent = "00:00";
  document.getElementById("timer2").textContent = "00:00";
  updateFooterStats();
}

function undoLastEntry() {
  const tbody = document.querySelector("#logTable tbody");
  const lastRow = tbody.lastElementChild;
  if (!lastRow) return;
  const duration = parseInt(lastRow.cells[3]?.textContent.trim());
  const biometric = lastRow.cells[4]?.textContent.trim();
  if (!isNaN(duration)) {
    allDurations.pop();
    if (biometric === "نعم") withBiometric.pop();
    else withoutBiometric.pop();
  }
  tbody.removeChild(lastRow);
  count = Math.max(1, count - 1);
  updateRowNumbers(); // تحديث عمود التعداد
  saveTableData();
  updateFooterStats();
}

function deleteRowByNumber() {
  const rowNum = parseInt(document.getElementById("rowToDelete").value);
  if (!rowNum || rowNum < 1) return alert("أدخل رقم صف صحيح");

  const tbody = document.querySelector("#logTable tbody");
  const rows = Array.from(tbody.rows);
  const rowIndex = rows.findIndex(row => parseInt(row.cells[0].textContent) === rowNum);
  if (rowIndex === -1) return alert("لم يتم العثور على الصف");
  if (!confirm("هل أنت متأكد من حذف الصف؟")) return;

  const row = rows[rowIndex];
  const duration = parseInt(row.cells[3].textContent.trim());
  const biometric = row.cells[4].textContent.trim();

  allDurations = allDurations.filter(d => d !== duration);
  if (biometric === "نعم") withBiometric = withBiometric.filter(d => d !== duration);
  else withoutBiometric = withoutBiometric.filter(d => d !== duration);

  tbody.deleteRow(rowIndex);
  updateRowNumbers(); // تحديث عمود التعداد
  saveTableData();
  updateFooterStats();
}

document.addEventListener("DOMContentLoaded", () => {
  const savedRows = localStorage.getItem("hajjTableRows");
  if (savedRows) {
    const tbody = document.querySelector("#logTable tbody");
    tbody.innerHTML = savedRows;
    count = tbody.rows.length + 1;

    allDurations = [];
    withBiometric = [];
    withoutBiometric = [];

    tbody.querySelectorAll("tr").forEach(row => {
      const duration = parseInt(row.cells[3]?.textContent.trim());
      const biometric = row.cells[4]?.textContent.trim();
      if (!isNaN(duration)) {
        allDurations.push(duration);
        if (biometric === "نعم") withBiometric.push(duration);
        else if (biometric === "لا") withoutBiometric.push(duration);
      }
    });
    updateFooterStats();
  }
});

function updateRowNumbers() {
  const rows = document.querySelectorAll("#logTable tbody tr");
  rows.forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
}
