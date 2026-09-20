/* ============================================================
   Fisa PDI Tunland G7 — data model & static checklist definitions
   Inter Cargo Grup (ICG)
   ============================================================ */

// !!! După ce publici Apps Script-ul ca Web App, pune URL-ul aici !!!
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxQbJ9YToh208dXSEgOG4s1QOGc2o5MNRwOIhc_OsD0BYSY72s7OwIcwDFTFPb5nBJkXw/exec",
  COMPANY_NAME: "INTER CARGO GRUP",
  COMPANY_SUB: "Distribuitor comercial  •  Bragadiru, jud. Ilfov, România",
  COMPANY_DEPT: "Departament Aftersales & Piese de schimb",
  DOC_PREFIX: "ICG-PDI-",
  LOGO_URL: "logo-full.png", // sigla completă (icon + text), folosită în antetul aplicației și pe ecranul de logare; dacă lipsește, se folosește doar numele companiei scris
};

// ---------- Liste statice (aceleași ca în fișa PDF) ----------
// Notă privind fluxul de lucru: secțiunea DOCUMENTE se pregătește de
// obicei de o persoană de la birou (facturare, C.I.V., CoC etc.), iar
// secțiunea INSPECȚIE PDI se completează de personalul din service la
// mașină. Secțiunile sunt de aceea capitole complet separate.

const DOCUMENTE = [
  { key: "manual", label: "Manual de utilizare (limba română)" },
  { key: "garantie", label: "Carte de garanție" },
  { key: "carnetService", label: "Carnet / plan de service" },
  { key: "coc", label: "Certificat de conformitate (CoC)" },
  { key: "civ", label: "Carte de identitate vehicul (C.I.V.)" },
  { key: "factura", label: "Factură fiscală" },
];

// ---------- Tip motorizare (termic / electric) ----------
// Structura fișei (inventar accesorii + inspecție PDI) diferă între un
// vehicul termic (ICE — motor cu ardere internă) și unul electric (EV) —
// vezi ACCESORII_ICE/ACCESORII_ELECTRIC și PDI_GROUPS_ICE/PDI_GROUPS_ELECTRIC
// mai jos. Operatorul alege tipul dintr-un buton dedicat în secțiunea 1, dar
// alegerea modelului (vezi MODELE_PE_MARCA) îl pre-completează automat.

const TIP_MOTORIZARE = {
  ICE: "ice",
  ELECTRIC: "electric",
  // pentru un model care există în ambele variante (ex. un model termic
  // și electric sub același nume) — vezi MODELE_PE_MARCA mai jos
  AMBELE: "ambele",
};

// Roată de rezervă ȘI kit de reparat pană apar acum ca bife SEPARATE, la
// ambele tipuri de motorizare — unele modele electrice au totuși roată de
// rezervă, iar unele termice vin doar cu kit de pană, deci operatorul bifează
// pe cea care se potrivește vehiculului din fața lui, nu una impusă de tip.
const ACCESORII_COMUNE = [
  { key: "cuiTractare", label: "Cui de tractare (bară de tractare) montat (dacă este cazul)" },
  { key: "pachetLegislativ", label: "Pachet legislativ complet (triunghi reflectorizant, vestă reflectorizantă, trusă/kit prim ajutor, stingător)" },
  { key: "trusaScule", label: "Trusă de scule" },
  { key: "roataRezerva", label: "Roată de rezervă (completă, presiune verificată)" },
  { key: "kitReparatiePana", label: "Kit reparație pană / etanșant + compresor" },
  { key: "covorase", label: "Covorașe cauciuc / mochetă" },
  { key: "prelata", label: "Prelată / husă bena (dacă este cazul)" },
  { key: "bareTransversale", label: "Bare transversale plafon (dacă este cazul)" },
  { key: "covorBena", label: "Covor / protecție bena (dacă este cazul)" },
  { key: "extinctorSuplimentar", label: "Extinctor suplimentar" },
  { key: "cric", label: "Cric și tija de manevrare cric" },
];

