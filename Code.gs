/**
 * ============================================================
 * Fisa PDI Tunland G7 — backend Google Apps Script
 * Inter Cargo Grup (ICG)
 * ------------------------------------------------------------
 * Acest fișier se lipește într-un proiect Google Apps Script
 * (script.google.com), legat de un Google Sheet dedicat.
 *
 * PAȘI DE INSTALARE:
 * 1. Creează un Google Sheet nou, ex. "Fise PDI Tunland G7".
 * 2. În Sheet: Extensii > Apps Script. Șterge codul exemplu și
 *    lipește tot acest fișier.
 * 3. Rulează o dată funcția `setup` din editor (meniul Run),
 *    ca să se creeze automat foaia "Fise" cu antetele corecte
 *    și folderul-rădăcină din Drive ("Livrări Inter Cargo Foton"),
 *    unde vor apărea automat subfoldere per livrare (PDF + poze).
 * 4. Deploy > New deployment > tip "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone with the link (sau "Anyone" dacă
 *        vrei să meargă și fără cont Google pe telefoanele din atelier)
 * 5. Copiază URL-ul rezultat (se termină în /exec) și pune-l în
 *    fișierul data.js din aplicație, la CONFIG.APPS_SCRIPT_URL.
 * ============================================================
 */

const SHEET_NAME = "Fise";
const DRAFTS_SHEET_NAME = "Drafts";
const USERS_SHEET_NAME = "Utilizatori";
const DRIVE_FOLDER_NAME = "Livrări Inter Cargo Foton"; // folderul-rădăcină din Drive; conține un subfolder per livrare (serie șasiu + model + dată)
const DOC_PREFIX = "ICG-PDI-";

const SHEET_HEADERS = [
  "Nr. document", "Data salvării", "Status",
  "Data livrării", "Locație livrare",
  "Marcă/Model", "Versiune", "Culoare", "VIN", "Serie motor", "An fabricație",
  "KM bord", "Nr. înmatriculare", "Nivel combustibil",
  "Client - Nume", "Client - CNP/CUI", "Client - Adresă", "Client - Telefon", "Client - Email",
  "Tehnician PDI", "Data inspecției", "KM testare",
  "Observații generale", "Link PDF (Drive)",
  // adăugate ulterior, la finalul listei (nu în mijloc), ca să nu deplaseze
  // coloanele unui Sheet deja creat cu `setup()` înainte de suportul EV
  "Tip motorizare", "Nivel baterie (%)",
];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  }
  getOrCreateFolder_();
  getDraftsSheet_();
  getUsersSheet_();
  Logger.log("Setup complet. Foile 'Fise'/'Drafts'/'Utilizatori' și folderul Drive sunt pregătite.");
  Logger.log("Cont admin implicit: nume 'admin', cod 0000 — schimbă-l din foaia 'Utilizatori' sau din aplicație imediat după prima logare.");
}

// ---------------- Utilizatori (autentificare + administrare conturi) ----------------
// Coloane: Nume | Rol (admin/vanzari/service) | Cod PIN | Activ (TRUE/FALSE)
// Ștergerea/dezactivarea unui cont (ex. angajat plecat din companie) se face
// fie direct din acest Sheet, fie din ecranul de administrare din aplicație
// (tab "Utilizatori", vizibil doar contului cu rol admin).

function getUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(["Nume", "Rol", "Cod PIN", "Activ"]);
    sheet.appendRow(["admin", "admin", "0000", true]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findUserRow_(sheet, nume) {
  const data = sheet.getDataRange().getValues();
  const target = String(nume || "").trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === target) {
      return { rowIndex: i + 1, nume: data[i][0], rol: data[i][1], pin: String(data[i][2]), activ: data[i][3] !== false };
    }
  }
  return null;
}

function login_(nume, pin) {
  const sheet = getUsersSheet_();
  const user = findUserRow_(sheet, nume);
  if (!user) return { ok: false, error: "Utilizator necunoscut." };
  if (!user.activ) return { ok: false, error: "Acest cont a fost dezactivat. Contactează administratorul." };
  if (String(pin).trim() !== user.pin) return { ok: false, error: "Cod PIN incorect." };
  return { ok: true, nume: user.nume, rol: user.rol };
}

// Verifică, pe server, că cel ce cere o acțiune de administrare este chiar
// un admin activ — nu ne bazăm doar pe ce afirmă aplicația din telefon.
function requireAdmin_(nume, pin) {
  const sheet = getUsersSheet_();
  const user = findUserRow_(sheet, nume);
  if (!user || !user.activ || user.rol !== "admin" || String(pin).trim() !== user.pin) {
    throw new Error("Acces refuzat — necesită cont de administrator activ.");
  }
  return user;
}

