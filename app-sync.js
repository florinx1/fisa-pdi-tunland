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
    return;
  }
  if (!navigator.onLine) {
    record._pendingSync = true;
    upsertCurrentIntoRecordsSafe(record);
    showToast("Offline — fișa se va sincroniza automat la reconectare");
    return;
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
    } else {
      throw new Error((json && json.error) || "răspuns necunoscut de la server");
    }
  } catch (e) {
    console.error("Eroare sincronizare", e);
    record._pendingSync = true;
    upsertCurrentIntoRecordsSafe(record);
    showToast("Nu s-a putut sincroniza acum — reîncerc mai târziu");
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

// Construiește lista de poze de trimis la backend (doar cele făcute local,
// nu deja marcate ca "încărcate" — vezi syncRecord). Fiecare poză devine un
// fișier separat în Drive, în folderul dedicat livrării, nu text în Sheet.
function buildPozePayload(record) {
  if (!record.poze) return [];
  return FOTO_TIPURI
    .filter(ft => typeof record.poze[ft.key] === "string" && record.poze[ft.key])
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

async function pushDraft(record) {
  if (!backendConfigured()) return { ok: false, error: "Backend-ul (Apps Script) nu e configurat încă în data.js." };
  if (!record.docNumber) return { ok: false, error: "Fișa nu are încă un număr de document." };
  try {
    // draftul e stocat ca text într-un rând din Sheet (limită ~50.000 caractere
    // pe celulă) — pozele (base64) NU încap acolo și oricum se urcă separat,
    // direct în Drive, doar la finalizare (syncRecord); aici le excludem.
    const recordForDraft = stripTransient(record);
    delete recordForDraft.poze;
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