// Doar la vehiculele electrice — cablurile de încărcare.
const ACCESORII_ELECTRIC_SUPLIMENTAR = [
  { key: "cabluIncarcareMod3", label: "Cablu de încărcare Mod 3 (Type 2 – Type 2, stații publice/wallbox)" },
  { key: "cabluIncarcareMod2", label: "Cablu de încărcare Mod 2 (priză casnică Schuko), dacă este livrat" },
];

const ACCESORII_ICE = [...ACCESORII_COMUNE];
const ACCESORII_ELECTRIC = [...ACCESORII_COMUNE, ...ACCESORII_ELECTRIC_SUPLIMENTAR];

// Returnează lista de accesorii potrivită tipului de motorizare al fișei.
function getAccesoriiList(tipMotorizare) {
  return tipMotorizare === TIP_MOTORIZARE.ELECTRIC ? ACCESORII_ELECTRIC : ACCESORII_ICE;
}

// "Alte accesorii" — listă derulantă separată de bifele de mai sus, editabilă
// aici de Florin, cu opțiunea implicită „Fără accesorii suplimentare”. Adaugă
// pur și simplu texte noi în array, fără să atingi restul codului.
const ALTE_ACCESORII_OPTIUNI = [
  "Fără accesorii suplimentare",
  // "Sistem de navigație suplimentar",
  // "Cameră marșarier suplimentară",
];

const PDI_GROUPS_ICE = [
  {
    id: "fluide",
    title: "A. Fluide și niveluri",
    items: [
      { key: "uleiMotor", label: "Nivel ulei motor conform" },
      { key: "lichidRacire", label: "Nivel lichid răcire conform" },
      { key: "lichidFrana", label: "Nivel lichid frână / ambreiaj conform" },
      { key: "servodirectie", label: "Nivel lichid servodirecție conform" },
      { key: "adblue", label: "Nivel AdBlue conform (dacă echipat SCR)" },
      { key: "lichidParbriz", label: "Nivel lichid parbriz conform" },
    ],
  },
  {
    id: "franare",
    title: "B. Frânare, direcție și suspensie",
    items: [
      { key: "franaService", label: "Funcționare frână de serviciu (pedală, cursă)" },
      { key: "franaMana", label: "Frână de mână / parcare funcțională" },
      { key: "jocVolan", label: "Joc volan / direcție în limite normale" },
      { key: "suspensie", label: "Verificare vizuală suspensie (zgomote, scurgeri amortizoare)" },
      { key: "prezoaneInitial", label: "Strângere inițială prezoane roți verificată (cuplu)" },
    ],
  },
  {
    id: "anvelope",
    title: "C. Anvelope și roți",
    items: [
      { key: "presiuneAnvelope", label: "Presiune anvelope (toate 4 + rezervă) verificată" },
      { key: "stareAnvelope", label: "Stare benzi rulare (uzură, tăieturi, corpuri străine)" },
      { key: "jante", label: "Jante fără deformări sau fisuri vizibile" },
    ],
  },
  {
    id: "electric",
    title: "D. Sistem electric și iluminat",
    items: [
      { key: "faruri", label: "Funcționare faruri, semnalizare, stopuri, marșarier" },
      { key: "claxon", label: "Funcționare claxon" },
      { key: "stergatoare", label: "Funcționare ștergătoare / spălătoare parbriz" },
      { key: "geamuriElectrice", label: "Funcționare geamuri electrice" },
      { key: "incuietori", label: "Funcționare încuietori centralizate / telecomandă" },
      { key: "baterie", label: "Baterie – tensiune și borne verificate" },
      { key: "martoriBord", label: "Martori bord – aprindere la contact, stingere după pornire" },
      { key: "multimedia", label: "Funcționare sistem multimedia / infotainment (ecran, radio, conectivitate)" },
      { key: "ac", label: "Funcționare aer condiționat / climatizare" },
    ],
  },
  {
    id: "caroserie",
    title: "E. Caroserie, cabină și bena",
    items: [
      { key: "curatenieExterior", label: "Curățenie exterior caroserie" },
      { key: "curatenieInterior", label: "Curățenie interior habitaclu" },
      { key: "etanseitate", label: "Etanșeitate uși / geamuri (fără infiltrații)" },
      { key: "hayonBena", label: "Funcționare și blocare hayon bena" },
      { key: "centuri", label: "Centuri de siguranță funcționale" },
      { key: "zgarieturi", label: "Verificare zgârieturi / lovituri vizibile pe caroserie" },
    ],
  },
  {
    id: "finala",
    title: "F. Verificare finală",
    items: [
      { key: "scurgeri", label: "Verificare scurgeri (ulei, combustibil, lichide) sub vehicul" },
      { key: "testDrive", label: "Test drive efectuat" },
      { key: "prezoaneFinal", label: "Re-verificare strângere prezoane după test drive" },
      { key: "kmService", label: "Kilometraj / interval primul service verificat" },
    ],
  },
];

