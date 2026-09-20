/* ============================================================
   Sincronizare cu backend-ul Google Apps Script (Sheets + Drive)
   — funcționează și fără backend configurat: totul rămâne local,
   iar sincronizarea se reia automat quando URL-ul e completat.
   ============================================================ */

function backendConfigured() {
  return !!(CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.startsWith("http"));
}

async function syncRecord(record) {
  if (!backendConfigured()) {
    record._pendingSync = true;
    upsertCurrentIntoRecordsSafe(record);
    return { ok: false, error: "backend neconfigurat" };
  }
  if (!navigator.onLine) {
    record._pendingSync = true;
    upsertCurrentIntoRecordsSafe(record);
    showToast("Offline — fișa se va sincroniza automat la reconectare");
    return { ok: false, error: "offline" };
  }

  try {
    const doc = generatePdf(record, { download: false, open: false });
    const pdfBase64 = doc ? doc.output("datauristring").split(",")[1] : null;

    const poze = buildPozePayload(record);
    const recordForSync = stripTransient(record);
    delete recordForSync.poze; // pozele merg separat, ca fișiere în Drive — nu ca text în fișă

    const payload = {
      action: "saveRecord",
      record: recordForSync,
      pdfBase64,
      pdfFilename: buildPdfFilename(record),
      poze,
    };

    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // evită preflight CORS pe Apps Script
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json && json.ok) {
      if (json.docNumber) record.docNumber = json.docNumber;
      if (json.driveUrl) record.driveUrl = json.driveUrl;
      if (json.folderUrl) record.folderUrl = json.folderUrl;
      record._pendingSync = false;
      // pozele sunt deja în siguranță în Drive — golim datele grele (base64)
      // păstrate local, ca să nu umplem localStorage; păstrăm doar un semn
      // "încărcată" (true), afișat ca atare în formular.
      if (poze.length) {
        poze.forEach(p => { record.poze[p.key] = true; });
      }
      upsertCurrentIntoRecordsSafe(record);
      showToast("Sincronizat cu Google Drive ✓");
      return { ok: true };
    } else {
      throw new Error((json && json.error) || "răspuns necunoscut de la server");
    }
  } catch (e) {
    console.error("Eroare sincronizare", e);
    record._pendingSync = true;
    upsertCurrentIntoRecordsSafe(record);
    showToast("Nu s-a putut sincroniza acum — reîncerc mai târziu");
    return { ok: false, error: String((e && e.message) || e) };
  }
}

function upsertCurrentIntoRecordsSafe(record) {
  const idx = state.records.findIndex(r => r.id === record.id);
  if (idx >= 0) state.records[idx] = record;
  else state.records.unshift(record);
  saveRecords();
}

function stripTransient(record) {
  const clone = JSON.parse(JSON.stringify(record));
  delete clone._openInForm;
  delete clone._pendingSync;
  return clone;
}

// Construiește lista de poze de trimis la backend ca PLASĂ DE SIGURANȚĂ la
// finalizare — de obicei goală, pentru că fiecare poză a fost deja trimisă
// separat, imediat după ce a fost făcută (vezi uploadPhotoInBackground).
// Include aici DOAR pozele făcute local care nu au fost încă confirmate ca
// urcate (ex: au fost făcute offline, sau upload-ul imediat a eșuat) — nu
// retrimitem inutil poze deja în Drive, ca să păstrăm acest request mic.
function buildPozePayload(record) {
  if (!record.poze) return [];
  const uploaded = record.pozeUploaded || {};
  return FOTO_TIPURI
    .filter(ft => typeof record.poze[ft.key] === "string" && record.poze[ft.key] && !uploaded[ft.key])
    .map(ft => ({
      key: ft.key,
      filename: ft.key + ".jpg",
      dataBase64: record.poze[ft.key].split(",")[1] || record.poze[ft.key],
    }));
}

async function trySyncPending() {
  if (!backendConfigured() || !navigator.onLine) return;
  const pending = state.records.filter(r => r._pendingSync && r.status === "finalizat");
  for (const rec of pending) {
    await syncRecord(rec);
  }
}

// reîncearcă automat când revine conexiunea
window.addEventListener("online", () => {
  setTimeout(trySyncPending, 1500);
});