function listUsers_(adminNume, adminPin) {
  requireAdmin_(adminNume, adminPin);
  const sheet = getUsersSheet_();
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    users.push({ nume: data[i][0], rol: data[i][1], activ: data[i][3] !== false }); // codul PIN nu se trimite înapoi
  }
  return { ok: true, users };
}

function addUser_(adminNume, adminPin, newNume, newRol, newPin) {
  requireAdmin_(adminNume, adminPin);
  if (!newNume || !newPin) return { ok: false, error: "Nume și cod PIN sunt obligatorii." };
  const sheet = getUsersSheet_();
  if (findUserRow_(sheet, newNume)) return { ok: false, error: "Există deja un utilizator cu acest nume." };
  sheet.appendRow([newNume, newRol || "vanzari", String(newPin), true]);
  return { ok: true };
}

function setUserActive_(adminNume, adminPin, targetNume, activ) {
  requireAdmin_(adminNume, adminPin);
  const sheet = getUsersSheet_();
  const user = findUserRow_(sheet, targetNume);
  if (!user) return { ok: false, error: "Utilizatorul nu a fost găsit." };
  sheet.getRange(user.rowIndex, 4).setValue(!!activ);
  return { ok: true };
}

// Ștergerea definitivă a unui cont — de folosit când un angajat pleacă din
// companie și nu mai trebuie să aibă niciodată acces (spre deosebire de
// simpla dezactivare, care păstrează rândul pentru istoric/audit).
function deleteUser_(adminNume, adminPin, targetNume) {
  const admin = requireAdmin_(adminNume, adminPin);
  if (String(targetNume).trim().toLowerCase() === String(admin.nume).trim().toLowerCase()) {
    return { ok: false, error: "Nu îți poți șterge propriul cont de administrator." };
  }
  const sheet = getUsersSheet_();
  const user = findUserRow_(sheet, targetNume);
  if (!user) return { ok: false, error: "Utilizatorul nu a fost găsit." };
  sheet.deleteRow(user.rowIndex);
  return { ok: true };
}

function changeOwnPin_(nume, oldPin, newPin) {
  const sheet = getUsersSheet_();
  const user = findUserRow_(sheet, nume);
  if (!user) return { ok: false, error: "Utilizator necunoscut." };
  if (String(oldPin).trim() !== user.pin) return { ok: false, error: "Codul PIN actual este greșit." };
  if (!newPin || String(newPin).trim().length < 4) return { ok: false, error: "Noul cod PIN trebuie să aibă cel puțin 4 cifre." };
  sheet.getRange(user.rowIndex, 3).setValue(String(newPin).trim());
  return { ok: true };
}

function getDraftsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DRAFTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DRAFTS_SHEET_NAME);
    sheet.appendRow(["Nr. document", "JSON fișă", "Actualizat la"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// Un subfolder dedicat FIECĂREI livrări (serie de șasiu), în interiorul
// folderului-rădăcină "Livrări Inter Cargo Foton" — conține PDF-ul fișei și
// toate pozele vehiculului pentru acea livrare. Numele include seria de
// șasiu, modelul și data livrării, ca să fie ușor de identificat direct din
// lista de foldere din Drive, fără să deschizi fiecare fișier.
function getVehicleFolder_(record) {
  const root = getOrCreateFolder_();
  const v = record.vehicul || {};
  const vin = String(v.vin || "VIN necompletat").trim() || "VIN necompletat";
  const model = ([v.marca, v.model].filter(Boolean).join(" ") || v.marcaModel || "model necompletat").trim();
  const data = String(record.dataLivrarii || "data necompletata").trim();
  const folderName = (vin + " — " + model + " — " + data).replace(/[\/\\?%*:|"<>]/g, "-");
  const existing = root.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(folderName);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Foaia '" + SHEET_NAME + "' nu există. Rulează funcția setup() o dată.");
  return sheet;
}

// ---------------- Numerotare automată ----------------
// Folosim un contor atomic în Script Properties (cu blocare), NU scanarea
// foii de calcul — altfel două dispozitive care cer un număr aproape
// simultan (ex: doi angajați deschid fiecare o fișă nouă) ar putea primi
// din greșeală același număr, întrucât fișele nefinalizate nu apar încă
// în foaia "Fise".

function computeNextDocNumber_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const props = PropertiesService.getScriptProperties();
    let n = parseInt(props.getProperty("LAST_DOC_NUMBER") || "0", 10);
    n += 1;
    props.setProperty("LAST_DOC_NUMBER", String(n));
    return DOC_PREFIX + String(n).padStart(4, "0");
  } finally {
    lock.releaseLock();
  }
}

// Rulează manual O SINGURĂ DATĂ dacă vrei ca numerotarea să înceapă de la
// alt număr decât 1 (ex: dacă preiei o numerotare existentă pe hârtie).
// Exemplu: setLastDocNumber(42) -> următoarea fișă nouă va fi ICG-PDI-0043.
function setLastDocNumber(n) {
  PropertiesService.getScriptProperties().setProperty("LAST_DOC_NUMBER", String(n));
}

// ---------------- Endpoint-uri HTTP ----------------

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === "nextNumber") {
      return jsonResponse_({ ok: true, docNumber: computeNextDocNumber_() });
    }
    if (action === "getDraft") {
      return jsonResponse_(getDraft_(e.parameter.docNumber));
    }
    if (action === "searchFinalized") {
      return jsonResponse_(searchFinalized_(e.parameter.q || ""));
    }
    if (action === "listUsers") {
      return jsonResponse_(listUsers_(e.parameter.adminNume, e.parameter.adminPin));
    }
    if (action === "listOpenRecords") {
      return jsonResponse_(listOpenRecords_());
    }
    return jsonResponse_({ ok: false, error: "Acțiune necunoscută" });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "saveRecord") {
      return jsonResponse_(saveRecord_(body));
    }
    if (body.action === "saveDraft") {
      return jsonResponse_(saveDraft_(body));
    }
    if (body.action === "login") {
      return jsonResponse_(login_(body.nume, body.pin));
    }
    if (body.action === "changeOwnPin") {
      return jsonResponse_(changeOwnPin_(body.nume, body.oldPin, body.newPin));
    }
    if (body.action === "addUser") {
      return jsonResponse_(addUser_(body.adminNume, body.adminPin, body.newNume, body.newRol, body.newPin));
    }
    if (body.action === "setUserActive") {
      return jsonResponse_(setUserActive_(body.adminNume, body.adminPin, body.targetNume, body.activ));
    }
    if (body.action === "deleteUser") {
      return jsonResponse_(deleteUser_(body.adminNume, body.adminPin, body.targetNume));
    }
    return jsonResponse_({ ok: false, error: "Acțiune necunoscută" });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// ---------------- Predare fișă între dispozitive (draft comun) ----------------
// Un "draft" e o copie temporară, identificată prin numărul de document,
// care permite ca o a doua persoană (alt telefon/calculator) să continue
// aceeași fișă. La finalizare, draftul e șters (varianta finală rămâne în
// foaia "Fise" + PDF-ul în Drive).

function getDraft_(docNumber) {
  if (!docNumber) return { ok: false, error: "Lipsește numărul documentului" };
  const sheet = getDraftsSheet_();
  const data = sheet.getDataRange().getValues();
  const target = String(docNumber).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === target) {
      return { ok: true, record: JSON.parse(data[i][1]), updatedAt: data[i][2] };
    }
  }
  return { ok: false, error: "Fișa " + docNumber + " nu a fost găsită. Verifică numărul." };
}

function saveDraft_(body) {
  const docNumber = body.docNumber;
  if (!docNumber) return { ok: false, error: "Lipsește numărul documentului" };
  const sheet = getDraftsSheet_();
  const data = sheet.getDataRange().getValues();
  const target = String(docNumber).trim().toUpperCase();
  const json = JSON.stringify(body.record);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === target) {
      sheet.getRange(i + 1, 2).setValue(json);
      sheet.getRange(i + 1, 3).setValue(new Date());
      return { ok: true, docNumber };
    }
  }
  sheet.appendRow([docNumber, json, new Date()]);
  return { ok: true, docNumber };
}

// Rezumatul TUTUROR fișelor trimise ("Drafts") — folosit pentru tabloul
// "Fișe în așteptare", vizibil oricui deschide aplicația (nu doar celui care
// a completat fișa), ca oricine din echipă să vadă ce mai e de rezolvat și
// la cine e restanța. Ignoră liniile care nu se mai pot interpreta ca JSON
// valid (nu blochează tot raportul din cauza unei singure linii corupte).
function listOpenRecords_() {
  const sheet = getDraftsSheet_();
  const data = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const docNumber = data[i][0];
    if (!docNumber) continue;
    let record;
    try {
      record = JSON.parse(data[i][1]);
    } catch (e) {
      continue; // linie coruptă/incompletă — o sărim
    }
    const v = record.vehicul || {};
    const vz = record.verificareVanzari || {};
    const sv = record.verificareService || {};
    out.push({
      docNumber: docNumber,
      updatedAt: data[i][2],
      model: [v.marca, v.model].filter(Boolean).join(" "),
      clientNume: (record.client && record.client.nume) || "",
      verificareVanzari: { status: vz.status || null, motiv: vz.motiv || "", de: vz.de || "" },
      verificareService: { status: sv.status || null, motiv: sv.motiv || "", de: sv.de || "" },
    });
  }
  // cele mai recent actualizate primele
  out.sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
  return { ok: true, records: out };
}

