let timers = {};
let count = 1;
let allRows = [];
let withBio = 0;
let withoutBio = 0;

function startTimer(id) {
  timers[id] = { start: new Date() };
  document.getElementById("timer" + id).textContent = "00:00";
  if (timers[id].interval) clearInterval(timers[id].interval);
  timers[id].interval = setInterval(() => {
    const seconds = Math.floor((new Date() - timers[id].start) / 1000);
    document.getElementById("timer" + id).textContent = "00:" + (seconds < 10 ? "0" : "") + seconds;
  }, 1000);
}

function stopTimer(id) {
  clearInterval(timers[id].interval);
  const end = new Date();
  const duration = Math.floor((end - timers[id].start) / 1000);
  const fingerprint = document.querySelector('input[name="fingerprint' + id + '"]:checked').value;
  const reason = document.getElementById("delayReason" + id).value;
  const date = end.toLocaleDateString("ar-EG");
  const time = end.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' });

  const row = [count++, date, time, duration, fingerprint, reason];
  allRows.push(row);
  if (fingerprint === "نعم") withBio++;
  else withoutBio++;

  const table = document.querySelector("#logTable tbody");
  const tr = table.insertRow();
  row.forEach(cell => {
    const td = tr.insertCell();
    td.textContent = cell;
  });

  document.getElementById("delayReason" + id).value = "";
  updateStats(); updateAverages(); updateAverages(); updateAverages();
  saveToLocalStorage();
}

function updateStats() {
  const total = withBio + withoutBio;
  const p1 = total ? Math.round((withBio / total) * 100) : 0;
  const p2 = total ? Math.round((withoutBio / total) * 100) : 0;
  document.getElementById("percentStats").textContent = `نسبة المسجل لهم بصمة: ${p1}% | نسبة غير المسجل لهم: ${p2}%`;
}

function saveToLocalStorage() {
  localStorage.setItem("rows", JSON.stringify(allRows));
  localStorage.setItem("count", count);
  localStorage.setItem("withBio", withBio);
  localStorage.setItem("withoutBio", withoutBio);
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("rows");
  if (data) {
    allRows = JSON.parse(data);
    count = parseInt(localStorage.getItem("count"));
    withBio = parseInt(localStorage.getItem("withBio"));
    withoutBio = parseInt(localStorage.getItem("withoutBio"));
    const tbody = document.querySelector("#logTable tbody");
    allRows.forEach(row => {
      const tr = tbody.insertRow();
      row.forEach(cell => {
        const td = tr.insertCell();
        td.textContent = cell;
      });
    });
    updateStats(); updateAverages(); updateAverages(); updateAverages();
  }
}

function saveAsExcel() {
  const rows = document.querySelectorAll("table tr");
  let csv = "";
  rows.forEach(row => {
    const cols = row.querySelectorAll("th, td");
    const line = Array.from(cols).map(col => `"${col.innerText}"`).join(",");
    csv += line + "\n";
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


function updateAverages() {
  const durations = allRows.map(r => parseInt(r[3]));
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const withDur = allRows.filter(r => r[4] === "نعم").map(r => parseInt(r[3]));
  const withoutDur = allRows.filter(r => r[4] === "لا").map(r => parseInt(r[3]));
  document.getElementById("avgStats").textContent =
    `متوسط الزمن العام: ${avg(durations)} ثانية — مسجل لهم بصمه: ${avg(withDur)} ثانية — غير مسجل لهم: ${avg(withoutDur)} ثانية`;
}