/* ============================================================
   Randare formular (secțiunile 1-6) + legare câmpuri
   ============================================================ */

// Ecranul de pornire — afișat pe tab-ul "Fișă curentă" atunci când
// utilizatorul nu are nicio fișă deschisă (după logare, sau imediat după ce
// a trimis/finalizat una): îl lasă să aleagă explicit între a începe o fișă
// nouă sau a prelua una trimisă de un coleg, în loc să intre automat
// într-un formular gol/străin.
function renderStartScreen() {
  return `
    <div class="start-screen">
      <div class="start-title">Ce dorești să faci?</div>
      <div class="start-buttons">
        <button class="start-btn" id="btn-start-new" type="button">
          <span class="start-btn-icon">＋</span>
          <span class="start-btn-label">Fișă nouă</span>
          <span class="start-btn-sub">Deschide o fișă de predare-primire nouă, cu număr de înregistrare nou</span>
        </button>
        <button class="start-btn" id="btn-start-pull" type="button">
          <span class="start-btn-icon">↺</span>
          <span class="start-btn-label">Preia fișă</span>
          <span class="start-btn-sub">Continuă o fișă trimisă de un coleg (din „Fișe în așteptare”)</span>
        </button>
      </div>
    </div>
  `;
}

function wireStartScreen() {
  document.getElementById("btn-start-new").addEventListener("click", startNewFisa);
  document.getElementById("btn-start-pull").addEventListener("click", () => {
    state.tab = "pending";
    render();
  });
}

// Pornește o fișă complet nouă (număr de înregistrare atribuit în fundal) și
// o deschide direct în formular. Folosită atât din ecranul de start, cât și
// din butonul "Începe o fișă nouă" aflat jos în formular.
function startNewFisa() {
  state.current = emptyRecord();
  state.current.creatDe = (state.session && state.session.nume) || "";
  state.current.creatRol = (state.session && state.session.rol) || "";
  render();
  assignDocNumberAsync(state.current);
}