// Vehicul electric (EV) — fără motor termic: nu se mai verifică ulei motor,
// AdBlue sau lichid servodirecție (majoritatea sunt electrice, fără fluid).
// În loc, apare un grup dedicat bateriei/sistemului de propulsie electrică
// (nivel încărcare la predare, BMS, izolație cabluri IT, trapă încărcare,
// test de încărcare, frânare regenerativă), plus bateria auxiliară 12V,
// distinctă de bateria de tracțiune, în grupul de sistem electric auxiliar.
const PDI_GROUPS_ELECTRIC = [
  {
    id: "propulsieElectrica",
    title: "A. Baterie și sistem de propulsie electrică",
    items: [
      { key: "nivelBateriePredare", label: "Nivel de încărcare baterie la predare conform (recomandat 50–80%)" },
      { key: "bmsFaraErori", label: "Sistem de management baterie (BMS) fără avertismente/erori pe bord" },
      { key: "izolatieCabluriIT", label: "Cabluri de înaltă tensiune (portocalii) intacte, fără deteriorări vizibile" },
      { key: "trapaIncarcare", label: "Trapă/mufă de încărcare — deschidere, închidere și blocare funcțională" },
      { key: "testIncarcare", label: "Test de încărcare efectuat (priză/stație) — funcțional" },
      { key: "franareRegenerativa", label: "Frânare regenerativă funcțională" },
      { key: "zgomoteMotorElectric", label: "Verificare zgomote motor electric / reductor (fără zgomote anormale)" },
      { key: "lichidRacireBaterie", label: "Nivel lichid răcire baterie/motor electric conform" },
    ],
  },
  {
    id: "franare",
    title: "B. Frânare, direcție și suspensie",
    items: [
      { key: "franaService", label: "Funcționare frână de serviciu (pedală, cursă)" },
      { key: "franaMana", label: "Frână de mână / parcare funcțională" },
      { key: "jocVolan", label: "Joc volan / direcție (servodirecție electrică) în limite normale" },
      { key: "lichidFrana", label: "Nivel lichid frână conform" },
      { key: "suspensie", label: "Verificare vizuală suspensie (zgomote, scurgeri amortizoare)" },
      { key: "prezoaneInitial", label: "Strângere inițială prezoane roți verificată (cuplu)" },
    ],
  },
  {
    id: "anvelope",
    title: "C. Anvelope și roți",
    items: [
      { key: "presiuneAnvelope", label: "Presiune anvelope (toate 4, + rezervă dacă echipat) verificată" },
      { key: "stareAnvelope", label: "Stare benzi rulare (uzură, tăieturi, corpuri străine)" },
      { key: "jante", label: "Jante fără deformări sau fisuri vizibile" },
    ],
  },
  {
    id: "electric",
    title: "D. Sistem electric auxiliar și iluminat",
    items: [
      { key: "faruri", label: "Funcționare faruri, semnalizare, stopuri, marșarier" },
      { key: "claxon", label: "Funcționare claxon" },
      { key: "stergatoare", label: "Funcționare ștergătoare / spălătoare parbriz" },
      { key: "geamuriElectrice", label: "Funcționare geamuri electrice" },
      { key: "incuietori", label: "Funcționare încuietori centralizate / telecomandă" },
      { key: "baterie12v", label: "Baterie 12V auxiliară – tensiune și borne verificate" },
      { key: "martoriBord", label: "Martori bord – aprindere la contact, stingere după pornire" },
      { key: "multimedia", label: "Funcționare sistem multimedia / infotainment (ecran, radio, conectivitate)" },
      { key: "ac", label: "Funcționare aer condiționat / climatizare" },
    ],
  },
  {
    id: "caroserie",
    title: "E. Caroserie, cabină și bena",
    items: [
      { key: "curatenieExterior", label: "Curățenie exterior caroserie" },
      { key: "curatenieInterior", label: "Curățenie interior habitaclu" },
      { key: "etanseitate", label: "Etanșeitate uși / geamuri (fără infiltrații)" },
      { key: "hayonBena", label: "Funcționare și blocare hayon bena (dacă este cazul)" },
      { key: "centuri", label: "Centuri de siguranță funcționale" },
      { key: "zgarieturi", label: "Verificare zgârieturi / lovituri vizibile pe caroserie" },
    ],
  },
  {
    id: "finala",
    title: "F. Verificare finală",
    items: [
      { key: "scurgeri", label: "Verificare scurgeri (lichid răcire, alte lichide) sub vehicul" },
      { key: "testDrive", label: "Test drive efectuat" },
      { key: "prezoaneFinal", label: "Re-verificare strângere prezoane după test drive" },
      { key: "autonomieAfisata", label: "Autonomie estimată afișată la bord verificată/consemnată" },
    ],
  },
];

