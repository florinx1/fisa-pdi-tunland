/* ============================================================
   Fisa PDI Tunland G7 — app logic
   Inter Cargo Grup (ICG)
   ============================================================ */

const STORAGE_KEY = "icg_fise_pdi_v1";
const NUMBERING_KEY = "icg_fise_pdi_next_local"; // fallback local counter dacă nu există backend încă

let state = {
  tab: "form",          // form | archive | pending | users
  current: null,        // recordul deschis în formular
  records: [],          // toate fișele cunoscute local (draft + sincronizate)
  archiveQuery: "",
  centralQuery: "",      // căutare în arhiva centrală (Drive/Sheet) — toate fișele finalizate
  centralResults: null,  // null = nicio căutare încă; [] = căutat, fără rezultate
  centralSearching: false,
  pendingRecords: null,  // null = neîncărcat încă; [] = încărcat, fără fișe în așteptare — vezi app-pending.js
  pendingLoading: false,
  session: null,        // { nume, rol, pin } — vezi app-auth.js
};

// ---------------- Storage local ----------------

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map(normalizeRecord);
  } catch (e) {
    console.error("Eroare citire storage", e);
    return [];
  }
}

function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  } catch (e) {
    console.error("Eroare salvare storage", e);
    showToast("Eroare la salvarea locală (spațiu insuficient?)");
  }
}

function upsertCurrentIntoRecords() {
  if (!state.current) return;
  state.current.updatedAt = new Date().toISOString();
  const idx = state.records.findIndex(r => r.id === state.current.id);
  if (idx >= 0) state.records[idx] = state.current;
  else state.records.unshift(state.current);
  saveRecords();
}

function nextLocalNumber() {
  let n = parseInt(localStorage.getItem(NUMBERING_KEY) || "0", 10) + 1;
  localStorage.setItem(NUMBERING_KEY, String(n));
  return n;
}

function formatDocNumber(n) {
  return CONFIG.DOC_PREFIX + String(n).padStart(4, "0");
}

// ---------------- Bootstrap ----------------

let __appInitialized = false;
let __appBootstrapped = false;

function init() {
  if (__appInitialized) return; // gardă: nu re-inițializăm niciodată aplicația de două ori
  __appInitialized = true;

  // Fără backend configurat, aplicația funcționează ca înainte, fără logare
  // (un draft nu are cui să-i verifice contul). Cu backend configurat, orice
  // persoană trebuie să se autentifice — sesiunea salvată local e reverificată
  // pe server la fiecare pornire, ca un cont dezactivat între timp să nu mai
  // funcționeze doar pentru că telefonul ține minte vechea logare.
  if (!backendConfigured()) {
    bootstrapAfterLogin();
    return;
  }

  const saved = loadSession();
  if (saved && saved.nume && saved.pin) {
    apiLogin(saved.nume, saved.pin).then(result => {
      if (result && result.ok) {
        state.session = { nume: result.nume || saved.nume, rol: result.rol || saved.rol, pin: saved.pin };
        saveSession(state.session);
        bootstrapAfterLogin();
      } else {
        clearSession();
        renderLoginScreen();
      }
    }).catch(() => renderLoginScreen());
  } else {
    renderLoginScreen();
  }
}

function bootstrapAfterLogin() {
  if (__appBootstrapped) { renderShell(); render(); return; }
  __appBootstrapped = true;
  state.records = loadRecords();
  renderShell();
  startNewOrResumeDraft();
  render();
  updateOnlineIndicator();
  window.addEventListener("online", updateOnlineIndicator);
  window.addEventListener("offline", updateOnlineIndicator);
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  // încearcă sincronizarea fișelor nesincronizate, dacă avem URL configurat și suntem online
  trySyncPending();
}

function startNewOrResumeDraft() {
  // dacă există un draft neterminat foarte recent și fără client completat, îl redeschidem;
  // altfel pornim o fișă nouă și îi atribuim imediat un număr de înregistrare
  const openDraft = state.records.find(r => r.status === "draft" && r._openInForm);
  if (openDraft) {
    state.current = openDraft;
  } else {
    state.current = emptyRecord();
    assignDocNumberAsync(state.current);
  }
}

