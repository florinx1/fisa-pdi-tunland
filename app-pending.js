/* ============================================================
   Fișe în așteptare — tablou cu draft-urile trimise ("Drafts" pe server)
   care nu au încă ambele verificări (vânzător + service) pe "Pass",
   vizibil oricui deschide aplicația, indiferent cine a completat fișa.
   Inter Cargo Grup (ICG)
   ============================================================ */

function renderPendingTab() {
  return `
    <div class="note" style="margin:0 0 10px;">
      Listă centralizată (de pe server) a fișelor trimise mai departe și încă nefinalizate — cu cine are
      o verificare restantă și motivul. O fișă dispare automat de aici imediat ce e finalizată.
    </div>
    <div class="field">
      <button class="btn btn-secondary" id="btn-refresh-pending" type="button" style="width:auto;">Reîmprospătează</button>
    </div>
    <div id="pending-list">${renderPendingList()}</div>
  `;
}

function renderPendingList() {
  if (!backendConfigured()) {
    return `<div class="empty-state">Backend-ul (Apps Script) nu e configurat încă — vezi README.md, secțiunea 3.</div>`;
  }
  if (state.pendingLoading) return `<div class="note">Se încarcă...</div>`;
  if (state.pendingRecords === null) return `<div class="note">Apasă „Reîmprospătează” ca să vezi fișele aflate încă în lucru.</div>`;
  const open = state.pendingRecords.filter(r =>
    (r.verificareVanzari && r.verificareVanzari.status !== "pass") ||
    (r.verificareService && r.verificareService.status !== "pass")
  );
  if (open.length === 0) {
    return `<div class="empty-state">Nicio fișă în așteptare — toate draft-urile trimise au ambele verificări confirmate (Pass).</div>`;
  }
  return open.map(r => pendingCardHtml(r)).join("");
}

function pendingCardHtml(r) {
  const vz = r.verificareVanzari || {};
  const sv = r.verificareService || {};
  const reasons = [];
  if (vz.status !== "pass") {
    reasons.push(`Vânzător: <b>${esc(verifStatusLabel("vanzari", vz.status))}</b>${vz.de ? " — " + esc(vz.de) : ""}${vz.motiv ? " (" + esc(vz.motiv) + ")" : ""}`);
  }
  if (sv.status !== "pass") {
    reasons.push(`Service: <b>${esc(verifStatusLabel("service", sv.status))}</b>${sv.de ? " — " + esc(sv.de) : ""}${sv.motiv ? " (" + esc(sv.motiv) + ")" : ""}`);
  }
  const isRed = vz.status === "fail" || sv.status === "interventie";
  return `
    <div class="pending-card ${isRed ? "pending-red" : ""}">
      <div class="pending-doc">${esc(r.docNumber)}</div>
      <div class="pending-meta">${esc(r.model) || "model necompletat"}${r.clientNume ? " &nbsp;•&nbsp; " + esc(r.clientNume) : ""}</div>
      ${reasons.map(h => `<div class="pending-reason">${h}</div>`).join("")}
      <button class="btn btn-secondary" data-open-pending="${esc(r.docNumber)}" type="button" style="margin-top:8px; width:auto; padding:6px 10px; font-size:12px;">Deschide fișa</button>
    </div>
  `;
}

function afterPendingRender() {
  document.getElementById("btn-refresh-pending").addEventListener("click", loadPendingRecords);
  wirePendingCardButtons();
  if (state.pendingRecords === null && backendConfigured()) loadPendingRecords();
}

function wirePendingCardButtons() {
  document.querySelectorAll("[data-open-pending]").forEach(btn => {
    btn.addEventListener("click", () => attemptPullByNumber(btn.dataset.openPending));
  });
}

async function loadPendingRecords() {
  state.pendingLoading = true;
  const listEl = document.getElementById("pending-list");
  if (listEl) listEl.innerHTML = renderPendingList();
  const records = await fetchOpenRecords();
  state.pendingLoading = false;
  state.pendingRecords = records || [];
  const listEl2 = document.getElementById("pending-list");
  if (listEl2) listEl2.innerHTML = renderPendingList();
  wirePendingCardButtons();
}