function renderForm() {
  const r = state.current;
  if (!r) return renderStartScreen();
  const v = r.vehicul, c = r.client, d = r.documente, a = r.accesorii, p = r.pdi, s = r.semnaturi;

  return `
    <div class="field">
      <label>Notă</label>
      <div class="note">Fișa se completează pas cu pas; se salvează automat pe acest dispozitiv.
      La final apeși „Finalizează și generează PDF”.</div>
      ${r.creatDe ? `<div class="note" style="margin-top:4px;">Fișă deschisă de <b>${esc(r.creatDe)}</b>${r.creatRol ? ` (${esc(r.creatRol)})` : ""}.</div>` : ""}
    </div>

    ${shareBannerHtml(r)}

    <div class="grid3">
      <div class="field">
        <label>Data livrării</label>
        <input type="date" id="f-dataLivrarii" value="${r.dataLivrarii || ""}">
      </div>
      <div class="field" style="grid-column: span 2;">
        <label>Locația livrării</label>
        <div class="radio-pills">
          <label><input type="radio" name="locatie" value="sediu" ${r.locatieLivrare === "sediu" ? "checked" : ""}><span>Sediu ICG Bragadiru</span></label>
          <label><input type="radio" name="locatie" value="extern" ${r.locatieLivrare === "extern" ? "checked" : ""}><span>Livrare externă</span></label>
        </div>
      </div>
    </div>

    <div class="section-bar">1&nbsp;&nbsp;Date vehicul</div>
    <div class="section-body">
      <div class="field">
        <label>Tip motorizare</label>
        <div class="radio-pills">
          <label><input type="radio" name="tipMotorizare" value="${TIP_MOTORIZARE.ICE}" ${v.tipMotorizare !== TIP_MOTORIZARE.ELECTRIC ? "checked" : ""}><span>Termic (ICE)</span></label>
          <label><input type="radio" name="tipMotorizare" value="${TIP_MOTORIZARE.ELECTRIC}" ${v.tipMotorizare === TIP_MOTORIZARE.ELECTRIC ? "checked" : ""}><span>Electric</span></label>
        </div>
        <div class="note" style="margin:6px 0 0;">
          Se completează automat după modelul ales, dar poate fi schimbat manual — determină ce apare
          la „Inventar accesorii” și „Inspecție tehnică PDI” mai jos.
        </div>
      </div>
      <div class="grid3">
        <div class="field">
          <label>Marcă</label>
          <select id="f-marca">
            ${MARCI.map(m => `<option value="${esc(m)}" ${m === v.marca ? "selected" : ""}>${esc(m)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Model</label>
          <select id="f-model">
            ${modelsForMarca(v.marca).map(m => `<option value="${esc(m.nume)}" ${m.nume === v.model ? "selected" : ""}>${esc(m.nume)}${m.tip === TIP_MOTORIZARE.AMBELE ? " (termic sau electric)" : ""}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Culoare caroserie</label><input type="text" id="f-culoare" value="${esc(v.culoare)}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label>Versiune / motorizare</label>${
          modelVariante(v.marca, v.model).length
            ? `<select id="f-versiune">${modelVariante(v.marca, v.model).map(vr => `<option value="${esc(vr)}" ${vr === v.versiune ? "selected" : ""}>${esc(vr)}</option>`).join("")}</select>`
            : `<input type="text" id="f-versiune" value="${esc(v.versiune)}">`
        }</div>
        <div class="field"><label>Serie șasiu (VIN)</label><input type="text" id="f-vin" value="${esc(v.vin)}" autocapitalize="characters"></div>
        <div class="field"><label>Serie motor</label><input type="text" id="f-serieMotor" value="${esc(v.serieMotor)}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label>An fabricație</label><input type="text" inputmode="numeric" id="f-anFabricatie" value="${esc(v.anFabricatie)}"></div>
        <div class="field"><label>KM bord la livrare</label><input type="text" inputmode="numeric" id="f-kmBord" value="${esc(v.kmBord)}"></div>
        <div class="field"><label>Nr. înmatriculare</label><input type="text" id="f-nrInmatriculare" value="${esc(v.nrInmatriculare)}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label>Interior / tapițerie</label><input type="text" id="f-tapiterie" value="${esc(v.tapiterie)}"></div>
      </div>
      ${v.tipMotorizare === TIP_MOTORIZARE.ELECTRIC ? `
      <div class="field">
        <label>Nivel de încărcare baterie la livrare</label>
        <div class="fuel-row">
          ${BATERIE_STEPS.map(pct => `
            <label><input type="radio" name="baterie" value="${pct}" ${v.nivelBaterie === pct ? "checked" : ""}><span>${pct}%</span></label>
          `).join("")}
        </div>
      </div>
      ` : `
      <div class="field">
        <label>Nivel combustibil la livrare (pas 1/8)</label>
        <div class="fuel-row">
          ${FUEL_STEPS.map((lbl, i) => `
            <label><input type="radio" name="fuel" value="${i+1}" ${v.nivelCombustibil === i+1 ? "checked" : ""}><span>${lbl}</span></label>
          `).join("")}
        </div>
      </div>
      `}
    </div>

    <div class="section-bar">2&nbsp;&nbsp;Date client (beneficiar final)</div>
    <div class="section-body">
      <div class="grid2">
        <div class="field"><label>Nume complet / denumire</label><input type="text" id="f-clientNume" value="${esc(c.nume)}"></div>
        <div class="field"><label>CNP / CUI</label><input type="text" inputmode="numeric" id="f-clientCnp" value="${esc(c.cnpCui)}"></div>
      </div>
      <div class="field"><label>Adresă</label><input type="text" id="f-clientAdresa" value="${esc(c.adresa)}"></div>
      <div class="grid2">
        <div class="field"><label>Telefon</label><input type="tel" id="f-clientTelefon" value="${esc(c.telefon)}"></div>
        <div class="field"><label>Email</label><input type="email" id="f-clientEmail" value="${esc(c.email)}"></div>
      </div>
    </div>

    <div class="section-bar">3&nbsp;&nbsp;Documente ${progressPill(documenteProgress(r))}</div>
    <div class="section-body">
      <div class="note" style="margin:0 0 10px;">Se pregătesc de obicei de o persoană de la birou.</div>
      ${DOCUMENTE.map(it => checkItemHtml("doc", it, d.checks[it.key])).join("")}
      <div class="field" style="margin-top:10px;">
        <label>Observații documente</label>
        <textarea id="f-obsDocumente">${esc(d.observatii)}</textarea>
      </div>
      <div class="note" style="margin-top:10px;">
        Predarea efectivă a mașinii către client se face de obicei chiar acum, de către
        vânzător — de aceea semnăturile ICG și client sunt aici, nu la finalul fișei
        (care e salvată de altcineva, din service, mai târziu).
      </div>
      ${sigBlockHtml("icg", "Predat de (ICG)", s.icgNume, s.icgSemnatura, VANZATORI)}
      ${sigBlockHtml("client", "Primit de (client)", s.clientNume, s.clientSemnatura, null)}
      ${verificareBlockHtml("vanzari", r.verificareVanzari)}
    </div>

    <div class="section-bar">4&nbsp;&nbsp;Inventar accesorii ${progressPill(accesoriiProgress(r))}</div>
    <div class="section-body">
      ${getAccesoriiList(v.tipMotorizare).map(it => checkItemHtml("acc", it, a.checks[it.key])).join("")}
      <div class="field" style="margin-top:10px;">
        <label>Alte accesorii</label>
        <select id="f-alteAccesorii">
          ${ALTE_ACCESORII_OPTIUNI.map(opt => `<option value="${esc(opt)}" ${opt === a.alteAccesorii ? "selected" : ""}>${esc(opt)}</option>`).join("")}
        </select>
      </div>
      <div class="grid2" style="margin-top:10px;">
        <div class="field"><label>Număr chei predate</label><input type="text" inputmode="numeric" id="f-nrChei" value="${esc(a.nrChei)}"></div>
        <div class="field"><label>Cartele / telecomenzi</label><input type="text" inputmode="numeric" id="f-nrCartele" value="${esc(a.nrCartele)}"></div>
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Observații inventar</label>
        <textarea id="f-obsInventar">${esc(a.observatii)}</textarea>
      </div>
    </div>

    <div class="section-bar">5&nbsp;&nbsp;Inspecție tehnică PDI ${progressPill(pdiProgress(r))}</div>
    <div class="section-body">
      <div class="note" style="margin:0 0 10px;">Se completează de personalul din service, la mașină.</div>
      ${getPdiGroups(v.tipMotorizare).map(g => `
        <div class="group-title">${g.title}</div>
        ${g.items.map(it => checkItemHtml("pdi", it, p.checks[it.key])).join("")}
      `).join("")}
      <div class="grid3" style="margin-top:12px;">
        <div class="field"><label>Tehnician PDI</label><input type="text" id="f-pdiTehnician" value="${esc(p.tehnician)}"></div>
        <div class="field"><label>Data inspecției</label><input type="date" id="f-pdiData" value="${p.dataInspectiei || ""}"></div>
        <div class="field"><label>KM la testare</label><input type="text" inputmode="numeric" id="f-pdiKm" value="${esc(p.kmTestare)}"></div>
      </div>
      ${sigBlockHtml("pdi", "Inspecție PDI (semnătură tehnician)", s.pdiNume, s.pdiSemnatura, PERSONAL_SERVICE)}
      <div class="note" style="margin-top:10px;">Verificarea de mai jos acoperă atât Inventarul accesorii (secțiunea 4), cât și Inspecția PDI (această secțiune).</div>
      ${verificareBlockHtml("service", r.verificareService)}
    </div>

    <div class="section-bar">6&nbsp;&nbsp;Observații generale</div>
    <div class="section-body">
      <div class="field">
        <textarea id="f-obsGenerale" style="min-height:90px;">${esc(r.observatiiGenerale)}</textarea>
      </div>
    </div>

    <div class="section-bar">7&nbsp;&nbsp;Poze vehicul ${progressPill(pozeProgress(r))}</div>
    <div class="section-body">
      <div class="note" style="margin:0 0 10px;">
        Apasă pe fiecare tip de poză — se deschide direct camera telefonului.
        Pozele se urcă în Drive odată cu fișa, la finalizare.
      </div>
      <div class="foto-grid">
        ${FOTO_TIPURI.map(ft => fotoSlotHtml(ft, r.poze[ft.key])).join("")}
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" id="btn-new">+ Fișă nouă</button>
      <button class="btn btn-secondary" id="btn-pdf-preview">Previzualizează PDF</button>
    </div>

    <div style="height: 70px;"></div>

    ${verifSummaryBannerHtml(r)}
    <div class="bottom-bar">
      <button class="btn btn-secondary" id="btn-save-draft">Salvează draft</button>
      <button class="btn btn-primary" id="btn-finalize">Finalizează și generează PDF</button>
    </div>
  `;
}

// ---------------- Verificare de etapă (vânzător / service) ----------------

function verificareBlockHtml(kind, obj) {
  const isVanzari = kind === "vanzari";
  const failValue = isVanzari ? "fail" : "interventie";
  const failLabel = isVanzari ? "Fail (document/dată lipsă sau greșită)" : "Necesită intervenție service";
  const title = isVanzari ? "Verificare predare — vânzător" : "Verificare service — accesorii & PDI";
  const status = obj.status;
  const rejected = status === failValue;
  return `
    <div class="verif-block ${rejected ? "verif-rejected" : status === "pass" ? "verif-ok" : ""}" data-verif="${kind}">
      <div class="verif-title">${title}</div>
      <div class="radio-pills">
        <button type="button" class="btn ${status === "pass" ? "btn-primary" : "btn-secondary"}" data-verif-btn="${kind}" data-verif-value="pass">Pass</button>
        <button type="button" class="btn ${rejected ? "btn-danger" : "btn-secondary"}" data-verif-btn="${kind}" data-verif-value="${failValue}">${failLabel}</button>
      </div>
      <div class="field" style="margin-top:8px; ${rejected ? "" : "display:none;"}" data-verif-motiv-wrap="${kind}">
        <label>Motiv (obligatoriu)</label>
        <textarea id="f-verif-${kind}-motiv" placeholder="Ex: lipsește CoC-ul / roata de rezervă lipsă / zgârietură bară față">${esc(obj.motiv)}</textarea>
      </div>
      <div class="note" style="margin-top:4px;">
        ${obj.de ? `Confirmat de <b>${esc(obj.de)}</b>${obj.rol ? ` (${esc(obj.rol)})` : ""}${obj.data ? ", la " + new Date(obj.data).toLocaleString("ro-RO") : ""}.` : "Neconfirmat încă."}
        ${obj.rezolvatDe ? `<br>Rezolvat de <b>${esc(obj.rezolvatDe)}</b>${obj.rezolvatData ? ", la " + new Date(obj.rezolvatData).toLocaleString("ro-RO") : ""}.` : ""}
      </div>
    </div>
  `;
}

function verifSummaryBannerHtml(r) {
  const reasons = pendingReasons(r);
  if (reasons.length === 0) {
    return `<div class="verif-summary verif-summary-ok">✓ Ambele verificări sunt confirmate (Pass) — fișa poate fi finalizată.</div>`;
  }
  return `<div class="verif-summary verif-summary-pending">
    ⚠ Fișă în așteptare — ${reasons.map(x => `${x.eticheta}${x.de ? " (" + esc(x.de) + ")" : ""}: <b>${esc(verifStatusLabel(x.rol, x.status))}</b>`).join(" &nbsp;·&nbsp; ")}
  </div>`;
}

function shareBannerHtml(r) {
  if (!r.docNumber && !r._shared) {
    return `
      <div class="share-banner">
        <div class="share-text">Va completa fișa și altcineva (birou ↔ atelier)?</div>
        <button class="btn btn-secondary" id="btn-share" type="button">Trimite fișa mai departe</button>
      </div>
    `;
  }
  return `
    <div class="share-banner shared">
      <div class="share-text">
        Fișă partajată — spune-i celeilalte persoane numărul:
        <span class="share-number" id="share-number-text">${r.docNumber}</span>
      </div>
      <div class="share-actions">
        <button class="btn btn-ghost" id="btn-copy-number" type="button">Copiază numărul</button>
        <button class="btn btn-secondary" id="btn-share" type="button">Retrimite acum</button>
        <button class="btn btn-ghost" id="btn-pull-latest" type="button">Preia ultima versiune</button>
      </div>
    </div>
  `;
}

function checkItemHtml(prefix, item, checked) {
  return `
    <label class="check-item ${checked ? "checked" : ""}" data-group="${prefix}" data-key="${item.key}">
      <input type="checkbox" ${checked ? "checked" : ""}>
      <span>${item.label}</span>
    </label>
  `;
}

function sigBlockHtml(id, title, nume, dataUrl, nameOptions) {
  const nameField = nameOptions
    ? `<select id="f-sig-${id}-nume">
         <option value="">— selectează —</option>
         ${nameOptions.map(n => `<option value="${esc(n)}" ${n === nume ? "selected" : ""}>${esc(n)}</option>`).join("")}
       </select>`
    : `<input type="text" id="f-sig-${id}-nume" value="${esc(nume)}">`;
  return `
    <div class="sig-block">
      <div class="sig-title">${title}</div>
      <div class="field"><label>Nume</label>${nameField}</div>
      <canvas class="sig-pad" id="sig-${id}" data-existing="${dataUrl ? "1" : "0"}"></canvas>
      <div class="sig-actions">
        <button type="button" data-clear-sig="${id}">Șterge semnătura</button>
        <span class="note" style="margin:0;">${dataUrl ? "semnat" : "nesemnat"}</span>
      </div>
    </div>
  `;
}

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function documenteProgress(r) {
  const total = DOCUMENTE.length;
  const done = DOCUMENTE.filter(i => r.documente.checks[i.key]).length;
  return { done, total };
}

function accesoriiProgress(r) {
  const list = getAccesoriiList(r.vehicul.tipMotorizare);
  const total = list.length;
  const done = list.filter(i => r.accesorii.checks[i.key]).length;
  return { done, total };
}

function pdiProgress(r) {
  let total = 0, done = 0;
  getPdiGroups(r.vehicul.tipMotorizare).forEach(g => g.items.forEach(it => {
    total++;
    if (r.pdi.checks[it.key]) done++;
  }));
  return { done, total };
}

function progressPill({ done, total }) {
  const complete = total > 0 && done === total;
  return `<span class="progress-pill ${complete ? "complete" : ""}">${done}/${total}</span>`;
}

// Redesenează tot formularul (necesar când se schimbă tipul de motorizare —
// listele de accesorii/PDI și selectorul combustibil/baterie sunt diferite),
// dar păstrează poziția de scroll, ca operatorul să nu fie "aruncat" sus.
function rerenderFormPreservingScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

function pozeProgress(r) {
  const total = FOTO_TIPURI.length;
  const done = FOTO_TIPURI.filter(ft => !!(r.poze && r.poze[ft.key])).length;
  return { done, total };
}

// O poză poate fi: nefăcută (absentă), făcută pe acest dispozitiv (dataURL,
// arătăm imaginea), sau deja urcată în Drive (valoare `true` — am golit
// dataURL-ul greu din localStorage după sincronizare, vezi syncRecord).
function fotoSlotHtml(ft, value) {
  const hasImage = typeof value === "string" && value;
  const uploaded = value === true;
  const thumb = hasImage
    ? `<img src="${value}" alt="">`
    : uploaded
      ? `<span class="foto-placeholder foto-uploaded">☁️✓</span>`
      : `<span class="foto-placeholder">📷</span>`;
  const btnLabel = hasImage || uploaded ? "Refă poza" : "Fotografiază";
  return `
    <div class="foto-slot ${hasImage || uploaded ? "done" : ""}" data-foto="${ft.key}">
      <div class="foto-thumb">${thumb}</div>
      <div class="foto-label">${esc(ft.label)}</div>
      <label class="btn btn-secondary foto-btn">
        ${btnLabel}
        <input type="file" accept="image/*" capture="environment" data-foto-input="${ft.key}" style="display:none">
      </label>
    </div>
  `;
}

// ---------------- Legare evenimente după randare ----------------

function afterFormRender() {
  const r = state.current;
  if (!r) { wireStartScreen(); return; }
  const bind = (id, path, transform) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => {
      setPath(r, path, transform ? transform(el.value) : el.value);
      autosave();
    };
    // "input" pentru câmpuri text (răspuns imediat la tastare); "change"
    // acoperă și <select> (unde "input" nu e mereu declanșat) — inofensiv
    // dublat pe câmpurile text, autosave-ul e oricum debounced.
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  };

  bind("f-dataLivrarii", "dataLivrarii");

  // Butonul "Tip motorizare" schimbă ce apare la secțiunile 4 (accesorii) și
  // 5 (PDI), plus selectorul nivel combustibil/baterie din secțiunea 1 — de
  // aceea redesenăm tot formularul, păstrând poziția de scroll.
  document.querySelectorAll('input[name="tipMotorizare"]').forEach(el => {
    el.addEventListener("change", () => {
      if (!el.checked) return;
      r.vehicul.tipMotorizare = el.value;
      autosave();
      rerenderFormPreservingScroll();
    });
  });

  // "Marcă" schimbă lista de opțiuni din "Model" (modelele diferă per marcă);
  // "Model" pre-completează automat tipul de motorizare (operatorul îl poate
  // schimba manual după, din butonul de mai sus) — ambele redesenează tot
  // formularul, ca accesoriile/PDI-ul să reflecte imediat noul tip.
  const marcaEl = document.getElementById("f-marca");
  const modelEl = document.getElementById("f-model");
  if (marcaEl && modelEl) {
    marcaEl.addEventListener("change", () => {
      r.vehicul.marca = marcaEl.value;
      const modele = modelsForMarca(marcaEl.value);
      const first = modele[0];
      r.vehicul.model = first ? first.nume : "";
      // dacă modelul există în ambele variante, nu suprascriem tipul —
      // operatorul alege manual din butonul "Tip motorizare"
      const autoTip = autoTipForModel(first);
      if (autoTip) r.vehicul.tipMotorizare = autoTip;
      // dacă modelul are variante fixe de caroserie (ex. eToano L2H2/L2H3),
      // pre-completăm cu prima variantă; altfel golim (rămâne text liber)
      const variante = modelVariante(r.vehicul.marca, r.vehicul.model);
      r.vehicul.versiune = variante.length ? variante[0] : "";
      autosave();
      rerenderFormPreservingScroll();
    });
    modelEl.addEventListener("change", () => {
      r.vehicul.model = modelEl.value;
      const info = getModelInfo(r.vehicul.marca, modelEl.value);
      const autoTip = autoTipForModel(info);
      if (autoTip) r.vehicul.tipMotorizare = autoTip;
      const variante = modelVariante(r.vehicul.marca, r.vehicul.model);
      r.vehicul.versiune = variante.length ? variante[0] : "";
      autosave();
      rerenderFormPreservingScroll();
    });
  }
  bind("f-versiune", "vehicul.versiune");
  bind("f-culoare", "vehicul.culoare");
  bind("f-vin", "vehicul.vin");
  bind("f-serieMotor", "vehicul.serieMotor");
  bind("f-anFabricatie", "vehicul.anFabricatie");
  bind("f-kmBord", "vehicul.kmBord");
  bind("f-nrInmatriculare", "vehicul.nrInmatriculare");
  bind("f-tapiterie", "vehicul.tapiterie");

  bind("f-clientNume", "client.nume");
  bind("f-clientCnp", "client.cnpCui");
  bind("f-clientAdresa", "client.adresa");
  bind("f-clientTelefon", "client.telefon");
  bind("f-clientEmail", "client.email");

  bind("f-obsDocumente", "documente.observatii");

  bind("f-alteAccesorii", "accesorii.alteAccesorii");
  bind("f-nrChei", "accesorii.nrChei");
  bind("f-nrCartele", "accesorii.nrCartele");
  bind("f-obsInventar", "accesorii.observatii");

  bind("f-pdiTehnician", "pdi.tehnician");
  bind("f-pdiData", "pdi.dataInspectiei");
  bind("f-pdiKm", "pdi.kmTestare");

  bind("f-obsGenerale", "observatiiGenerale");

  ["icg", "pdi", "client"].forEach(who => {
    bind(`f-sig-${who}-nume`, `semnaturi.${who}Nume`);
  });

  // locatie livrare
  document.querySelectorAll('input[name="locatie"]').forEach(el => {
    el.addEventListener("change", () => {
      if (el.checked) { r.locatieLivrare = el.value; autosave(); }
    });
  });

  // nivel combustibil (ICE) / nivel baterie (electric)
  document.querySelectorAll('input[name="fuel"]').forEach(el => {
    el.addEventListener("change", () => {
      if (el.checked) { r.vehicul.nivelCombustibil = parseInt(el.value, 10); autosave(); }
    });
  });
  document.querySelectorAll('input[name="baterie"]').forEach(el => {
    el.addEventListener("change", () => {
      if (el.checked) { r.vehicul.nivelBaterie = parseInt(el.value, 10); autosave(); }
    });
  });

  // checklist-uri (accesorii + pdi)
  document.querySelectorAll(".check-item").forEach(label => {
    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      const group = label.dataset.group;
      const key = label.dataset.key;
      if (group === "doc") r.documente.checks[key] = input.checked;
      if (group === "acc") r.accesorii.checks[key] = input.checked;
      if (group === "pdi") r.pdi.checks[key] = input.checked;
      label.classList.toggle("checked", input.checked);
      autosave();
      // reîmprospătăm doar pastilele de progres, fără să redesenăm tot formularul (păstrează scroll)
      refreshProgressPills();
    });
  });

  // semnături
  ["icg", "pdi", "client"].forEach(who => initSignaturePad(who, r));
  document.querySelectorAll("[data-clear-sig]").forEach(btn => {
    btn.addEventListener("click", () => {
      const who = btn.dataset.clearSig;
      clearSignaturePad(who, r);
    });
  });

  document.getElementById("btn-new").addEventListener("click", () => {
    if (confirm("Începi o fișă nouă? Fișa curentă rămâne salvată ca draft.")) {
      upsertCurrentIntoRecords();
      startNewFisa();
    }
  });

  const shareBtn = document.getElementById("btn-share");
  if (shareBtn) shareBtn.addEventListener("click", () => shareCurrentRecord());

  const copyBtn = document.getElementById("btn-copy-number");
  if (copyBtn) copyBtn.addEventListener("click", () => {
    const text = document.getElementById("share-number-text").textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast("Număr copiat: " + text));
    } else {
      showToast("Numărul fișei: " + text);
    }
  });

  const pullLatestBtn = document.getElementById("btn-pull-latest");
  if (pullLatestBtn) pullLatestBtn.addEventListener("click", async () => {
    if (!confirm("Preiei ultima versiune de pe server? Modificările nesalvate încă pe server, făcute doar aici, se vor pierde.")) return;
    const remote = await pullDraft(state.current.docNumber);
    if (remote) {
      remote._shared = true;
      remote._openInForm = true;
      state.current = remote;
      upsertCurrentIntoRecords();
      render();
      showToast("Preluat de pe server");
    }
  });

  document.getElementById("btn-save-draft").addEventListener("click", () => {
    upsertCurrentIntoRecords();
    showToast("Draft salvat pe acest dispozitiv");
  });

  document.getElementById("btn-pdf-preview").addEventListener("click", () => {
    generatePdf(state.current, { download: false, open: true });
  });

  document.getElementById("btn-finalize").addEventListener("click", async () => {
    finalizeCurrentRecord();
  });

  document.querySelectorAll("[data-verif-btn]").forEach(btn => {
    btn.addEventListener("click", () => handleVerifClick(btn.dataset.verifBtn, btn.dataset.verifValue));
  });

  wireFotoInputs(r);
}