// Returnează lista de grupuri PDI potrivită tipului de motorizare al fișei.
function getPdiGroups(tipMotorizare) {
  return tipMotorizare === TIP_MOTORIZARE.ELECTRIC ? PDI_GROUPS_ELECTRIC : PDI_GROUPS_ICE;
}

const FUEL_STEPS = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "Plin"];

// Nivel de încărcare baterie la livrare (%) — echivalentul FUEL_STEPS pentru
// vehiculele electrice. Se stochează procentul direct (nu un index).
const BATERIE_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// ---------- Liste de personal ----------
// Aceste nume apar ca listă derulantă la secțiunea 6 (Confirmare predare-primire).
// Persoana care PREDĂ vehiculul din partea ICG — se alege din agenții de vânzări.
// Tehnicianul care face INSPECȚIA PDI — se alege din personalul de service.
//
// Cu backend-ul (Apps Script) configurat, aceste liste NU se mai editează
// aici — se preiau automat, la pornirea aplicației, din tab-urile "Vanzatori"
// și "PersonalService" ale Sheet-ului (vezi refreshListePersonal în
// app-sync.js), pe care Florin le completează direct în Drive, fără cod.
// Array-urile de mai jos rămân doar ca fallback: valabile offline, înainte de
// primul răspuns de la server, sau dacă backend-ul nu e configurat deloc.
// Exemplu: let VANZATORI = ["Popescu Andrei", "Ionescu Maria"];

let VANZATORI = [
  // "Popescu Andrei",
  // "Ionescu Maria",
];

let PERSONAL_SERVICE = [
  // "Georgescu Mihai",
  // "Stan Radu",
];

// ---------- Mărci și modele (listă derulantă la secțiunea 1 — Date vehicul) ----------
// Operatorul alege marca, apoi modelul dintr-o listă filtrată pentru acea
// marcă (nu se mai scrie de mână). Editează aici lista, fără să atingi restul
// codului. Dacă adaugi o marcă nouă în MARCI, adaugă și o listă de modele
// pentru ea în MODELE_PE_MARCA (altfel lista de modele apare goală).
//
// Fiecare model are și un "tip" (TIP_MOTORIZARE.ICE, .ELECTRIC sau .AMBELE)
// — la alegerea modelului, aplicația pre-completează automat butonul "Tip
// motorizare" din secțiunea 1 (operatorul îl poate schimba manual oricând,
// de ex. dacă apare un model nou neclasificat încă aici). Pentru un model
// care există în AMBELE variante sub același nume (ex. dacă la un moment
// dat "Tunland G7" ar veni și electric, tot ca "Tunland G7"), pune
// tip: TIP_MOTORIZARE.AMBELE — atunci aplicația NU mai presupune automat
// un tip, operatorul alege manual din butonul "Tip motorizare":
//   { nume: "Tunland G7", tip: TIP_MOTORIZARE.AMBELE },

