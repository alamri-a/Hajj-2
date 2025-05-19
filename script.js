let startTime1, startTime2;
let timerInterval1, timerInterval2;
let count = 1;
let allDurations = [], withBiometric = [], withoutBiometric = [];

function startTimer(id) {
  const timer = document.getElementById("timer" + id);
  if (id === 1) startTime1 = new Date();
  else startTime2 = new Date();
  clearInterval(id === 1 ? timerInterval1 : timerInterval2);
  (id === 1 ? timerInterval1 : timerInterval2) = setInterval(() => {
    const start = id === 1 ? startTime1 : startTime2;
    const seconds = Math.floor((new Date() - start) / 1000);
    timer.textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
  }, 1000);
}

function stopTimer(id) {
  const now = new Date();
  const duration = Math.floor((now - (id === 1 ? startTime1 : startTime2)) / 1000);
  const fingerprint = document.querySelector(`input[name="fingerprint${id}"]:checked`).value;
  const delayReason = document.getElementById(`delayReason${id}`).value;
  const date = now.toLocaleDateString('ar-EG');
  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  allDurations.push(duration);
  if (fingerprint === "نعم") withBiometric.push(duration);
  else withoutBiometric.push(duration);

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

  document.getElementById("timer" + id).textContent = "00:00";
  document.getElementById("delayReason" + id).value = "";

  updateAverage();
  updateBiometricStats();
  saveToLocalStorage();
}

function updateAverage() {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  document.getElementById("avgStats").textContent =
    `متوسط الزمن العام: ${avg(allDurations)} ثانية — مسجل لهم بصمه: ${avg(withBiometric)} ثانية — غير مسجل لهم: ${avg(withoutBiometric)} ثانية`;
}

function updateBiometricStats() {
  const total = withBiometric.length + withoutBiometric.length;
  const percent = val => total ? Math.round((val / total) * 100) : 0;
  document.getElementById("percentStats").textContent =
    `نسبة المسجل لهم بصمة: ${percent(withBiometric.length)}% | نسبة غير المسجل لهم: ${percent(withoutBiometric.length)}%`;
}

function saveToLocalStorage() {
  const rows = Array.from(document.querySelector("#logTable tbody").rows).map(row =>
    Array.from(row.cells).map(cell => cell.textContent));
  localStorage.setItem("hajjData", JSON.stringify(rows));
  localStorage.setItem("hajjCount", count);
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem("hajjData");
  const savedCount = localStorage.getItem("hajjCount");
  if (saved && savedCount) {
    const rows = JSON.parse(saved);
    const tbody = document.querySelector("#logTable tbody");
    count = parseInt(savedCount);
    rows.forEach(cells => {
      const row = tbody.insertRow();
      row.innerHTML = cells.map(cell => `<td>${cell}</td>`).join("");
      const duration = parseInt(cells[3]);
      allDurations.push(duration);
      if (cells[4] === "نعم") withBiometric.push(duration);
      else withoutBiometric.push(duration);
    });
    updateAverage();
    updateBiometricStats();
  }
}

function clearData() {
  if (confirm("هل أنت متأكد أنك تريد مسح كل البيانات؟")) {
    localStorage.clear();
    document.querySelector("#logTable tbody").innerHTML = "";
    document.getElementById("avgStats").textContent = "متوسط الزمن العام: 0 ثانية — مسجل لهم بصمه: 0 ثانية — غير مسجل لهم: 0 ثانية";
    document.getElementById("percentStats").textContent = "نسبة المسجل لهم بصمة: 0% | نسبة غير المسجل لهم: 0%";
    count = 1;
    allDurations = [];
    withBiometric = [];
    withoutBiometric = [];
  }
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

document.addEventListener("DOMContentLoaded", loadFromLocalStorage);