// Vânzătorul confirmă Pass/Fail pe partea lui (documente + date deschidere)
// sau tehnicianul de service confirmă Pass/Necesită intervenție pe partea
// lui (accesorii + PDI). Motivul e obligatoriu la respingere. Indiferent de
// rezultat, verificarea vânzătorului DECLANȘEAZĂ automat trimiterea fișei
// către service (nu mai trebuie apăsat separat "Trimite fișa mai departe").
async function handleVerifClick(kind, value) {
  const r = state.current;
  const key = kind === "vanzari" ? "verificareVanzari" : "verificareService";
  const obj = r[key];
  const isReject = value !== "pass";
  const motivEl = document.getElementById(`f-verif-${kind}-motiv`);
  const motiv = motivEl ? motivEl.value.trim() : "";
  if (isReject && !motiv) {
    alert("Scrie mai întâi motivul, apoi apasă din nou butonul de respingere.");
    if (motivEl) { motivEl.closest("[data-verif-motiv-wrap]").style.display = ""; motivEl.focus(); }
    return;
  }
  const wasRejected = obj.status && obj.status !== "pass" && obj.status !== value;
  obj.status = value;
  obj.de = (state.session && state.session.nume) || obj.de || "";
  obj.rol = (state.session && state.session.rol) || obj.rol || "";
  obj.data = new Date().toISOString();
  if (isReject) {
    obj.motiv = motiv;
  } else if (wasRejected) {
    // rezolvare: trece pe Pass după un Fail/Necesită intervenție anterior —
    // păstrăm motivul inițial ca istoric și consemnăm cine/când a rezolvat
    obj.rezolvatDe = (state.session && state.session.nume) || "";
    obj.rezolvatData = new Date().toISOString();
  }
  // fișa iese acum din sarcina acestui utilizator (trece la service, sau
  // rămâne "în așteptare" pentru rezolvare/finalizare) — nu mai rămâne
  // marcată drept "deschisă în formular" pe acest dispozitiv
  r._openInForm = false;
  if (kind === "vanzari") {
    await sendToServiceAfterVanzariCheck(r);
  } else {
    await finishServiceCheck(r);
  }
  // revine la ecranul de pornire (Fișă nouă / Preia fișă), ca operatorul să
  // nu rămână "blocat" pe o fișă care nu mai e (momentan) în sarcina lui
  if (state.current === r) state.current = null;
  render();
}

