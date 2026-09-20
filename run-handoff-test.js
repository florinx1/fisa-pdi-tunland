const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");

// backend Apps Script simulat în memorie (imită Code.gs pentru test)
const fakeBackend = {
  counter: 0,
  drafts: new Map(),
  finals: [],
  handle(url, opts) {
    const u = new URL(url, "http://fake-backend.local");
    if (!opts || (opts.method || "GET") === "GET") {
      const action = u.searchParams.get("action");
      if (action === "nextNumber") {
        this.counter++;
        return { ok: true, docNumber: "ICG-PDI-" + String(this.counter).padStart(4, "0") };
      }
      if (action === "getDraft") {
        const docNumber = u.searchParams.get("docNumber");
        const rec = this.drafts.get((docNumber || "").toUpperCase());
        return rec ? { ok: true, record: rec } : { ok: false, error: "Fișa nu a fost găsită." };
      }
      return { ok: false, error: "acțiune GET necunoscută" };
    }
    const body = JSON.parse(opts.body);
    if (body.action === "saveDraft") {
      this.drafts.set(body.docNumber.toUpperCase(), body.record);
      return { ok: true, docNumber: body.docNumber };
    }
    if (body.action === "saveRecord") {
      const docNumber = body.record.docNumber || ("ICG-PDI-" + String(++this.counter).padStart(4, "0"));
      this.finals.push({ ...body.record, docNumber });
      this.drafts.delete(docNumber.toUpperCase());
      return { ok: true, docNumber, driveUrl: "https://drive.example/fake/" + docNumber };
    }
    if (body.action === "login") {
      // acest test verifică predarea între dispozitive, nu autentificarea —
      // orice combinație nume/PIN e acceptată ca administrator
      return { ok: true, nume: body.nume || "Tester", rol: "admin" };
    }
    return { ok: false, error: "acțiune POST necunoscută" };
  },
};

async function buildAppWindow({ withBackend, traceCurrent }) {
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

  // fetch simulat -> backend fals, comun între "cele două dispozitive" din test
  window.fetch = async (url, opts) => {
    console.log("DEBUG fetch called:", url, opts ? opts.method || "POST-ish" : "GET");
    if (opts && opts.body) {
      const preview = opts.body.length > 300 ? opts.body.slice(0, 300) + "...(trunchiat)" : opts.body;
      console.log("DEBUG body:", preview);
    }
    const data = fakeBackend.handle(url, opts);
    return { json: async () => data };
  };

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
  if (errors.length) throw new Error("Erori la încărcarea scripturilor: " + errors.join(", "));

  const bridge = window.document.createElement("script");
  bridge.textContent = `
    window.state = state;
    window.CONFIG = CONFIG;
    window.init = init;
    window.render = render;
    window.attemptPullByNumber = attemptPullByNumber;
    window.shareCurrentRecord = shareCurrentRecord;
    window.pullDraft = pullDraft;
    window.pushDraft = pushDraft;
    window.finalizeCurrentRecord = finalizeCurrentRecord;
    window.upsertCurrentIntoRecords = upsertCurrentIntoRecords;
    window.startNewFisa = startNewFisa;
    window.handleVerifClick = handleVerifClick;
    window.trimiteFisaMaiDeparteSiInchide = trimiteFisaMaiDeparteSiInchide;
  `;
  window.document.body.appendChild(bridge);

  if (withBackend) {
    window.CONFIG.APPS_SCRIPT_URL = "https://fake-backend.local/exec";
    // test-ul de predare între dispozitive nu vizează autentificarea, deci
    // pre-populăm o sesiune salvată ca fiecare "dispozitiv" să treacă direct
    // de ecranul de logare (apiLogin tot re-verifică pe server la init()).
    window.localStorage.setItem(
      "icg_fise_pdi_auth_v1",
      JSON.stringify({ nume: "Tester", rol: "admin", pin: "0000" })
    );
  } else {
    // forțăm explicit "fără backend", indiferent de valoarea reală din
    // data.js (care e cea de producție, cu URL-ul live al utilizatorului)
    window.CONFIG.APPS_SCRIPT_URL = "";
  }

  if (traceCurrent) {
    let _current = window.state.current;
    Object.defineProperty(window.state, "current", {
      get() { return _current; },
      set(v) {
        console.log("DEBUG state.current REASSIGNED. New tag:", v && v.__tag, "stack:\\n" + new Error().stack.split("\\n").slice(1, 5).join("\\n"));
        _current = v;
      },
    });
  }

  window.init();
  // init() cu backend configurat re-verifică sesiunea pe server (apiLogin) în
  // mod asincron înainte de a randa formularul; așteptăm acel round-trip fals.
  if (withBackend) await new Promise((r) => setTimeout(r, 30));
  return window;
}

