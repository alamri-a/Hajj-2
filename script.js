let startTime1, startTime2;
let timerInterval1, timerInterval2;
let count = 1;
let allDurations = [];
let withBiometric = [];
let withoutBiometric = [];

function startTimer(id) {
  const now = new Date();
  if (id === 1) {
    startTime1 = now;
    document.getElementById("timer1").textContent = "00:00";
    clearInterval(timerInterval1);
    timerInterval1 = setInterval(() => {
      const secondsPassed = Math.floor((new Date() - startTime1) / 1000);
      document.getElementById("timer1").textContent = `00:${secondsPassed < 10 ? '0' : ''}${secondsPassed}`;
    }, 1000);
  } else {
    startTime2 = now;
    document.getElementById("timer2").textContent = "00:00";
    clearInterval(timerInterval2);
    timerInterval2 = setInterval(() => {
      const secondsPassed = Math.floor((new Date() - startTime2) / 1000);
      document.getElementById("timer2").textContent = `00:${secondsPassed < 10 ? '0' : ''}${secondsPassed}`;
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
  const delayReason = document.getElementById(`delayReason${id}`).value;

  allDurations.push(duration);
  if (fingerprint === "نعم") {
    withBiometric.push(duration);
  } else {
    withoutBiometric.push(duration);
  }

  updateUnifiedAverage();

  const date = now.toLocaleDateString('en-GB');
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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

  document.getElementById(`timer${id}`).textContent = "00:00";
  document.getElementById(`delayReason${id}`).value = "";
  if (id === 1) startTime1 = null;
  else startTime2 = null;

  saveTableData();
  updateUnifiedAverage();
  updatePercentRow();
  updateMinMaxRow();
}

function updateUnifiedAverage() {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const avgAll = avg(allDurations);
  const avgWith = avg(withBiometric);
  const avgWithout = avg(withoutBiometric);

  document.getElementById("unifiedAverageRow").textContent =
    `متوسط الزمن العام: ${avgAll} ثانية — له بصمة: ${avgWith} ثانية — ماله بصمة: ${avgWithout} ثانية`;

  const total = withBiometric.length + withoutBiometric.length;
  const percent = v => total ? Math.round((v / total) * 100) : 0;
  document.getElementById("percentRow").textContent =
    `نسبة المسجل لهم بصمة: ${percent(withBiometric.length)}% — نسبة غير المسجل لهم: ${percent(withoutBiometric.length)}%`;

  updateMinMaxRow();
}

function updatePercentRow() {
  const rows = document.querySelectorAll("#logTable tbody tr");
  let countYes = 0, countNo = 0;
  rows.forEach(row => {
    const val = row.cells[4]?.textContent.trim();
    if (val === "نعم") countYes++;
    else if (val === "لا") countNo++;
  });
  const total = countYes + countNo;
  const percent = v => total ? Math.round((v / total) * 100) : 0;
  document.getElementById("percentRow").textContent =
    `نسبة المسجل لهم بصمة: ${percent(countYes)}% — نسبة غير المسجل لهم: ${percent(countNo)}%`;
}

function updateMinMaxRow() {
  const min = arr => arr.length ? Math.min(...arr) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;

  const minWith = min(withBiometric);
  const maxWith = max(withBiometric);
  const minWithout = min(withoutBiometric);
  const maxWithout = max(withoutBiometric);

  document.getElementById("minMaxRow").textContent =
    `الأزمنة القصوى والدنيا — بالبصمة: أقل ${minWith}ث، أعلى ${maxWith}ث — بدون بصمة: أقل ${minWithout}ث، أعلى ${maxWithout}ث`;
}

function saveTableAsPDF() {
  const element = document.getElementById("logTable");

  const opt = {
    margin:       [10, 10, 10, 10],  // أعلى، يمين، أسفل، يسار
    filename:     'سجل_الحجاج.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // منع تقطيع الصفوف بين الصفحات
  element.querySelectorAll("tr").forEach(tr => {
    tr.style.pageBreakInside = "avoid";
  });

  html2pdf().set(opt).from(element).save();
}

function saveTableAsExcel() {
  const table = document.querySelector("#logTable");
  let csv = "";

  const rows = table.querySelectorAll("tr");
  rows.forEach(row => {
    const cols = row.querySelectorAll("th, td");
    const rowData = Array.from(cols).map(col => `"${col.textContent.trim()}"`);
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

function saveTableData() {
  const tbody = document.querySelector("#logTable tbody");
  localStorage.setItem("hajjTableRows", tbody.innerHTML);
}

function clearData() {
  localStorage.removeItem("hajjTableRows");
  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML = "";
  count = 1;
  allDurations = [];
  withBiometric = [];
  withoutBiometric = [];
  document.getElementById("timer1").textContent = "00:00";
  document.getElementById("timer2").textContent = "00:00";
  updateUnifiedAverage();
  updatePercentRow();
  updateMinMaxRow();
}

function undoLastEntry() {
  const table = document.querySelector("#logTable tbody");
  const lastRow = table.lastElementChild;
  if (!lastRow) return;

  const duration = parseInt(lastRow.cells[3]?.textContent.trim());
  const biometric = lastRow.cells[4]?.textContent.trim();

  if (!isNaN(duration)) {
    allDurations.pop();
    if (biometric === "نعم") withBiometric.pop();
    else if (biometric === "لا") withoutBiometric.pop();
  }

  table.removeChild(lastRow);
  count = Math.max(1, count - 1);
  saveTableData();
  updateUnifiedAverage();
  updatePercentRow();
  updateMinMaxRow();
}

document.addEventListener("DOMContentLoaded", function () {
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

    updateUnifiedAverage();
    updatePercentRow();
    updateMinMaxRow();
  }
});

function deleteRowByNumber() {
  const rowNum = parseInt(document.getElementById("rowToDelete").value);
  if (!rowNum || rowNum < 1) {
    alert("يرجى إدخال رقم صف صالح.");
    return;
  }

  const tbody = document.querySelector("#logTable tbody");
  const rows = Array.from(tbody.rows);
  const rowIndex = rows.findIndex(row => parseInt(row.cells[0].textContent) === rowNum);

  if (rowIndex === -1) {
    alert("لم يتم العثور على الصف بهذا الرقم.");
    return;
  }

  const confirmDelete = confirm(`هل أنت متأكد من حذف الصف رقم ${rowNum}؟`);
  if (!confirmDelete) return;

  // تحديث البيانات
  const row = rows[rowIndex];
  const duration = parseInt(row.cells[3].textContent.trim());
  const biometric = row.cells[4].textContent.trim();

  allDurations = allDurations.filter(d => d !== duration);
  if (biometric === "نعم") withBiometric = withBiometric.filter(d => d !== duration);
  else withoutBiometric = withoutBiometric.filter(d => d !== duration);

  tbody.deleteRow(rowIndex);
  saveTableData();
  updateUnifiedAverage();
  updatePercentRow();
  updateMinMaxRow();
}