async function sendToServiceAfterVanzariCheck(r) {
  if (!r.docNumber) r.docNumber = await requestDocNumber();
  r._shared = true;
  upsertCurrentIntoRecords();
  if (!backendConfigured()) {
    showToast("Verificare salvată local. Backend-ul nu e configurat încă — trimite fișa manual colegului din service.", 4500);
    return;
  }
  showToast("Se trimite fișa către service...", 1500);
  const result = await pushDraft(r);
  if (result.ok) {
    showToast(`Trimisă către service — nr. fișă: ${r.docNumber}`, 4000);
  } else {
    showToast("Nu s-a putut trimite automat (" + result.error + ") — colegul din service o poate prelua manual, cu numărul fișei, din \"Fișe în așteptare\".", 4500);
  }
}

// Verificarea tehnicianului de service (Pass / Necesită intervenție) —
// analog cu sendToServiceAfterVanzariCheck, dar fără destinatar următor:
// doar sincronizăm rezultatul, ca oricine să-l vadă în "Fișe în așteptare".
async function finishServiceCheck(r) {
  upsertCurrentIntoRecords();
  if (!backendConfigured() || !r._shared || !r.docNumber) return;
  showToast("Se salvează verificarea...", 1200);
  const result = await pushDraft(r);
  if (result.ok) {
    showToast(`Verificare salvată — fișă ${r.docNumber}`, 3000);
  } else {
    showToast("Nu s-a putut sincroniza (" + result.error + ") — verifică din \"Fișe în așteptare\".", 4000);
  }
}

