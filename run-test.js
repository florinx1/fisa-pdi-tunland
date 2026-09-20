const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

async function main() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/index.html",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.HTMLCanvasElement.prototype.getContext = () => ({
    scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    clearRect() {}, drawImage() {},
    set lineWidth(v) {}, set lineCap(v) {}, set lineJoin(v) {}, set strokeStyle(v) {},
  });
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,AAAA";
  window.alert = (msg) => console.log("[alert]", msg);
  window.confirm = () => true;
  window.prompt = () => null;
  window.navigator.serviceWorker = undefined;
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });

  const store = {};
  window.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const { jsPDF } = require("jspdf");
  window.jspdf = { jsPDF };
  // fără backend configurat -> se folosește contorul local (comportament implicit livrat)
  window.fetch = async () => { throw new Error("nu ar trebui apelat fetch fără backend configurat"); };

  const files = [
    "fonts.js", "data.js", "app-pdf.js", "app-signature.js",
    "app-form.js", "app-archive.js", "app-pending.js", "app-sync.js", "app-auth.js", "app.js",
  ];
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.error || e.message));
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    const script = window.document.createElement("script");
    script.textContent = code;
    window.document.body.appendChild(script);
  }
  if (errors.length) throw new Error("Erori la încărcare: " + errors.join(", "));

  const bridge = window.document.createElement("script");
  bridge.textContent = `
    window.state = state;
    window.CONFIG = CONFIG;
    window.init = init;
    window.render = render;
    window.generatePdf = generatePdf;
    window.persistSignature = persistSignature;
    window.sigPads = sigPads;
    window.upsertCurrentIntoRecords = upsertCurrentIntoRecords;
    window.finalizeCurrentRecord = finalizeCurrentRecord;
    window.startNewFisa = startNewFisa;
    window.handleVerifClick = handleVerifClick;
    window.trimiteFisaMaiDeparteSiInchide = trimiteFisaMaiDeparteSiInchide;
  `;
  window.document.body.appendChild(bridge);

  // acest test verifică fluxul FĂRĂ backend configurat — forțăm explicit
  // URL-ul gol aici, indiferent de valoarea reală din data.js (care e cea de
  // producție, cu URL-ul live al utilizatorului), ca testul să nu mai
  // depindă de o editare manuală/reversibilă a acelui fișier.
  window.CONFIG.APPS_SCRIPT_URL = "";

  window.init();
  // fără un draft lăsat deschis anterior, aplicația pornește pe ecranul de
  // start ("Fișă nouă" / "Preia fișă") — simulăm apăsarea "Fișă nouă"
  if (window.state.current !== null) throw new Error("La prima pornire (fără draft anterior) ar trebui să pornim pe ecranul de start, nu direct într-o fișă");
  console.log("OK: la pornire, fără draft lăsat deschis, apare ecranul de start (Fișă nouă / Preia fișă)");
  window.startNewFisa();
  // așteptăm asignarea automată a numărului la creare (assignDocNumberAsync e async)
  await new Promise((r) => setTimeout(r, 50));

  console.log("Tab activ:", window.state.tab);
  console.log("Fișă nouă are deja număr atribuit:", window.state.current.docNumber);
  if (!window.state.current.docNumber || !window.state.current.docNumber.startsWith("ICG-PDI-")) {
    throw new Error("Fișa nouă NU a primit automat un număr de înregistrare (cerință: numerotare la deschidere)");
  }
  console.log("OK: numerotare automată la deschiderea unei fișe noi ->", window.state.current.docNumber);
  if (window.state.current.docNumber !== "ICG-PDI-0001") {
    throw new Error("Numerotarea NU începe de la 1: a pornit cu " + window.state.current.docNumber);
  }
  console.log("OK: numerotarea începe de la 1");

  const clientInput = window.document.getElementById("f-clientNume");
  clientInput.value = "Popescu Ion SRL";
  clientInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  if (window.state.current.client.nume !== "Popescu Ion SRL") throw new Error("Binding client.nume a eșuat");
  console.log("OK: binding câmp text (client.nume)");

  // selectul pentru "Predat de (ICG)" trebuie să existe ca <select>
  const icgSelect = window.document.getElementById("f-sig-icg-nume");
  if (icgSelect.tagName !== "SELECT") throw new Error("Câmpul 'Predat de (ICG)' nu este un <select> (cerință: listă vânzători)");
  console.log("OK: 'Predat de (ICG)' este listă derulantă (select)");

  const pdiSelect = window.document.getElementById("f-sig-pdi-nume");
  if (pdiSelect.tagName !== "SELECT") throw new Error("Câmpul 'Inspecție PDI' nu este un <select> (cerință: listă personal service)");
  console.log("OK: 'Inspecție PDI' este listă derulantă (select)");

  const clientSigInput = window.document.getElementById("f-sig-client-nume");
  if (clientSigInput.tagName !== "INPUT") throw new Error("Câmpul clientului ar trebui să rămână text liber");
  console.log("OK: 'Primit de (client)' rămâne câmp text liber");

  // adăugăm opțiuni de test în liste (simulăm ce va face Florin în data.js) și verificăm binding-ul selectului
  const opt = window.document.createElement("option");
  opt.value = "Ion Popescu (test)";
  opt.textContent = "Ion Popescu (test)";
  icgSelect.appendChild(opt);
  icgSelect.value = "Ion Popescu (test)";
  icgSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  if (window.state.current.semnaturi.icgNume !== "Ion Popescu (test)") {
    throw new Error("Binding select 'Predat de (ICG)' a eșuat (event change)");
  }
  console.log("OK: binding select prin eveniment 'change' funcționează");

  const vin = window.document.getElementById("f-vin");
  vin.value = "LFOTUNLAND2026000123";
  vin.dispatchEvent(new window.Event("input", { bubbles: true }));

  const fuelRadio = window.document.querySelector('input[name="fuel"][value="8"]');
  fuelRadio.checked = true;
  fuelRadio.dispatchEvent(new window.Event("change", { bubbles: true }));
  if (window.state.current.vehicul.nivelCombustibil !== 8) throw new Error("Radio combustibil a eșuat");
  console.log("OK: nivel combustibil ->", window.state.current.vehicul.nivelCombustibil, "(Plin)");

  const firstCheck = window.document.querySelector('.check-item[data-group="acc"]');
  firstCheck.querySelector("input").checked = true;
  firstCheck.querySelector("input").dispatchEvent(new window.Event("change", { bubbles: true }));

  window.sigPads["icg"].hasInk = true;
  window.persistSignature("icg", window.state.current);

  window.state.current._openInForm = true;
  window.upsertCurrentIntoRecords();

  const pdfDoc = window.generatePdf(window.state.current, { download: false, open: false });
  const bytes = pdfDoc.output("arraybuffer");
  console.log("OK: PDF generat, bytes:", bytes.byteLength, "pagini:", pdfDoc.internal.getNumberOfPages());
  if (bytes.byteLength < 1000) throw new Error("PDF gol/corupt");

  // Fișa se poate finaliza doar după ce verificarea vânzătorului ȘI a
  // service-ului sunt "Pass" — simulăm ambele confirmări (fără backend
  // configurat în acest test, deci trimiterea automată către service e
  // doar locală). Apăsarea Pass NU mai închide fișa (comportament nou) —
  // fișa rămâne deschisă până se apasă explicit "Trimite mai departe".
  const docNumber1 = window.state.current.docNumber;
  await window.handleVerifClick("vanzari", "pass");
  if (window.state.current === null) throw new Error("După Pass, fișa ar trebui să rămână deschisă (nu să revenim automat la Start)");
  console.log("OK: după Pass la verificarea vânzătorului, fișa rămâne deschisă pe „Fișă curentă”");

  await window.trimiteFisaMaiDeparteSiInchide();
  if (window.state.current !== null) throw new Error("După „Trimite mai departe” ar trebui să revenim la ecranul de start");
  console.log("OK: „Trimite mai departe” trimite fișa și revine la ecranul de start");

  window.state.current = window.state.records.find((r) => r.docNumber === docNumber1);
  if (!window.state.current) throw new Error("Nu găsesc fișa pentru a simula preluarea de către service");
  await window.handleVerifClick("service", "pass");
  if (window.state.current === null) throw new Error("După Pass, fișa ar trebui să rămână deschisă (nu să revenim automat la Start)");
  await window.trimiteFisaMaiDeparteSiInchide();
  if (window.state.current !== null) throw new Error("După „Trimite mai departe” ar trebui să revenim la ecranul de start");

  const afterBothChecks = window.state.records.find((r) => r.docNumber === docNumber1);
  if (afterBothChecks.verificareVanzari.status !== "pass" || afterBothChecks.verificareService.status !== "pass") {
    throw new Error("Verificările vânzător/service nu s-au setat pe pass");
  }
  console.log("OK: verificare vânzător + service confirmate (Pass) înainte de finalizare");

  window.state.current = afterBothChecks;
  await window.finalizeCurrentRecord();
  if (window.state.current !== null) throw new Error("După finalizare ar trebui să revenim la ecranul de start");
  console.log("DEBUG state.records after finalize:", window.state.records.map(r => ({ doc: r.docNumber, status: r.status, id: r.id })));
  const finalized = window.state.records.find((r) => r.status === "finalizat");
  if (!finalized) throw new Error("Fișa nu a fost finalizată");
  console.log("OK: fișă finalizată cu numărul", finalized.docNumber, "— și revenire la ecranul de start");

  // o fișă nouă, pornită explicit după finalizare, trebuie să primească automat numărul 2
  window.startNewFisa();
  await new Promise((r) => setTimeout(r, 50));
  console.log("Al doilea record (nou, după finalizare) are numărul:", window.state.current.docNumber);
  if (window.state.current.docNumber !== "ICG-PDI-0002") {
    throw new Error("A doua fișă nu a primit automat numărul 2, ci: " + window.state.current.docNumber);
  }
  console.log("OK: a doua fișă (pornită explicit din ecranul de start) a primit automat numărul următor");

  console.log("\n✅ TOATE TESTELE DE BAZĂ AU TRECUT (inclusiv cerințele noi)");
}

main().catch((err) => {
  console.error("\n❌ TEST EȘUAT:", err);
  process.exit(1);
});