// și, în plus, periodic — o fișă poate rămâne "în așteptare" chiar și fără
// nicio tranziție de conexiune (ex: serverul a răspuns cu eroare o singură
// dată), caz în care evenimentul "online" de mai sus nu s-ar mai declanșa
// niciodată în restul sesiunii. La fiecare 3 minute, cât timp aplicația e
// deschisă, mai încercăm o dată.
const __pendingSyncIntervalId = setInterval(trySyncPending, 3 * 60 * 1000);
// .unref() există doar în Node (folosit de testele automate, care rulează
// acest fișier direct în jsdom) — într-un browser adevărat nu există și nu
// trebuie apelat, altfel ar arunca eroare la încărcarea aplicației.
if (typeof __pendingSyncIntervalId === "object" && typeof __pendingSyncIntervalId.unref === "function") {
  __pendingSyncIntervalId.unref();
}

// obține următorul număr de document de la backend (dacă e configurat),
// altfel folosește contorul local
async function requestDocNumber() {
  if (!backendConfigured() || !navigator.onLine) {
    return formatDocNumber(nextLocalNumber());
  }
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=nextNumber`);
    const json = await res.json();
    if (json && json.docNumber) return json.docNumber;
  } catch (e) {
    console.warn("Nu s-a putut obține numărul de la server, folosesc contorul local", e);
  }
  return formatDocNumber(nextLocalNumber());
}

// ---------------- Predare fișă între dispozitive ----------------
// O fișă "partajată" (record._shared === true) e împinsă către backend la
// fiecare autosave, astfel încât altă persoană, pe alt dispozitiv, s-o poată
// prelua după numărul de document și continua completarea.

// O celulă din Google Sheet are o limită de ~50.000 de caractere. Poze DE LA
// CAMERĂ nu ajung niciodată în draft (vezi mai jos), dar o SEMNĂTURĂ desenată
// pe ecran, la rezoluția reală a telefonului, poate depăși SINGURĂ această
// limită (verificat: o singură semnătură poate ajunge la 70-80.000 de
// caractere) — motiv pentru care semnătura vânzătorului se pierdea la
// predarea fișei către service. Peste acest prag, o urcăm direct în Drive și
// trimitem în draft doar un link mic, în loc de imaginea completă.
const SIGNATURE_INLINE_MAX_CHARS = 4000;

async function offloadLargeSignatures_(record, recordForDraft) {
  const s = record.semnaturi || {};
  const keys = ["icg", "pdi", "client"];
  for (const who of keys) {
    const val = s[`${who}Semnatura`];
    if (typeof val === "string" && val.indexOf("data:") === 0 && val.length > SIGNATURE_INLINE_MAX_CHARS) {
      const dataBase64 = val.split(",")[1] || val;
      const uploadResult = await apiUploadSignature(record, who, dataBase64);
      if (uploadResult && uploadResult.ok) {
        recordForDraft.semnaturi[`${who}Semnatura`] = { _driveRef: true, url: uploadResult.url, fileId: uploadResult.fileId };
      }
      // dacă upload-ul eșuează (ex. offline), lăsăm dataURL-ul mare — saveDraft_
      // ar putea respinge celula prea mare, dar preferăm o eroare vizibilă
      // ("nu s-a putut trimite") unei pierderi silențioase a semnăturii
    }
  }
}

async function apiUploadSignature(record, who, dataBase64) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "uploadSignature",
      who,
      dataBase64,
      docNumber: record.docNumber,
      vehicul: record.vehicul,
      dataLivrarii: record.dataLivrarii,
    }),
  });
  return await res.json();
}

async function apiGetSignatureImage(fileId) {
  const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getSignatureImage&fileId=${encodeURIComponent(fileId)}`);
  return await res.json();
}

// Trimite O SINGURĂ poză către Drive, imediat după ce a fost făcută pe
// dispozitiv — la fel ca semnăturile, nu se mai așteaptă până la
// "Finalizează" ca să urce toate pozele deodată (vezi comentariul din
// uploadPhoto_, Code.gs, pentru de ce s-a schimbat asta). Best-effort: dacă
// eșuează (offline, eroare server), poza rămâne local și e retrimisă la
// finalizare, prin buildPozePayload — nu se pierde, doar ajunge mai târziu.
async function uploadPhotoInBackground(record, key, dataUrl) {
  if (!backendConfigured() || !navigator.onLine) return;
  try {
    const dataBase64 = dataUrl.split(",")[1] || dataUrl;
    const result = await apiUploadPhoto(record, key, dataBase64);
    if (result && result.ok) {
      record.pozeUploaded = record.pozeUploaded || {};
      record.pozeUploaded[key] = true;
      if (result.folderUrl) record.folderUrl = result.folderUrl;
      upsertCurrentIntoRecordsSafe(record);
    }
  } catch (e) {
    console.error("Eroare urcare poză", key, e);
    // best-effort — poza rămâne local, se retrimite la "Finalizează"
  }
}

