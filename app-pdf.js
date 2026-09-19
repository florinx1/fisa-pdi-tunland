/* ============================================================
   Generare PDF client-side (jsPDF) — replică fișei tipărite ICG,
   cu antet, logo, secțiuni, bife și semnături desenate.
   ============================================================ */

const PDF = {
  NAVY: [18, 42, 78],
  STEEL: [63, 92, 122],
  LIGHT: [238, 242, 246],
  LINE: [185, 196, 206],
  TEXT: [26, 26, 26],
  pageW: 210,
  pageH: 297,
  margin: 14,
};

function fontsRegistered(doc) {
  if (doc.__icgFontsReady) return;
  doc.addFileToVFS("DejaVuSans.ttf", FONT_REGULAR_B64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", FONT_BOLD_B64);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  doc.__icgFontsReady = true;
}

function generatePdf(record, opts = {}) {
  if (!window.jspdf) {
    showToast("Librăria PDF nu s-a încărcat (verifică conexiunea la internet la prima folosire).");
    return null;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  fontsRegistered(doc);

  const ctx = { doc, y: 0, page: 1 };
  drawHeaderBanner(ctx, record);
  drawMetaRow(ctx, record);
  drawVehicleSection(ctx, record);
  drawClientSection(ctx, record);
  drawDocumentsSection(ctx, record);
  drawAccessoriesSection(ctx, record);
  drawPdiSection(ctx, record);
  drawObservationsSection(ctx, record);
  drawSignaturesSection(ctx, record);
  drawFooters(doc);

  const filenameSafe = buildPdfFilename(record);

  if (opts.download) {
    doc.save(filenameSafe);
  }
  if (opts.open) {
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  }
  return doc;
}

function slugify(s) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Denumire fi\u0219ier PDF: pentru identificare rapid\u0103 \u00een Drive, punem seria de
// \u0219asiu (VIN) \u0219i numele clientului \u00een prim-plan; num\u0103rul de document r\u0103m\u00e2ne
// primul segment doar pentru sortare/unicitate (c\u00e2teva fi\u0219e pot avea VIN
// necompletat \u00eenc\u0103 la momentul unui draft).
function buildPdfFilename(record) {
  const doc = record.docNumber || "draft";
  const vin = slugify(record.vehicul && record.vehicul.vin) || "VIN-necompletat";
  const client = slugify(record.client && record.client.nume) || "client-necompletat";
  return `${doc}_${vin}_${client}.pdf`;
}

// ---------------- Building blocks ----------------

function ensureSpace(ctx, needed) {
  if (ctx.y + needed > PDF.pageH - PDF.margin - 8) {
    ctx.doc.addPage();
    ctx.page++;
    ctx.y = PDF.margin;
  }
}

function sectionBar(ctx, title) {
  ensureSpace(ctx, 12);
  const doc = ctx.doc;
  const w = PDF.pageW - 2 * PDF.margin;
  doc.setFillColor(...PDF.NAVY);
  doc.rect(PDF.margin, ctx.y, w, 7.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(10.5);
  doc.text(title, PDF.margin + 3, ctx.y + 5.2);
  ctx.y += 7.5 + 3;
}

function fieldRow(ctx, fields) {
  // fields: [{label, value, widthFrac}]
  const doc = ctx.doc;
  const w = PDF.pageW - 2 * PDF.margin;
  const gap = 4; // spațiu între coloane, ca valorile lungi să nu atingă coloana următoare
  const totalFrac = fields.reduce((s, f) => s + (f.widthFrac || 1), 0);

  // calculăm dinainte lățimea fiecărei coloane și înfășurăm valoarea pe mai
  // multe linii dacă nu încape, ca să nu se suprapună peste coloana vecină
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(10);
  let x = PDF.margin;
  const prepared = fields.map(f => {
    const fw = (w * (f.widthFrac || 1)) / totalFrac;
    const val = f.value && String(f.value).trim() ? String(f.value) : "-";
    const lines = doc.splitTextToSize(val, Math.max(fw - gap, 15));
    const colX = x;
    x += fw;
    return { ...f, val, lines, colX };
  });
  const maxLines = Math.max(1, ...prepared.map(f => f.lines.length));
  const rowH = 13 + (maxLines - 1) * 4.6;
  ensureSpace(ctx, rowH);

  prepared.forEach(f => {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF.STEEL);
    doc.text(f.label.toUpperCase(), f.colX, ctx.y + 3);
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF.TEXT);
    doc.text(f.lines, f.colX, ctx.y + 8.5);
  });
  doc.setDrawColor(...PDF.LINE);
  doc.setLineWidth(0.2);
  doc.line(PDF.margin, ctx.y + rowH - 2.5, PDF.margin + w, ctx.y + rowH - 2.5);
  ctx.y += rowH;
}

function checklistItem(ctx, label, checked) {
  const doc = ctx.doc;
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(9.3);
  const maxW = PDF.pageW - 2 * PDF.margin - 8;
  const lines = doc.splitTextToSize(label, maxW);
  const h = 5 + (lines.length - 1) * 4.3;
  ensureSpace(ctx, h + 2);
  doc.setTextColor(...PDF.TEXT);
  doc.setFont("DejaVu", checked ? "bold" : "normal");
  doc.text(checked ? "\u2611" : "\u2610", PDF.margin, ctx.y + 4);
  doc.setFont("DejaVu", "normal");
  doc.text(lines, PDF.margin + 6, ctx.y + 4);
  ctx.y += h + 2.5;
}

function groupTitle(ctx, title) {
  ensureSpace(ctx, 8);
  const doc = ctx.doc;
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(9.6);
  doc.setTextColor(...PDF.NAVY);
  doc.text(title, PDF.margin, ctx.y + 3.5);
  ctx.y += 6.5;
}

// ---------------- Secțiuni ----------------

// proporții (lățime/înălțime) ale siglelor complete (icon + text), folosite
// ca să calculăm lățimea din înălțimea dorită, fără să deformăm imaginea
const ICG_LOGO_RATIO = 900 / 223;
const FOTON_LOGO_RATIO = 900 / 256;

function drawHeaderBanner(ctx, record) {
  const doc = ctx.doc;
  const w = PDF.pageW - 2 * PDF.margin;
  const h = 34;
  doc.setFillColor(...PDF.NAVY);
  doc.rect(PDF.margin, 10, w, h, "F");

  // sigla ICG completă (icon + „Inter Cargo"), varianta ALBĂ, arsă direct
  // pe bannerul navy — fără fundal/placă albă în spatele ei
  const icgLogoH = 15;
  const icgLogoW = icgLogoH * ICG_LOGO_RATIO;
  const logoX = PDF.margin + 3;
  const logoY = 13.5;
  tryDrawImage(doc, "logo-for-pdf", logoX, logoY, icgLogoW, icgLogoH);

  // subtitlul companiei, SUB siglă (nu lângă — sigla e prea lată acum ca să
  // mai încapă text în dreapta ei fără să se ciocnească de titlul din dreapta)
  doc.setTextColor(255, 255, 255);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(7.6);
  doc.text(CONFIG.COMPANY_SUB, logoX, logoY + icgLogoH + 5.5);
  doc.text(CONFIG.COMPANY_DEPT, logoX, logoY + icgLogoH + 9.5);

  doc.setFont("DejaVu", "bold");
  doc.setFontSize(13.5);
  doc.text("FIȘĂ DE PREDARE-PRIMIRE VEHICUL", PDF.margin + w, 18, { align: "right" });
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(8.3);
  doc.text("Inspecție PDI & inventar accesorii", PDF.margin + w, 22, { align: "right" });

  // sigla FOTON completă (icon + text), jos-dreapta; varianta de model apare
  // ca text lângă ea (fără „FOTON" — e deja în siglă, ca să nu se repete)
  const fotonLogoH = 8.5;
  const fotonLogoW = fotonLogoH * FOTON_LOGO_RATIO;
  const modelY = 29.5;
  const modelText = record.vehicul.model || "";
  doc.setFont("DejaVu", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  let modelWidth = 0;
  if (modelText) {
    doc.text(modelText, PDF.margin + w, modelY, { align: "right" });
    modelWidth = doc.getTextWidth(modelText);
  }
  const fotonGap = modelText ? 4 : 0;
  tryDrawImage(
    doc, "foton-logo-for-pdf",
    PDF.margin + w - modelWidth - fotonGap - fotonLogoW, modelY - fotonLogoH + 2.4,
    fotonLogoW, fotonLogoH
  );

  ctx.y = 10 + h + 6;
}

function tryDrawImage(doc, elementId, x, y, w, h) {
  const img = document.getElementById(elementId);
  if (img && img.complete && img.naturalWidth > 0) {
    try {
      doc.addImage(img, "PNG", x, y, w, h, undefined, "FAST");
      return true;
    } catch (e) { /* logo lipsă sau format nesuportat — ignorăm */ }
  }
  return false;
}

function drawMetaRow(ctx, record) {
  fieldRow(ctx, [
    { label: "Nr. document", value: record.docNumber || "(se atribuie la finalizare)", widthFrac: 1 },
    { label: "Data livrării", value: record.dataLivrarii, widthFrac: 1 },
    { label: "Locația livrării", value: record.locatieLivrare === "extern" ? "Livrare externă" : "Sediu ICG Bragadiru", widthFrac: 1.4 },
  ]);
}

function drawVehicleSection(ctx, record) {
  const v = record.vehicul;
  const isElectric = v.tipMotorizare === TIP_MOTORIZARE.ELECTRIC;
  sectionBar(ctx, "1  DATE VEHICUL");
  fieldRow(ctx, [
    { label: "Marcă", value: v.marca },
    { label: "Model", value: v.model },
    { label: "Tip motorizare", value: isElectric ? "Electric" : "Termic (ICE)" },
  ]);
  fieldRow(ctx, [
    { label: "Culoare caroserie", value: v.culoare },
    { label: "Versiune / motorizare", value: v.versiune },
    { label: "Serie șasiu (VIN)", value: v.vin },
  ]);
  fieldRow(ctx, [
    { label: "Serie motor", value: v.serieMotor },
    { label: "An fabricație", value: v.anFabricatie },
    { label: "KM bord la livrare", value: v.kmBord },
  ]);
  fieldRow(ctx, [
    { label: "Nr. înmatriculare", value: v.nrInmatriculare },
    { label: "Interior / tapițerie", value: v.tapiterie },
  ]);
  fieldRow(ctx, [
    isElectric
      ? { label: "Nivel baterie la livrare", value: v.nivelBaterie ? `${v.nivelBaterie}%` : "-", widthFrac: 1 }
      : { label: "Nivel combustibil la livrare", value: v.nivelCombustibil ? FUEL_STEPS[v.nivelCombustibil - 1] : "-", widthFrac: 1 },
  ]);
}

function drawClientSection(ctx, record) {
  const c = record.client;
  sectionBar(ctx, "2  DATE CLIENT (BENEFICIAR FINAL)");
  fieldRow(ctx, [
    { label: "Nume complet / denumire", value: c.nume, widthFrac: 1.6 },
    { label: "CNP / CUI", value: c.cnpCui, widthFrac: 1 },
  ]);
  fieldRow(ctx, [
    { label: "Adresă", value: c.adresa, widthFrac: 1.6 },
    { label: "Telefon", value: c.telefon, widthFrac: 1 },
    { label: "Email", value: c.email, widthFrac: 1 },
  ]);
}

function drawDocumentsSection(ctx, record) {
  const d = record.documente;
  sectionBar(ctx, "3  DOCUMENTE");
  DOCUMENTE.forEach(it => checklistItem(ctx, it.label, !!d.checks[it.key]));
  if (d.observatii) {
    fieldRow(ctx, [{ label: "Observații documente", value: d.observatii, widthFrac: 1 }]);
  }
}

function drawAccessoriesSection(ctx, record) {
  const a = record.accesorii;
  sectionBar(ctx, "4  INVENTAR ACCESORII");
  getAccesoriiList(record.vehicul.tipMotorizare).forEach(it => checklistItem(ctx, it.label, !!a.checks[it.key]));
  fieldRow(ctx, [
    { label: "Alte accesorii", value: a.alteAccesorii || "-", widthFrac: 1.6 },
    { label: "Număr chei predate", value: a.nrChei ? `${a.nrChei} bucăți` : "-" },
    { label: "Cartele / telecomenzi", value: a.nrCartele ? `${a.nrCartele} bucăți` : "-" },
  ]);
  if (a.observatii) {
    fieldRow(ctx, [{ label: "Observații inventar", value: a.observatii, widthFrac: 1 }]);
  }
}

function drawPdiSection(ctx, record) {
  const checks = record.pdi.checks;
  sectionBar(ctx, "5  INSPECȚIE TEHNICĂ PDI (PRE-DELIVERY INSPECTION)");
  getPdiGroups(record.vehicul.tipMotorizare).forEach(g => {
    groupTitle(ctx, g.title);
    g.items.forEach(it => checklistItem(ctx, it.label, !!checks[it.key]));
  });
  fieldRow(ctx, [
    { label: "Tehnician PDI", value: record.pdi.tehnician },
    { label: "Data inspecției", value: record.pdi.dataInspectiei },
    { label: "KM la testare", value: record.pdi.kmTestare },
  ]);
}

function drawObservationsSection(ctx, record) {
  sectionBar(ctx, "6  OBSERVAȚII GENERALE");
  const doc = ctx.doc;
  const w = PDF.pageW - 2 * PDF.margin;
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(9.5);
  const text = record.observatiiGenerale || "-";
  const lines = doc.splitTextToSize(text, w - 6);
  const boxH = Math.max(18, lines.length * 4.6 + 6);
  ensureSpace(ctx, boxH + 4);
  doc.setDrawColor(...PDF.LINE);
  doc.rect(PDF.margin, ctx.y, w, boxH);
  doc.setTextColor(...PDF.TEXT);
  doc.text(lines, PDF.margin + 3, ctx.y + 6);
  ctx.y += boxH + 6;
}

function drawSignaturesSection(ctx, record) {
  const s = record.semnaturi;
  sectionBar(ctx, "7  CONFIRMARE PREDARE-PRIMIRE");
  ensureSpace(ctx, 46);
  const doc = ctx.doc;
  const w = PDF.pageW - 2 * PDF.margin;
  const colW = w / 3;
  const blocks = [
    { title: "PREDAT DE (ICG)", nume: s.icgNume, sig: s.icgSemnatura, sub: "Nume, semnătură și ștampilă ICG" },
    { title: "INSPECȚIE PDI", nume: s.pdiNume, sig: s.pdiSemnatura, sub: "Nume și semnătură tehnician PDI" },
    { title: "PRIMIT DE (CLIENT)", nume: s.clientNume, sig: s.clientSemnatura, sub: "Nume, semnătură și ștampilă (dacă e cazul)" },
  ];
  const startY = ctx.y;
  blocks.forEach((b, i) => {
    const x = PDF.margin + i * colW;
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...PDF.NAVY);
    doc.text(b.title, x + colW / 2, startY + 4, { align: "center" });

    if (b.sig) {
      try {
        doc.addImage(b.sig, "PNG", x + 5, startY + 6, colW - 10, 16, undefined, "FAST");
      } catch (e) { /* ignor semnătură invalidă */ }
    }
    doc.setDrawColor(...PDF.LINE);
    doc.line(x + 6, startY + 24, x + colW - 6, startY + 24);

    doc.setFont("DejaVu", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF.TEXT);
    doc.text(b.nume || "", x + colW / 2, startY + 28, { align: "center" });

    doc.setFontSize(7);
    doc.setTextColor(...PDF.STEEL);
    const subLines = doc.splitTextToSize(b.sub, colW - 8);
    doc.text(subLines, x + colW / 2, startY + 32, { align: "center" });
  });
  ctx.y = startY + 44;

  ensureSpace(ctx, 14);
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...PDF.STEEL);
  const note = "Prin semnarea prezentei fișe, părțile confirmă că vehiculul și accesoriile menționate mai sus au fost verificate, inspectate și predate/primite în starea descrisă, la data și locul indicate.";
  const noteLines = doc.splitTextToSize(note, PDF.pageW - 2 * PDF.margin);
  doc.text(noteLines, PDF.margin, ctx.y);
  ctx.y += noteLines.length * 3.6 + 4;
}

function drawFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(...PDF.STEEL);
    doc.text(
      `${CONFIG.COMPANY_NAME} • Bragadiru, jud. Ilfov, România • Document intern – Departament Aftersales`,
      PDF.margin, PDF.pageH - 8
    );
    doc.text(`${i}/${pageCount}`, PDF.pageW - PDF.margin, PDF.pageH - 8, { align: "right" });
  }
}
