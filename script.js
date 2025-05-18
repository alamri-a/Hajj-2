
let startTime1, startTime2;
let timerInterval1, timerInterval2;
let count = 1;
let allDurations = [];

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
  if (id === 1) clearInterval(timerInterval1);
  else clearInterval(timerInterval2);

  const now = new Date();
  const durationInSeconds = Math.floor((now - (id === 1 ? startTime1 : startTime2)) / 1000);
  allDurations.push(durationInSeconds);
  updateAverage();

  const date = now.toLocaleDateString('ar-EG');
  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const fingerprint = document.querySelector(`input[name="fingerprint${id}"]:checked`).value;
  const delayReason = document.getElementById(`delayReason${id}`).value;

  const table = document.getElementById("logTable").querySelector("tbody");
  const newRow = table.insertRow();
  newRow.innerHTML = `
    <td>${count++}</td>
    <td>قياس ${id}</td>
    <td>${date}</td>
    <td>${time}</td>
    <td>${durationInSeconds}</td>
    <td>${fingerprint}</td>
    <td>${delayReason}</td>
  `;

  document.getElementById(`timer${id}`).textContent = "00:00";
  document.getElementById(`delayReason${id}`).value = "";
}

function updateAverage() {
  const sum = allDurations.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / allDurations.length);
  document.getElementById("averageTimeDisplay").textContent = `متوسط الزمن: ${avg} ثانية`;
}

function saveTableAsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  html2canvas(document.querySelector("#logTable")).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const imgProps = doc.getImageProperties(imgData);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    doc.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
    doc.save("سجل_الحجاج.pdf");
  });
}
