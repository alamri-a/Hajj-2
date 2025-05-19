let startTime1;
let timerInterval1;
let count = 1;
let allDurations = [];
let withBiometric = [];
let withoutBiometric = [];

function startTimer(id) {
  startTime1 = new Date();
  document.getElementById("timer1").textContent = "00:00";
  clearInterval(timerInterval1);
  timerInterval1 = setInterval(() => {
    const seconds = Math.floor((new Date() - startTime1) / 1000);
    document.getElementById("timer1").textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
  }, 1000);
}

function stopTimer(id) {
  clearInterval(timerInterval1);
  const now = new Date();
  const duration = Math.floor((now - startTime1) / 1000);
  const fingerprint = document.querySelector(`input[name="fingerprint1"]:checked`).value;
  const delayReason = document.getElementById(`delayReason1`).value;
  allDurations.push(duration);
  if (fingerprint === "نعم") withBiometric.push(duration);
  else withoutBiometric.push(duration);
  updateAverage();
  updateBiometricStats();

  const date = now.toLocaleDateString('ar-EG');
  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const table = document.getElementById("logTable").querySelector("tbody");
  const newRow = table.insertRow();
  newRow.innerHTML = `
    <td>${count++}</td>
    <td>${date}</td>
    <td>${time}</td>
    <td>${duration}</td>
    <td>${fingerprint}</td>
    <td>${delayReason}</td>
  `;
  document.getElementById("timer1").textContent = "00:00";
  document.getElementById("delayReason1").value = "";
  saveToLocalStorage();
}

function updateAverage() {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  document.getElementById("unifiedAverageRow").textContent =
    `متوسط الزمن العام: ${avg(allDurations)} ثانية — مسجل لهم بصمه: ${avg(withBiometric)} ثانية — غير مسجل لهم: ${avg(withoutBiometric)} ثانية`;
}

function updateBiometricStats() {
  const total = withBiometric.length + withoutBiometric.length;
  const percent = v => total ? Math.round((v / total) * 100) : 0;
  document.getElementById("percentStats").textContent =
    `نسبة المسجل لهم بصمة: ${percent(withBiometric.length)}% — غير المسجلين: ${percent(withoutBiometric.length)}%`;
}

function saveToLocalStorage() {
  const rows = Array.from(document.querySelector("#logTable").querySelector("tbody").rows).map(row =>
    Array.from(row.cells).map(cell => cell.textContent)
  );
  localStorage.setItem("hajjData", JSON.stringify(rows));
  localStorage.setItem("hajjCount", count);
}

document.addEventListener("DOMContentLoaded", function () {
  const saved = localStorage.getItem("hajjData");
  const savedCount = localStorage.getItem("hajjCount");
  if (saved && savedCount) {
    const rows = JSON.parse(saved);
    count = parseInt(savedCount);
    const tbody = document.getElementById("logTable").querySelector("tbody");
    rows.forEach(cells => {
      const newRow = tbody.insertRow();
      newRow.innerHTML = cells.map(cell => `<td>${cell}</td>`).join("");
    });
    updateAverage();
    updateBiometricStats();
  }
};

function clearData() {
  if (confirm("هل أنت متأكد أنك تريد مسح كل البيانات؟")) {
    localStorage.removeItem("hajjData");
    localStorage.removeItem("hajjCount");
    document.querySelector("#logTable").querySelector("tbody").innerHTML = "";
    document.getElementById("unifiedAverageRow").textContent =
      "متوسط الزمن العام: 0 ثانية — مسجل لهم بصمه: 0 ثانية — غير مسجل لهم: 0 ثانية";
    document.getElementById("percentStats").textContent =
      "نسبة المسجل لهم بصمة: 0% — غير المسجلين: 0%";
    count = 1;
    allDurations = [];
    withBiometric = [];
    withoutBiometric = [];
  }
}

function saveAsPDF() {
  const doc = new jspdf.jsPDF();
  const table = document.getElementById("logTable");
  const rows = Array.from(table.querySelectorAll("tbody tr")).map(row =>
    Array.from(row.cells).map(cell => cell.innerText)
  );
  const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.innerText);
  doc.text("سجل الحجاج", 14, 10);
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 20
  });
  doc.save("سجل_الحجاج.pdf");
}

function saveAsExcel() {
  let csv = "";
  const rows = document.querySelectorAll("table tr");
  rows.forEach(row => {
    const cols = row.querySelectorAll("th, td");
    const rowData = Array.from(cols).map(col => `"${col.innerText}"`);
    csv += rowData.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "سجل_الحجاج.csv";
  a.click();
  URL.revokeObjectURL(url);
}
