let count = 1;
let allDurations = [], withBiometric = [], withoutBiometric = [];
let timers = {};

function startTimer(id) {
    const display = document.getElementById('timer' + id);
    const key = 'timer' + id;
    timers[key] = { start: new Date(), interval: setInterval(() => {
        const seconds = Math.floor((new Date() - timers[key].start) / 1000);
        display.textContent = `00:${seconds < 10 ? '0' : ''}${seconds}`;
    }, 1000) };
}

function stopTimer(id) {
    const key = 'timer' + id;
    clearInterval(timers[key].interval);
    const now = new Date();
    const duration = Math.floor((now - timers[key].start) / 1000);
    const fingerprint = document.querySelector(`input[name="fingerprint${id}"]:checked`).value;
    const delayReason = document.getElementById(`delayReason${id}`).value;
    allDurations.push(duration);
    if (fingerprint === "نعم") withBiometric.push(duration);
    else withoutBiometric.push(duration);
    updateStats();

    const date = now.toLocaleDateString('ar-EG');
    const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const row = document.getElementById("logTable").querySelector("tbody").insertRow();
    row.innerHTML = `<td>${count++}</td><td>${date}</td><td>${time}</td><td>${duration}</td><td>${fingerprint}</td><td>${delayReason}</td>`;
    timers[key].start = null;
    document.getElementById(`timer${id}`).textContent = "00:00";
    document.getElementById(`delayReason${id}`).value = "";
    saveData();
}

function updateStats() {
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const total = withBiometric.length + withoutBiometric.length;
    const percent = v => total ? Math.round((v / total) * 100) : 0;
    document.getElementById("avgRow").innerHTML = `<td colspan="6">متوسط الزمن العام: ${avg(allDurations)} ثانية — مسجل لهم بصمة: ${avg(withBiometric)} ثانية — غير مسجل لهم: ${avg(withoutBiometric)} ثانية</td>`;
    document.getElementById("percentRow").innerHTML = `<td colspan="6">نسبة المسجل لهم بصمة: ${percent(withBiometric.length)}% — نسبة غير المسجل لهم: ${percent(withoutBiometric.length)}%</td>`;
}

function saveData() {
    const rows = Array.from(document.querySelector("tbody").rows).map(r => Array.from(r.cells).map(c => c.textContent));
    localStorage.setItem("hajjData", JSON.stringify(rows));
    localStorage.setItem("hajjCount", count);
}

function loadData() {
    const saved = localStorage.getItem("hajjData");
    const savedCount = localStorage.getItem("hajjCount");
    if (saved && savedCount) {
        const rows = JSON.parse(saved);
        count = parseInt(savedCount);
        const tbody = document.querySelector("tbody");
        rows.forEach(cells => {
            const row = tbody.insertRow();
            row.innerHTML = cells.map(c => `<td>${c}</td>`).join("");
        });
        updateStats();
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

function clearAll() {
    if (confirm("هل أنت متأكد أنك تريد البدء من جديد؟")) {
        localStorage.clear();
        location.reload();
    }
}

document.getElementById("resetButton").addEventListener("click", clearAll);
document.addEventListener("DOMContentLoaded", loadData);