// ---------------- Poze vehicul (cameră + compresie pe dispozitiv) ----------------

function wireFotoInputs(r) {
  document.querySelectorAll("[data-foto-input]").forEach(input => wireSingleFotoInput(input, r));
}

// Leagă un SINGUR input de poză. Când o poză e procesată, doar slotul ei e
// înlocuit în DOM (nu tot formularul) — dacă am re-lega toate input-urile
// din pagină la fiecare poză făcută, cele nemodificate ar primi câte un
// event listener nou de fiecare dată, dublând procesarea la poze ulterioare.
function wireSingleFotoInput(input, r) {
  input.addEventListener("change", async () => {
    const key = input.dataset.fotoInput;
    const file = input.files && input.files[0];
    if (!file) return;
    const slot = input.closest(".foto-slot");
    const label = input.closest("label");
    const originalLabel = label.firstChild.textContent;
    label.firstChild.textContent = "Se procesează...";
    try {
      const dataUrl = await compressPhoto(file, 1600, 0.72);
      r.poze[key] = dataUrl;
      autosave();
      const ft = FOTO_TIPURI.find(f => f.key === key);
      if (slot && ft) {
        slot.outerHTML = fotoSlotHtml(ft, dataUrl);
        const newSlot = document.querySelector(`.foto-slot[data-foto="${key}"]`);
        const newInput = newSlot && newSlot.querySelector("[data-foto-input]");
        if (newInput) wireSingleFotoInput(newInput, r);
      }
      refreshProgressPills();
    } catch (e) {
      console.error("Eroare procesare poză", e);
      showToast("Nu am putut procesa poza — încearcă din nou.");
      label.firstChild.textContent = originalLabel;
    }
  });
}