const MARCI = ["FOTON", "CAVAN"];

// Unele modele au variante fixe de caroserie (ex. eToano: L2H2 / L2H3) — la
// alegerea unui asemenea model, câmpul "Versiune / motorizare" devine listă
// derulantă cu variantele de mai jos, în loc de text liber. Dacă modelul nu
// are "variante", câmpul rămâne text liber (introdus manual).
const MODELE_PE_MARCA = {
  "FOTON": [
    { nume: "Tunland G7", tip: TIP_MOTORIZARE.ICE },
    { nume: "Tunland V9", tip: TIP_MOTORIZARE.ICE },
    { nume: "eAumark", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "eToano", tip: TIP_MOTORIZARE.ELECTRIC, variante: ["L2H2", "L2H3"] },
    { nume: "eMillerAuman", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "eAuman", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "Galaxus", tip: TIP_MOTORIZARE.ICE },
  ],
  "CAVAN": [
    { nume: "C1", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "C1 Plus", tip: TIP_MOTORIZARE.ELECTRIC },
    { nume: "C1 Max", tip: TIP_MOTORIZARE.ELECTRIC },
  ],
};

// Lista de modele (obiecte {nume, tip, variante?}) pentru o marcă dată.
function modelsForMarca(marca) {
  return MODELE_PE_MARCA[marca] || [];
}

// Variantele de caroserie ale unui model (ex. ["L2H2","L2H3"]), sau [] dacă
// modelul nu are variante definite (caz în care "Versiune" rămâne text liber).
function modelVariante(marca, modelNume) {
  const info = getModelInfo(marca, modelNume);
  return (info && info.variante) || [];
}

// Găsește tipul de motorizare (ice/electric/ambele) al unui model ales, după
// nume — folosit ca să pre-completăm automat butonul "Tip motorizare" la
// alegerea mărcii/modelului. Returnează null dacă modelul nu e găsit (model
// scris manual într-o fișă veche, dinainte de listele derulante).
function getModelInfo(marca, modelNume) {
  const modele = modelsForMarca(marca);
  return modele.find(m => m.nume === modelNume) || null;
}

// Tipul de motorizare cu care pre-completăm automat butonul, pornind de la
// modelul ales — sau null dacă modelul există în AMBELE variante (atunci
// lăsăm neatinsă alegerea curentă a operatorului, care decide manual din
// butonul "Tip motorizare").
function autoTipForModel(modelInfo) {
  if (!modelInfo || modelInfo.tip === TIP_MOTORIZARE.AMBELE) return null;
  return modelInfo.tip;
}

// ---------- Poze vehicul (secțiune finală, înainte de finalizare) ----------
// Setul de poze obligatoriu pentru fiecare livrare, făcute direct din
// aplicație (camera telefonului) și urcate în Drive, în folderul dedicat
// acelei serii de șasiu. Editează aici lista dacă vrei alte unghiuri/poze.

const FOTO_TIPURI = [
  { key: "fata45Stanga", label: "Față, 45° stânga" },
  { key: "fata45Dreapta", label: "Față, 45° dreapta" },
  { key: "spate45Stanga", label: "Spate, 45° stânga" },
  { key: "spate45Dreapta", label: "Spate, 45° dreapta" },
  { key: "interiorFata", label: "Interior față" },
  { key: "interiorSpate", label: "Interior spate" },
  { key: "bord", label: "Bord (instrumentar și kilometraj)" },
  { key: "motor", label: "Compartiment motor" },
  { key: "serieSasiu", label: "Serie șasiu (VIN)" },
];

// ---------- Model gol pentru o fișă nouă ----------

