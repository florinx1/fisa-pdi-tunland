/* ============================================================
   Autentificare & administrare conturi
   Inter Cargo Grup (ICG)
   ------------------------------------------------------------
   Fiecare persoană se loghează cu numele ei și un cod PIN (setat de
   administrator la crearea contului). Contul e verificat pe server
   (Sheet-ul "Utilizatori"), astfel încât un cont dezactivat sau șters
   de administrator (ex: angajat plecat din companie) își pierde
   accesul imediat — chiar dacă telefonul lui are sesiunea salvată.

   Roluri:
   - admin     — acces la ecranul "Utilizatori" (adaugă/dezactivează/șterge conturi)
   - vanzari   — restul aplicației, ca oricine
   - service   — restul aplicației, ca oricine
   Rolul nu limitează ce completează cineva în fișă (oricine poate
   selecta orice nume din listele VANZATORI / PERSONAL_SERVICE la
   secțiunea de semnături) — controlează doar accesul la administrare.
   ============================================================ */

const AUTH_STORAGE_KEY = "icg_fise_pdi_auth_v1";

function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) { /* best-effort */ }
}

function clearSession() {
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) { /* best-effort */ }
}

function isAdmin() {
  return !!(state.session && state.session.rol === "admin");
}

// ---------------- Ecranul de logare ----------------

function renderLoginScreen() {
  document.getElementById("app").innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <img src="${CONFIG.LOGO_URL}" onerror="this.style.display='none'" alt="logo" class="login-logo">
        <div class="login-sub">Fișă PDI — autentificare</div>

        <div class="field">
          <label>Nume</label>
          <input type="text" id="login-nume" autocapitalize="words" placeholder="ex: Popescu Andrei">
        </div>
        <div class="field">
          <label>Cod PIN</label>
          <input type="password" id="login-pin" inputmode="numeric" placeholder="••••" maxlength="12">
        </div>
        <div class="login-error" id="login-error" style="display:none;"></div>
        <button class="btn btn-primary" id="login-btn" type="button">Intră în aplicație</button>
        <div class="note" style="text-align:center; margin-top:14px;">
          Cont nou sau cod uitat? Cere unui administrator să ți-l creeze/reseteze.
        </div>
      </div>
    </div>
  `;

  const doLogin = async () => {
    const nume = document.getElementById("login-nume").value.trim();
    const pin = document.getElementById("login-pin").value.trim();
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    if (!nume || !pin) {
      errEl.textContent = "Completează numele și codul PIN.";
      errEl.style.display = "block";
      return;
    }
    const btn = document.getElementById("login-btn");
    btn.textContent = "Se verifică...";
    btn.disabled = true;
    const result = await apiLogin(nume, pin);
    btn.textContent = "Intră în aplicație";
    btn.disabled = false;
    if (result && result.ok) {
      // PIN-ul rămâne în sesiune doar ca să autorizăm acțiunile de admin pe
      // server la fiecare apel (server-ul re-verifică nume+PIN+rol de fiecare
      // dată — nu se bazează pe ce afirmă telefonul); nivel de securitate
      // potrivit unui instrument intern, nu pentru date sensibile.
      state.session = { nume: result.nume || nume, rol: result.rol || "vanzari", pin };
      saveSession(state.session);
      bootstrapAfterLogin();
    } else {
      errEl.textContent = (result && result.error) || "Autentificare eșuată.";
      errEl.style.display = "block";
    }
  };

  document.getElementById("login-btn").addEventListener("click", doLogin);
  document.getElementById("login-pin").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
}

function logout() {
  if (!confirm("Ieși din aplicație?")) return;
  clearSession();
  state.session = null;
  __appBootstrapped = false;
  renderLoginScreen();
}

// ---------------- Ecranul de administrare utilizatori ----------------

function renderUsersAdmin() {
  return `
    <div class="admin-add-box">
      <div class="group-title" style="margin-top:0;">Adaugă utilizator nou</div>
      <div class="grid3">
        <div class="field"><label>Nume</label><input type="text" id="adm-new-nume"></div>
        <div class="field">
          <label>Rol</label>
          <select id="adm-new-rol">
            <option value="vanzari">Vânzări</option>
            <option value="service">Service</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div class="field"><label>Cod PIN (min. 4 cifre)</label><input type="text" inputmode="numeric" id="adm-new-pin"></div>
      </div>
      <button class="btn btn-secondary" id="adm-add-btn" type="button">+ Adaugă utilizator</button>
    </div>

    <div id="adm-users-list" class="admin-users-list">
      <div class="note">Se încarcă lista de utilizatori...</div>
    </div>
  `;
}

async function afterUsersAdminRender() {
  document.getElementById("adm-add-btn").addEventListener("click", async () => {
    const nume = document.getElementById("adm-new-nume").value.trim();
    const rol = document.getElementById("adm-new-rol").value;
    const pin = document.getElementById("adm-new-pin").value.trim();
    if (!nume || !pin) { showToast("Completează numele și codul PIN."); return; }
    const res = await apiAddUser(state.session.nume, state.session.pin, nume, rol, pin);
    if (res && res.ok) {
      showToast(`Utilizator „${nume}" adăugat`);
      document.getElementById("adm-new-nume").value = "";
      document.getElementById("adm-new-pin").value = "";
      loadAndRenderUsersList();
    } else {
      showToast((res && res.error) || "Eroare la adăugare");
    }
  });
  loadAndRenderUsersList();
}

async function loadAndRenderUsersList() {
  const box = document.getElementById("adm-users-list");
  const res = await apiListUsers(state.session.nume, state.session.pin);
  if (!res || !res.ok) {
    box.innerHTML = `<div class="note">Nu s-a putut încărca lista: ${esc((res && res.error) || "eroare necunoscută")}</div>`;
    return;
  }
  if (res.users.length === 0) {
    box.innerHTML = `<div class="empty-state">Niciun utilizator.</div>`;
    return;
  }
  box.innerHTML = res.users.map(u => `
    <div class="user-card ${u.activ ? "" : "inactive"}" data-nume="${esc(u.nume)}">
      <div class="user-main">
        <div class="user-name">${esc(u.nume)}</div>
        <div class="user-role">${roleLabel(u.rol)} ${u.activ ? "" : "· dezactivat"}</div>
      </div>
      <div class="user-actions">
        <button type="button" data-toggle="${esc(u.nume)}" data-activ="${u.activ ? "0" : "1"}">
          ${u.activ ? "Dezactivează" : "Reactivează"}
        </button>
        <button type="button" class="danger" data-delete="${esc(u.nume)}">Șterge</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nume = btn.dataset.toggle;
      const activ = btn.dataset.activ === "1";
      const res2 = await apiSetUserActive(state.session.nume, state.session.pin, nume, activ);
      if (res2 && res2.ok) { showToast(activ ? "Cont reactivat" : "Cont dezactivat"); loadAndRenderUsersList(); }
      else showToast((res2 && res2.error) || "Eroare");
    });
  });
  box.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nume = btn.dataset.delete;
      if (!confirm(`Ștergi definitiv contul „${nume}"? Persoana nu va mai putea accesa aplicația.`)) return;
      const res2 = await apiDeleteUser(state.session.nume, state.session.pin, nume);
      if (res2 && res2.ok) { showToast("Cont șters"); loadAndRenderUsersList(); }
      else showToast((res2 && res2.error) || "Eroare");
    });
  });
}

function roleLabel(rol) {
  if (rol === "admin") return "Administrator";
  if (rol === "service") return "Service";
  return "Vânzări";
}
