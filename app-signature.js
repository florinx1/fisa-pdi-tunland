/* ============================================================
   Semnătură pe ecran — canvas cu suport touch/mouse/pen
   ============================================================ */

const sigPads = {}; // who -> { canvas, ctx, drawing, hasInk }

function initSignaturePad(who, record) {
  const canvas = document.getElementById(`sig-${who}`);
  if (!canvas) return;

  // dimensionăm canvas-ul la rezoluția reală a ecranului pentru linii clare
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#122A4E";

  sigPads[who] = { canvas, ctx, drawing: false, hasInk: false, w: rect.width, h: rect.height };

  // dacă există deja o semnătură salvată, o redesenăm
  const existingValue = record.semnaturi[`${who}Semnatura`];
  if (typeof existingValue === "string" && existingValue.indexOf("data:") === 0) {
    drawSignatureImage(who, existingValue);
  } else if (existingValue && typeof existingValue === "object" && existingValue.fileId) {
    // semnătura a fost trimisă de pe alt dispozitiv și, fiind prea mare pentru
    // celula draftului, a fost urcată în Drive (vezi offloadLargeSignatures_ în
    // app-sync.js) — o aducem acum și o "hidratăm" înapoi într-un dataURL
    // normal, ca de-acum încolo să se comporte identic cu o semnătură locală
    hydrateSignatureFromDrive(who, record, existingValue.fileId);
  }

  const getPos = (evt) => {
    const r2 = canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: point.clientX - r2.left, y: point.clientY - r2.top };
  };

  const start = (evt) => {
    evt.preventDefault();
    const pad = sigPads[who];
    pad.drawing = true;
    const { x, y } = getPos(evt);
    pad.ctx.beginPath();
    pad.ctx.moveTo(x, y);
  };
  const move = (evt) => {
    const pad = sigPads[who];
    if (!pad.drawing) return;
    evt.preventDefault();
    const { x, y } = getPos(evt);
    pad.ctx.lineTo(x, y);
    pad.ctx.stroke();
    pad.hasInk = true;
  };
  const end = () => {
    const pad = sigPads[who];
    if (!pad.drawing) return;
    pad.drawing = false;
    persistSignature(who, record);
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}

function persistSignature(who, record) {
  const pad = sigPads[who];
  if (!pad || !pad.hasInk) return;
  record.semnaturi[`${who}Semnatura`] = pad.canvas.toDataURL("image/png");
  autosave();
}

function drawSignatureImage(who, dataUrl) {
  const pad = sigPads[who];
  if (!pad) return;
  const img = new Image();
  img.onload = () => {
    pad.ctx.drawImage(img, 0, 0, pad.w, pad.h);
    pad.hasInk = true;
  };
  img.src = dataUrl;
}

// Aduce o semnătură urcată în Drive (vezi offloadLargeSignatures_ în
// app-sync.js) și o scrie înapoi în fișă ca dataURL normal — o singură dată,
// la prima afișare pe acest dispozitiv; de-atunci fișa se comportă identic
// cu una unde semnătura a fost desenată local.
async function hydrateSignatureFromDrive(who, record, fileId) {
  if (!backendConfigured()) return;
  const res = await apiGetSignatureImage(fileId);
  if (!res || !res.ok || !res.dataBase64) return;
  const dataUrl = "data:image/png;base64," + res.dataBase64;
  record.semnaturi[`${who}Semnatura`] = dataUrl;
  drawSignatureImage(who, dataUrl);
  const canvas = document.getElementById(`sig-${who}`);
  const label = canvas && canvas.closest(".sig-block") && canvas.closest(".sig-block").querySelector(".note");
  if (label) label.textContent = "semnat";
}

// Plasă de siguranță înainte de generarea PDF-ului la finalizare: dacă vreo
// semnătură a rămas doar ca link către Drive (ex. hidratarea din afișare nu a
// apucat să termine), o aducem acum explicit, ca PDF-ul să nu iasă fără ea.
async function ensureSignaturesHydrated(record) {
  if (!backendConfigured()) return;
  const s = record.semnaturi || {};
  const keys = ["icg", "pdi", "client"];
  for (const who of keys) {
    const val = s[`${who}Semnatura`];
    if (val && typeof val === "object" && val.fileId) {
      const res = await apiGetSignatureImage(val.fileId);
      if (res && res.ok && res.dataBase64) {
        record.semnaturi[`${who}Semnatura`] = "data:image/png;base64," + res.dataBase64;
      }
    }
  }
}

function clearSignaturePad(who, record) {
  const pad = sigPads[who];
  if (!pad) return;
  pad.ctx.clearRect(0, 0, pad.w, pad.h);
  pad.hasInk = false;
  record.semnaturi[`${who}Semnatura`] = null;
  autosave();
  const label = document.querySelector(`#sig-${who}`).closest(".sig-block").querySelector(".note");
  if (label) label.textContent = "nesemnat";
}