// Redimensionează + comprimă poza pe dispozitiv (JPEG) înainte de a o ține în
// memorie/localStorage — o poză directă de la cameră poate avea 4-12 MB, ceea
// ce ar umple rapid spațiul local disponibil pentru mai multe fișe.
function compressPhoto(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("citire fișier eșuată"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decodare imagine eșuată"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function refreshProgressPills() {
  const bars = document.querySelectorAll(".section-bar");
  bars.forEach(bar => {
    if (bar.textContent.includes("Documente")) {
      const pill = bar.querySelector(".progress-pill");
      const { done, total } = documenteProgress(state.current);
      pill.textContent = `${done}/${total}`;
      pill.classList.toggle("complete", done === total);
    }
    if (bar.textContent.includes("Inventar accesorii")) {
      const pill = bar.querySelector(".progress-pill");
      const { done, total } = accesoriiProgress(state.current);
      pill.textContent = `${done}/${total}`;
      pill.classList.toggle("complete", done === total);
    }
    if (bar.textContent.includes("Inspecție tehnică PDI")) {
      const pill = bar.querySelector(".progress-pill");
      const { done, total } = pdiProgress(state.current);
      pill.textContent = `${done}/${total}`;
      pill.classList.toggle("complete", done === total);
    }
    if (bar.textContent.includes("Poze vehicul")) {
      const pill = bar.querySelector(".progress-pill");
      const { done, total } = pozeProgress(state.current);
      pill.textContent = `${done}/${total}`;
      pill.classList.toggle("complete", done === total);
    }
  });
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
  node[parts[parts.length - 1]] = value;
}

let autosaveTimer = null;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    state.current._openInForm = true;
    upsertCurrentIntoRecords();
    if (state.current._shared && state.current.docNumber) {
      await pushDraft(state.current); // best-effort, silențios — nu blocăm utilizatorul
    }
  }, 600);
}