// Atribuie un număr de înregistrare (de la backend dacă e configurat/online,
// altfel contorul local) în fundal, fără să blocheze afișarea formularului;
// când numărul soseste, reîmprospătăm antetul dacă fișa e încă cea activă.
async function assignDocNumberAsync(record) {
  if (record.docNumber) return;
  const num = await requestDocNumber();
  record.docNumber = num;
  if (state.current === record) {
    upsertCurrentIntoRecords();
    if (state.tab === "form") render();
  }
}

// ---------------- Shell / navigare ----------------

function renderShell() {
  const showUsersTab = isAdmin();
  const sessionBadge = state.session
    ? `<button class="session-badge" id="btn-logout" type="button" title="Apasă pentru a ieși din cont">
         ${esc(state.session.nume)} ${state.session.rol === "admin" ? "· admin" : ""} ⎋
       </button>`
    : "";

  document.getElementById("app").innerHTML = `
    <header class="app-header">
      <div class="brand">
        <img src="${CONFIG.LOGO_URL}" onerror="this.style.display='none'" alt="logo">
        <div class="brand-text">
          <div class="sub">${CONFIG.COMPANY_SUB}</div>
        </div>
      </div>
      ${sessionBadge}
      <div class="title" id="header-title">Fișă de predare-primire vehicul</div>
      <div class="doc-number-display" id="header-doc-number"></div>
    </header>
    <nav class="tabbar">
      <button data-tab="form" id="tab-form">Fișă curentă</button>
      <button data-tab="archive" id="tab-archive">Arhivă</button>
      <button data-tab="pending" id="tab-pending">Fișe în așteptare</button>
      ${showUsersTab ? `<button data-tab="users" id="tab-users">Utilizatori</button>` : ""}
    </nav>
    <main id="main"></main>
    <div class="toast" id="toast"></div>
  `;
  document.getElementById("tab-form").addEventListener("click", () => { state.tab = "form"; render(); });
  document.getElementById("tab-archive").addEventListener("click", () => { state.tab = "archive"; render(); });
  document.getElementById("tab-pending").addEventListener("click", () => { state.tab = "pending"; render(); });
  if (showUsersTab) {
    document.getElementById("tab-users").addEventListener("click", () => { state.tab = "users"; render(); });
  }
  if (state.session) {
    document.getElementById("btn-logout").addEventListener("click", logout);
  }
}

function render() {
  document.getElementById("tab-form").classList.toggle("active", state.tab === "form");
  document.getElementById("tab-archive").classList.toggle("active", state.tab === "archive");
  document.getElementById("tab-pending").classList.toggle("active", state.tab === "pending");
  const usersTabEl = document.getElementById("tab-users");
  if (usersTabEl) usersTabEl.classList.toggle("active", state.tab === "users");

  const main = document.getElementById("main");
  if (state.tab === "form") {
    main.innerHTML = renderForm();
    afterFormRender();
    document.getElementById("header-title").textContent = "Fișă de predare-primire vehicul";
    document.getElementById("header-doc-number").textContent = state.current.docNumber
      ? state.current.docNumber
      : "(număr atribuit la finalizare)";
  } else if (state.tab === "archive") {
    main.innerHTML = renderArchive();
    afterArchiveRender();
    document.getElementById("header-title").textContent = "Arhivă fișe";
    document.getElementById("header-doc-number").textContent = `${state.records.length} fișe salvate`;
  } else if (state.tab === "pending") {
    main.innerHTML = renderPendingTab();
    afterPendingRender();
    document.getElementById("header-title").textContent = "Fișe în așteptare";
    document.getElementById("header-doc-number").textContent = "";
  } else if (state.tab === "users") {
    if (!isAdmin()) { state.tab = "form"; render(); return; }
    main.innerHTML = renderUsersAdmin();
    afterUsersAdminRender();
    document.getElementById("header-title").textContent = "Administrare utilizatori";
    document.getElementById("header-doc-number").textContent = "";
  }
}

function showToast(msg, ms = 2200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), ms);
}

function updateOnlineIndicator() {
  // folosit în arhivă / bara de sus dacă vrem un indicator; păstrat simplu momentan
  document.body.dataset.online = navigator.onLine ? "1" : "0";
}

window.addEventListener("DOMContentLoaded", init);