async function apiUploadPhoto(record, key, dataBase64) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "uploadPhoto",
      key,
      dataBase64,
      vehicul: record.vehicul,
      dataLivrarii: record.dataLivrarii,
    }),
  });
  return await res.json();
}

// Listă cu link direct către fiecare poză a vehiculului (nu folderul întreg),
// citită la cerere din Drive — folosită de butonul "Vezi poze" din arhivă.
async function apiListPhotos(folderUrl) {
  if (!backendConfigured() || !folderUrl) return null;
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=listPhotos&folderUrl=${encodeURIComponent(folderUrl)}`);
    const json = await res.json();
    if (json && json.ok) return json.photos;
    showToast((json && json.error) || "Nu s-au putut încărca pozele.");
    return null;
  } catch (e) {
    console.error("Eroare listare poze", e);
    showToast("Eroare de conexiune — încearcă din nou.");
    return null;
  }
}

async function pushDraft(record) {
  if (!backendConfigured()) return { ok: false, error: "Backend-ul (Apps Script) nu e configurat încă în data.js." };
  if (!record.docNumber) return { ok: false, error: "Fișa nu are încă un număr de document." };
  try {
    // draftul e stocat ca text într-un rând din Sheet (limită ~50.000 caractere
    // pe celulă) — pozele (base64) NU încap acolo și oricum se urcă separat,
    // direct în Drive, doar la finalizare (syncRecord); aici le excludem.
    const recordForDraft = stripTransient(record);
    delete recordForDraft.poze;
    await offloadLargeSignatures_(record, recordForDraft);
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "saveDraft",
        docNumber: record.docNumber,
        record: recordForDraft,
      }),
    });
    const json = await res.json();
    return json && json.ok ? { ok: true } : { ok: false, error: (json && json.error) || "eroare necunoscută" };
  } catch (e) {
    console.error("Eroare trimitere draft", e);
    return { ok: false, error: "eroare de rețea" };
  }
}

async function pullDraft(docNumber) {
  if (!backendConfigured()) {
    showToast("Backend-ul (Apps Script) nu e configurat — nu pot prelua fișe de pe alte dispozitive.");
    return null;
  }
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getDraft&docNumber=${encodeURIComponent(docNumber)}`);
    const json = await res.json();
    if (json && json.ok) return normalizeRecord(json.record);
    showToast((json && json.error) || "Fișa nu a fost găsită.");
    return null;
  } catch (e) {
    console.error("Eroare preluare draft", e);
    showToast("Eroare de conexiune — încearcă din nou.");
    return null;
  }
}

// ---------------- Căutare în arhiva centrală (Drive/Sheet) ----------------
// Spre deosebire de arhiva locală (acest dispozitiv), aceasta caută printre
// TOATE fișele finalizate de oricine, oriunde — utilă când cineva vrea să
// regăsească o fișă mai veche, indiferent pe ce telefon a fost făcută.

async function searchFinalizedRemote(query) {
  if (!backendConfigured()) {
    showToast("Backend-ul (Apps Script) nu e configurat — arhiva centrală nu e disponibilă.");
    return null;
  }
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=searchFinalized&q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json && json.ok) return json.results;
    showToast((json && json.error) || "Căutarea a eșuat.");
    return null;
  } catch (e) {
    console.error("Eroare căutare arhivă centrală", e);
    showToast("Eroare de conexiune — încearcă din nou.");
    return null;
  }
}

// ---------------- Fișe în așteptare (nefinalizate, indiferent de dispozitiv) ----------------
// Orice fișă "trimisă mai departe" (vezi pushDraft) e stocată pe server în
// foaia "Drafts", keyed după numărul de document. Acest apel citește TOATE
// draft-urile de acolo (nu unul singur după număr) ca să afișăm un tablou cu
// fișele aflate încă în lucru — cine are treabă restantă și de ce.