async function main() {
  // ---------- DISPOZITIV 1: biroul ----------
  const officeWin = await buildAppWindow({ withBackend: true });
  // fără un draft lăsat deschis anterior, aplicația pornește pe ecranul de
  // start — simulăm apăsarea "Fișă nouă"
  officeWin.startNewFisa();
  await new Promise((r) => setTimeout(r, 30));

  const nume = officeWin.document.getElementById("f-clientNume");
  nume.value = "Popescu Ion SRL";
  nume.dispatchEvent(new officeWin.Event("input", { bubbles: true }));

  const vin = officeWin.document.getElementById("f-vin");
  vin.value = "LFOTUNLAND2026000999";
  vin.dispatchEvent(new officeWin.Event("input", { bubbles: true }));

  console.log("Test predare fișă între dispozitive");
  console.log("----------------------------------");

  await officeWin.shareCurrentRecord();
  const docNumber = officeWin.state.current.docNumber;
  if (!docNumber) throw new Error("Biroul nu a primit un număr de document la trimitere");
  console.log("OK: biroul a trimis fișa cu numărul", docNumber);

  if (!fakeBackend.drafts.has(docNumber.toUpperCase())) {
    throw new Error("Draftul nu a ajuns pe 'server' (backend fals)");
  }
  console.log("OK: draftul există pe server pentru", docNumber);

  // ---------- DISPOZITIV 2: atelierul, preia fișa după număr ----------
  const shopWin = await buildAppWindow({ withBackend: true, traceCurrent: true });
  await shopWin.attemptPullByNumber(docNumber);

  if (shopWin.state.current.client.nume !== "Popescu Ion SRL") {
    throw new Error("Atelierul nu a preluat corect numele clientului de la birou");
  }
  if (shopWin.state.current.vehicul.vin !== "LFOTUNLAND2026000999") {
    throw new Error("Atelierul nu a preluat corect VIN-ul de la birou");
  }
  console.log("OK: atelierul a preluat fișa", docNumber, "cu datele completate de birou");

  // atelierul bifează accesorii + PDI și trimite mai departe (actualizează draftul)
  const firstAccessory = shopWin.document.querySelector('.check-item[data-group="acc"] input');
  console.log("DEBUG firstAccessory found:", !!firstAccessory);
  firstAccessory.checked = true;
  firstAccessory.dispatchEvent(new shopWin.Event("change", { bubbles: true }));
  console.log("DEBUG after checkbox dispatch, checks:", JSON.stringify(shopWin.state.current.accesorii.checks));

  const tehnician = shopWin.document.getElementById("f-pdiTehnician");
  console.log("DEBUG tehnician input found:", !!tehnician);
  tehnician.value = "Mihai Georgescu";
  tehnician.dispatchEvent(new shopWin.Event("input", { bubbles: true }));
  console.log("DEBUG after tehnician dispatch:", shopWin.state.current.pdi.tehnician);
  console.log("DEBUG same object?", shopWin.state.current === (firstAccessory.closest ? "n/a" : "n/a"));

  // simulăm autosave-ul (debounced în app) forțând un push manual, ca în viața reală
  console.log("DEBUG _shared:", shopWin.state.current._shared, "docNumber:", shopWin.state.current.docNumber);
  await new Promise((r) => setTimeout(r, 900)); // așteptăm debounce-ul de autosave (600ms)
  console.log("DEBUG draft pe server dupa asteptare:", JSON.stringify(fakeBackend.drafts.get(docNumber.toUpperCase())?.pdi));

  const draftAfterShop = fakeBackend.drafts.get(docNumber.toUpperCase());
  if (!draftAfterShop || draftAfterShop.pdi.tehnician !== "Mihai Georgescu") {
    throw new Error("Modificările atelierului nu s-au sincronizat automat pe server (autosave)");
  }
  console.log("OK: modificările atelierului (autosave) au ajuns pe server");

  // ---------- BIROUL preia ultima versiune (cu modificările atelierului) ----------
  const remoteForOffice = await officeWin.pullDraft(docNumber);
  if (!remoteForOffice || remoteForOffice.pdi.tehnician !== "Mihai Georgescu") {
    throw new Error("Biroul nu a putut prelua ultima versiune de la atelier");
  }
  console.log("OK: biroul poate prelua ultima versiune, cu modificările atelierului");

  // ---------- Finalizare de pe dispozitivul 2 (atelier) ----------
  // fișa se poate finaliza doar după ce verificarea vânzătorului ȘI a
  // service-ului sunt "Pass" — simulăm ambele confirmări. După fiecare
  // verificare, utilizatorul revine la ecranul de start (comportament nou) —
  // simulăm "re-preluarea" fișei cu attemptPullByNumber, cum ar face un
  // coleg (sau chiar același om) din "Fișe în așteptare".
  shopWin.state.current.pdi.tehnician = "Mihai Georgescu";
  await shopWin.handleVerifClick("vanzari", "pass");
  if (shopWin.state.current === null) throw new Error("După Pass, fișa ar trebui să rămână deschisă (nu să revenim automat la Start)");
  await shopWin.trimiteFisaMaiDeparteSiInchide();
  if (shopWin.state.current !== null) throw new Error("După „Trimite mai departe” ar trebui să revenim la ecranul de start");
  console.log("OK: după verificarea vânzătorului + „Trimite mai departe”, atelierul revine la ecranul de start");

  await shopWin.attemptPullByNumber(docNumber);
  await shopWin.handleVerifClick("service", "pass");
  if (shopWin.state.current === null) throw new Error("După Pass, fișa ar trebui să rămână deschisă (nu să revenim automat la Start)");
  await shopWin.trimiteFisaMaiDeparteSiInchide();
  if (shopWin.state.current !== null) throw new Error("După „Trimite mai departe” ar trebui să revenim la ecranul de start");

  await shopWin.attemptPullByNumber(docNumber);
  await shopWin.finalizeCurrentRecord();
  const finalRec = fakeBackend.finals.find(f => f.docNumber === docNumber);
  if (!finalRec) throw new Error("Fișa finalizată nu a ajuns în 'Fise' (backend fals)");
  console.log("OK: fișa finalizată a ajuns în arhiva server (Sheet simulat)");

  if (fakeBackend.drafts.has(docNumber.toUpperCase())) {
    throw new Error("Draftul ar fi trebuit șters de pe server după finalizare");
  }
  console.log("OK: draftul temporar a fost curățat de pe server după finalizare");

  // ---------- Test: fișă inexistentă la preluare ----------
  const missing = await shopWin.pullDraft("ICG-PDI-9999");
  if (missing !== null) throw new Error("Preluarea unui număr inexistent ar fi trebuit să eșueze curat");
  console.log("OK: preluarea unui număr inexistent este gestionată corect (fără crash)");

  // ---------- Test: fără backend configurat, share nu crapă ----------
  const soloWin = await buildAppWindow({ withBackend: false });
  await soloWin.shareCurrentRecord(); // ar trebui doar să afișeze un alert, fără eroare
  console.log("OK: 'Trimite fișa' fără backend configurat nu produce eroare (doar avertizează)");

  console.log("\n✅ TOATE TESTELE DE PREDARE ÎNTRE DISPOZITIVE AU TRECUT");
}

main().catch((err) => {
  console.error("\n❌ TEST EȘUAT:", err);
  process.exit(1);
});