function emptyRecord() {
  return {
    id: uid(),            // identificator unic local — esențial ca fișele să nu se suprascrie una pe alta în arhivă
    docNumber: "",         // se atribuie automat, imediat, la deschiderea fișei (vezi assignDocNumberAsync)
    status: "draft",       // draft | finalizat
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Cine a deschis fișa (setat o singură dată, la creare, în startNewFisa
    // din app-form.js) — util ca oricine vede fișa în „Fișe în așteptare”
    // sau în arhivă să știe cine a pornit-o, chiar dacă între timp a trecut
    // prin mai multe mâini (vânzător -> service -> finalizare).
    creatDe: "",
    creatRol: "",

    dataLivrarii: "",
    oraLivrarii: "",        // ora programată livrării (HH:MM) — folosită pentru alerta de 2h din "Fișe în așteptare"
    locatieLivrare: "sediu", // sediu | extern

    vehicul: {
      marca: MARCI[0] || "",
      model: (modelsForMarca(MARCI[0])[0] || {}).nume || "",
      tipMotorizare: autoTipForModel(modelsForMarca(MARCI[0])[0]) || TIP_MOTORIZARE.ICE,
      versiune: "",
      culoare: "",
      vin: "",
      serieMotor: "",
      anFabricatie: "",
      kmBord: "",
      nrInmatriculare: "",
      tapiterie: "",
      nivelCombustibil: null, // 1..8 (index în FUEL_STEPS) — doar la vehicule ICE
      nivelBaterie: null,     // procent (10..100, vezi BATERIE_STEPS) — doar la vehicule electrice
    },

    client: {
      nume: "",
      cnpCui: "",
      adresa: "",
      telefon: "",
      email: "",
    },

    documente: {
      checks: {},        // key -> bool (vezi lista DOCUMENTE) — de completat de birou
      observatii: "",
    },

    // Verificare de etapă, la nivel de SECȚIUNE (nu pe fiecare bifă în parte):
    // vânzătorul confirmă partea lui (datele + documentele) după ce a
    // completat secțiunea 3, iar tehnicianul din service confirmă partea lui
    // (accesoriile + inspecția PDI) după ce termină secțiunile 4-5. Fișa se
    // poate finaliza abia când AMBELE sunt "pass" (excepție: adminul poate
    // forța închiderea). "motiv" e obligatoriu la respingere; dacă cineva
    // rezolvă ulterior problema și trece înapoi pe "pass", motivul inițial
    // rămâne vizibil (istoric), iar rezolvatDe/rezolvatData arată cine și
    // când a rezolvat.
    verificareVanzari: {
      status: null,      // null (neconfirmat) | "pass" | "fail"
      motiv: "",
      de: "",             // numele contului logat care a bifat
      rol: "",
      data: "",           // ISO
      rezolvatDe: "",
      rezolvatData: "",
    },
    verificareService: {
      status: null,      // null (neconfirmat) | "pass" | "interventie"
      motiv: "",
      de: "",
      rol: "",
      data: "",
      rezolvatDe: "",
      rezolvatData: "",
    },

    accesorii: {
      checks: {},        // key -> bool (vezi lista ACCESORII_ICE/ACCESORII_ELECTRIC)
      alteAccesorii: ALTE_ACCESORII_OPTIUNI[0] || "", // listă derulantă separată (vezi ALTE_ACCESORII_OPTIUNI)
      nrChei: "",
      nrCartele: "",
      observatii: "",
    },

    pdi: {
      checks: {},        // key -> bool (peste toate grupurile)
      tehnician: "",
      dataInspectiei: "",
      kmTestare: "",
    },

    observatiiGenerale: "",

    poze: {},            // key (din FOTO_TIPURI) -> dataURL jpeg (comprimat pe dispozitiv) | absent = nefăcută
    pozeUploaded: {},    // key -> true, imediat ce poza a ajuns cu succes în Drive (vezi uploadPhotoInBackground)

    semnaturi: {
      icgNume: "",
      icgSemnatura: null,   // dataURL
      pdiNume: "",
      pdiSemnatura: null,
      clientNume: "",
      clientSemnatura: null,
    },
  };
}

function uid() {
  return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Numele complet afișabil al vehiculului ("FOTON Tunland G7"), din marca +
// modelul alese separat — folosit în PDF, arhivă și oriunde apărea vechiul
// câmp unic "marcaModel".
function vehicleDisplayName(v) {
  return [v && v.marca, v && v.model].filter(Boolean).join(" ").trim();
}

// Completează câmpurile care ar putea lipsi la o fișă salvată cu o versiune
// mai veche a aplicației (ex. înainte de secțiunea de poze, sau înainte de
// separarea marcă/model) — evită erori la deschiderea unei fișe vechi.
function normalizeRecord(rec) {
  if (!rec) return rec;
  rec.vehicul = rec.vehicul || {};
  if (!rec.vehicul.marca && !rec.vehicul.model && rec.vehicul.marcaModel) {
    rec.vehicul.marca = MARCI[0] || "";
    rec.vehicul.model = rec.vehicul.marcaModel;
  }
  rec.vehicul.marca = rec.vehicul.marca || "";
  rec.vehicul.model = rec.vehicul.model || "";
  // fișele salvate înainte de funcția termic/electric erau toate vehicule ICE
  rec.vehicul.tipMotorizare = rec.vehicul.tipMotorizare || TIP_MOTORIZARE.ICE;
  if (rec.vehicul.nivelBaterie === undefined) rec.vehicul.nivelBaterie = null;
  rec.documente = rec.documente || { checks: {}, observatii: "" };
  rec.accesorii = rec.accesorii || { checks: {}, nrChei: "", nrCartele: "", observatii: "" };
  if (!rec.accesorii.alteAccesorii) rec.accesorii.alteAccesorii = ALTE_ACCESORII_OPTIUNI[0] || "";
  rec.poze = rec.poze || {};
  rec.pozeUploaded = rec.pozeUploaded || {};
  rec.verificareVanzari = rec.verificareVanzari || { status: null, motiv: "", de: "", rol: "", data: "", rezolvatDe: "", rezolvatData: "" };
  rec.verificareService = rec.verificareService || { status: null, motiv: "", de: "", rol: "", data: "", rezolvatDe: "", rezolvatData: "" };
  rec.creatDe = rec.creatDe || "";
  rec.creatRol = rec.creatRol || "";
  rec.oraLivrarii = rec.oraLivrarii || "";
  return rec;
}

// ---------- Verificare de etapă (vânzător / service) ----------

function verifStatusLabel(kind, status) {
  if (kind === "vanzari") {
    if (status === "pass") return "OK — confirmat";
    if (status === "fail") return "Respins";
    return "Neconfirmat";
  }
  if (status === "pass") return "OK — confirmat";
  if (status === "interventie") return "Necesită intervenție service";
  return "Neconfirmat";
}

// O fișă poate fi finalizată doar dacă AMBELE verificări sunt "pass", cu
// excepția adminului, care poate forța închiderea (ex: o problemă minoră
// rezolvată verbal, fără să mai treacă cineva să bifeze din nou).
function canFinalizeRecord(r, currentRol) {
  if (currentRol === "admin") return true;
  const okVanzari = r.verificareVanzari && r.verificareVanzari.status === "pass";
  const okService = r.verificareService && r.verificareService.status === "pass";
  return !!(okVanzari && okService);
}

// Motivele pentru care o fișă NU poate fi încă finalizată (folosit și în
// bannerul din formular, și în lista "Fișe în așteptare").
function pendingReasons(r) {
  const reasons = [];
  const vz = r.verificareVanzari || {};
  const sv = r.verificareService || {};
  if (vz.status !== "pass") {
    reasons.push({ rol: "vanzari", eticheta: "Verificare vânzător", status: vz.status, motiv: vz.motiv, de: vz.de });
  }
  if (sv.status !== "pass") {
    reasons.push({ rol: "service", eticheta: "Verificare service", status: sv.status, motiv: sv.motiv, de: sv.de });
  }
  return reasons;
}