async function shareCurrentRecord() {
  const r = state.current;
  if (!backendConfigured()) {
    alert(
      "Trimiterea fișei către alt dispozitiv necesită backend-ul Apps Script configurat " +
      "(vezi README.md, secțiunea 3). Fără el, fișa rămâne doar pe acest dispozitiv."
    );
    return;
  }
  if (!navigator.onLine) {
    showToast("Ești offline — se va trimite automat când revine conexiunea.");
    r._shared = true;
    upsertCurrentIntoRecords();
    render();
    return;
  }
  if (!r.docNumber) {
    r.docNumber = await requestDocNumber();
  }
  r._shared = true;
  upsertCurrentIntoRecords();
  render();
  showToast("Se trimite...", 1200);
  const result = await pushDraft(r);
  if (result.ok) {
    showToast(`Trimisă — spune-i numărul: ${r.docNumber}`, 4000);
  } else {
    showToast("Nu s-a putut trimite: " + result.error);
  }
}

// Instantaneu al conținutului relevant al fișei (fără câmpuri volatile),
// folosit ca să detectăm dacă operatorul apasă "Finalizează" din nou fără să
// fi schimbat nimic — caz în care nu mai retrimitem PDF-ul/pozele la Drive.
function computeRecordSnapshot(r) {
  const clone = JSON.parse(JSON.stringify(r));
  delete clone.id;
  delete clone.updatedAt;
  delete clone._openInForm;
  delete clone._lastFinalizedSnapshot;
  return JSON.stringify(clone);
}