function deleteDraft_(docNumber) {
  if (!docNumber) return;
  const sheet = getDraftsSheet_();
  const data = sheet.getDataRange().getValues();
  const target = String(docNumber).trim().toUpperCase();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim().toUpperCase() === target) {
      sheet.deleteRow(i + 1);
    }
  }
}

function saveRecord_(body) {
  const record = body.record;
  const sheet = getSheet_();

  let docNumber = record.docNumber;
  if (!docNumber) docNumber = computeNextDocNumber_();

  // salvează PDF-ul și pozele vehiculului în același subfolder Drive, dedicat
  // acestei livrări (serie șasiu + model + dată) — vezi getVehicleFolder_().
  // Denumirea PDF-ului (stabilită de aplicație, în app-pdf.js: buildPdfFilename)
  // include și ea seria de șasiu și numele clientului.
  let driveUrl = "";
  let folderUrl = "";
  const needsFolder = body.pdfBase64 || (body.poze && body.poze.length);
  if (needsFolder) {
    const vehicleFolder = getVehicleFolder_(record);
    folderUrl = vehicleFolder.getUrl();

    if (body.pdfBase64) {
      const bytes = Utilities.base64Decode(body.pdfBase64);
      const blob = Utilities.newBlob(bytes, "application/pdf", body.pdfFilename || (docNumber + ".pdf"));
      const file = vehicleFolder.createFile(blob);
      driveUrl = file.getUrl();
    }

    if (body.poze && body.poze.length) {
      body.poze.forEach(function (p) {
        try {
          const bytes = Utilities.base64Decode(p.dataBase64);
          const blob = Utilities.newBlob(bytes, "image/jpeg", p.filename || ((p.key || "poza") + ".jpg"));
          vehicleFolder.createFile(blob);
        } catch (e) {
          // o poză individuală coruptă/eșuată nu trebuie să blocheze salvarea restului fișei
        }
      });
    }
  }

  const v = record.vehicul || {};
  const c = record.client || {};
  const p = record.pdi || {};

  const row = [
    docNumber,
    new Date(),
    record.status || "finalizat",
    record.dataLivrarii || "",
    record.locatieLivrare || "",
    [v.marca, v.model].filter(Boolean).join(" ") || v.marcaModel || "", v.versiune || "", v.culoare || "", v.vin || "", v.serieMotor || "", v.anFabricatie || "",
    v.kmBord || "", v.nrInmatriculare || "", v.nivelCombustibil || "",
    c.nume || "", c.cnpCui || "", c.adresa || "", c.telefon || "", c.email || "",
    p.tehnician || "", p.dataInspectiei || "", p.kmTestare || "",
    record.observatiiGenerale || "",
    driveUrl,
    v.tipMotorizare === "electric" ? "Electric" : "Termic (ICE)",
    v.nivelBaterie || "",
  ];
  sheet.appendRow(row);

  deleteDraft_(docNumber); // varianta finală e în "Fise" + Drive; draftul temporar nu mai e necesar

  return { ok: true, docNumber, driveUrl, folderUrl };
}

// ---------------- Căutare în arhiva centrală (fișe finalizate) ----------------
// Permite aplicației să caute, direct din telefon/birou, o fișă deja
// finalizată și salvată în Drive — după VIN, numele clientului, numărul
// de document sau numărul de înmatriculare — fără să deschizi Sheet-ul.

function searchFinalized_(query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) {
    return { ok: false, error: "Scrie cel puțin 2 caractere pentru căutare." };
  }
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, results: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  const results = [];
  for (let i = values.length - 1; i >= 0 && results.length < 25; i--) {
    const row = values[i];
    const docNumber = String(row[0] || "");
    const dataSalvarii = row[1];
    const marcaModel = String(row[5] || "");
    const vin = String(row[8] || "");
    const nrInmatriculare = String(row[12] || "");
    const clientNume = String(row[14] || "");
    const driveUrl = String(row[23] || "");

    const haystack = (docNumber + " " + marcaModel + " " + vin + " " + nrInmatriculare + " " + clientNume).toLowerCase();
    if (haystack.indexOf(q) !== -1) {
      results.push({
        docNumber, marcaModel, vin, nrInmatriculare,
        clientNume, driveUrl,
        dataSalvarii: dataSalvarii ? new Date(dataSalvarii).toISOString() : "",
      });
    }
  }
  return { ok: true, results };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