async function fetchOpenRecords() {
  if (!backendConfigured()) {
    showToast("Backend-ul (Apps Script) nu e configurat — lista de fișe în așteptare nu e disponibilă.");
    return null;
  }
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=listOpenRecords`);
    const json = await res.json();
    if (json && json.ok) return json.records;
    showToast((json && json.error) || "Nu am putut încărca lista.");
    return null;
  } catch (e) {
    console.error("Eroare încărcare fișe în așteptare", e);
    showToast("Eroare de conexiune — încearcă din nou.");
    return null;
  }
}

// ---------------- Liste de personal (Vânzători / Personal service) ----------------
// Florin completează aceste două liste direct în Sheet (tab-urile "Vanzatori"
// și "PersonalService", un nume pe rând) — aplicația le preia de acolo la
// fiecare pornire și le ține și într-un cache local, ca dropdown-urile din
// secțiunea de semnături să nu rămână goale dacă nu există semnal chiar în
// momentul deschiderii aplicației (ex. atelier fără net stabil).

const LISTE_PERSONAL_CACHE_KEY = "icg_fise_pdi_liste_personal_v1";

function loadCachedListePersonal() {
  try {
    const raw = localStorage.getItem(LISTE_PERSONAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveCachedListePersonal(liste) {
  try {
    localStorage.setItem(LISTE_PERSONAL_CACHE_KEY, JSON.stringify(liste));
  } catch (e) { /* best-effort */ }
}

// Sincronă — aplică imediat ultima variantă cunoscută local, înainte ca
// prima randare a formularului să aibă loc (altfel dropdown-urile ar apărea
// goale o clipă, apoi s-ar "umple" abia după ce sosește răspunsul de rețea).
function applyCachedListePersonal() {
  const cached = loadCachedListePersonal();
  if (cached) {
    if (Array.isArray(cached.vanzatori)) VANZATORI = cached.vanzatori;
    if (Array.isArray(cached.personalService)) PERSONAL_SERVICE = cached.personalService;
  }
}

// Asincronă — preia varianta curentă de pe server și o suprascrie pe cea din
// memorie + cache. Returnează true dacă listele s-au schimbat față de ce era
// deja afișat (ca apelantul să decidă dacă merită un re-render).
async function refreshListePersonal() {
  if (!backendConfigured()) return false;
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getListe`);
    const json = await res.json();
    if (!json || !json.ok) return false;
    const before = JSON.stringify({ vanzatori: VANZATORI, personalService: PERSONAL_SERVICE });
    VANZATORI = json.vanzatori || [];
    PERSONAL_SERVICE = json.personalService || [];
    saveCachedListePersonal({ vanzatori: VANZATORI, personalService: PERSONAL_SERVICE });
    return before !== JSON.stringify({ vanzatori: VANZATORI, personalService: PERSONAL_SERVICE });
  } catch (e) {
    console.warn("Nu am putut prelua listele de personal de pe server — folosesc ultima variantă cunoscută", e);
    return false;
  }
}

// ---------------- Autentificare & administrare conturi ----------------
// Contul e verificat pe server (Sheet-ul "Utilizatori"), nu doar local —
// altfel un cont dezactivat de admin ar rămâne funcțional pe un telefon
// care încă are sesiunea salvată. Fără backend configurat, aplicația
// funcționează fără logare (mod „un singur utilizator”, ca înainte).

async function apiLogin(nume, pin) {
  if (!backendConfigured()) return { ok: true, nume, rol: "admin", noBackend: true };
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "login", nume, pin }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: "Eroare de conexiune — verifică internetul și încearcă din nou." };
  }
}

async function apiChangeOwnPin(nume, oldPin, newPin) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "changeOwnPin", nume, oldPin, newPin }),
  });
  return await res.json();
}

async function apiListUsers(adminNume, adminPin) {
  const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=listUsers&adminNume=${encodeURIComponent(adminNume)}&adminPin=${encodeURIComponent(adminPin)}`);
  return await res.json();
}

async function apiAddUser(adminNume, adminPin, newNume, newRol, newPin) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "addUser", adminNume, adminPin, newNume, newRol, newPin }),
  });
  return await res.json();
}

async function apiSetUserActive(adminNume, adminPin, targetNume, activ) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "setUserActive", adminNume, adminPin, targetNume, activ }),
  });
  return await res.json();
}

async function apiDeleteUser(adminNume, adminPin, targetNume) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "deleteUser", adminNume, adminPin, targetNume }),
  });
  return await res.json();
}

// Ștergere definitivă a unei fișe (draft + rând finalizat + folder Drive) —
// doar admin; folosită pentru curățarea fișelor de test. Vezi deleteRecord_
// în Code.gs.
async function apiDeleteRecord(adminNume, adminPin, docNumber) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "deleteRecord", adminNume, adminPin, docNumber }),
  });
  return await res.json();
}