async function finalizeCurrentRecord() {
  const r = state.current;
  const rol = state.session && state.session.rol;
  const reasons = pendingReasons(r);
  if (reasons.length > 0 && rol !== "admin") {
    alert(
      "Fișa nu poate fi finalizată încă:\n" +
      reasons.map(x => `- ${x.eticheta}: ${verifStatusLabel(x.rol, x.status)}${x.motiv ? " — " + x.motiv : ""}${x.de ? " (" + x.de + ")" : ""}`).join("\n") +
      "\n\nDoar un cont admin poate forța închiderea unei fișe cu verificări nerezolvate."
    );
    return;
  }
  if (reasons.length > 0 && rol === "admin") {
    if (!confirm(
      "Există verificări nerezolvate:\n" +
      reasons.map(x => `- ${x.eticheta}: ${verifStatusLabel(x.rol, x.status)}${x.motiv ? " — " + x.motiv : ""}`).join("\n") +
      "\n\nÎnchizi fișa forțat, ca admin?"
    )) return;
    r._finalizatForteDeAdmin = true;
  }
  if (!r.client.nume) {
    if (!confirm("Numele clientului nu este completat. Continui oricum?")) return;
  }

  if (r.status === "finalizat" && r._lastFinalizedSnapshot === computeRecordSnapshot(r)) {
    showToast(`Fișa ${r.docNumber} este deja salvată — nu s-a schimbat nimic.`, 3000);
    return;
  }

  if (!r.docNumber) {
    r.docNumber = await requestDocNumber();
  }
  r.status = "finalizat";
  r._openInForm = false;
  r._lastFinalizedSnapshot = computeRecordSnapshot(r);
  upsertCurrentIntoRecords();
  generatePdf(r, { download: true, open: false });
  await syncRecord(r);
  showToast(`Fișă ${r.docNumber} finalizată`);
  state.current = null;
  render();
}
