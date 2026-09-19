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
  const existingDataUrl = record.semnaturi[`${who}Semnatura`];
  if (existingDataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      sigPads[who].hasInk = true;
    };
    img.src = existingDataUrl;
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
