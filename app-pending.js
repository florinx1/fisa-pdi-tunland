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

// Info despre urgența livrării unei fișe încă nefinalizate, pe baza
// dataLivrarii + oraLivrarii (vezi câmpurile din secțiunea de sus a
// formularului). "urgent" = suntem în fereastra de 2h înainte de ora
// programată; "overdue" = a trecut ora programată și fișa tot nu e gata.
function pendingUrgencyInfo(r) {
  if (!r.dataLivrarii || !r.oraLivrarii) return { level: "none" };
  const target = new Date(`${r.dataLivrarii}T${r.oraLivrarii}:00`);
  if (isNaN(target.getTime())) return { level: "none" };
  const alertAt = target.getTime() - 2 * 60 * 60 * 1000;
  const now = Date.now();
  if (now < alertAt) return { level: "ok" };
  if (now < target.getTime()) return { level: "urgent" };
  return { level: "overdue" };
}

const URGENCY_RANK = { overdue: 0, urgent: 1, ok: 2, none: 3 };

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
  // fișele urgente/întârziate primele, ca administratorul să le vadă imediat
  const sorted = open.slice().sort((a, b) => {
    return URGENCY_RANK[pendingUrgencyInfo(a).level] - URGENCY_RANK[pendingUrgencyInfo(b).level];
  });
  const urgentCount = sorted.filter(r => {
    const lvl = pendingUrgencyInfo(r).level;
    return lvl === "urgent" || lvl === "overdue";
  }).length;
  const banner = urgentCount > 0
    ? `<div class="pending-alert-banner">⚠ ${urgentCount} ${urgentCount === 1 ? "fișă are" : "fișe au"} livrarea programată în mai puțin de 2 ore și nu ${urgentCount === 1 ? "e" : "sunt"} încă finalizate.</div>`
    : "";
  return banner + sorted.map(r => pendingCardHtml(r)).join("");
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
  const urgency = pendingUrgencyInfo(r);
  const urgencyClass = urgency.level === "overdue" ? "pending-overdue" : (urgency.level === "urgent" ? "pending-urgent" : "");
  const targetIso = (r.dataLivrarii && r.oraLivrarii) ? `${r.dataLivrarii}T${r.oraLivrarii}:00` : "";
  const countdownHtml = (urgency.level === "urgent" || urgency.level === "overdue")
    ? `<div class="pending-countdown" data-delivery-target="${esc(targetIso)}">⏱ calculăm...</div>`
    : "";
  const deleteBtn = isAdmin()
    ? `<button class="btn btn-danger" data-delete-pending="${esc(r.docNumber)}" type="button" style="margin-top:8px; margin-left:8px; width:auto; padding:6px 10px; font-size:12px;">Șterge (admin)</button>`
    : "";
  return `
    <div class="pending-card ${isRed ? "pending-red" : ""} ${urgencyClass}">
      <div class="pending-doc">${esc(r.docNumber)}</div>
      <div class="pending-meta">${esc(r.model) || "model necompletat"}${r.clientNume ? " &nbsp;•&nbsp; " + esc(r.clientNume) : ""}${r.creatDe ? " &nbsp;•&nbsp; deschisă de " + esc(r.creatDe) : ""}</div>
      ${reasons.map(h => `<div class="pending-reason">${h}</div>`).join("")}
      ${countdownHtml}
      <button class="btn btn-secondary" data-open-pending="${esc(r.docNumber)}" type="button" style="margin-top:8px; width:auto; padding:6px 10px; font-size:12px;">Deschide fișa</button>
      ${deleteBtn}
    </div>
  `;
}

function afterPendingRender() {
  document.getElementById("btn-refresh-pending").addEventListener("click", loadPendingRecords);
  wirePendingCardButtons();
  startPendingCountdownTicker();
  if (state.pendingRecords === null && backendConfigured()) loadPendingRecords();
}

// ---------------- Cronometru live (numără în jos până la livrare) ----------------

let __pendingCountdownInterval = null;

function startPendingCountdownTicker() {
  if (__pendingCountdownInterval) clearInterval(__pendingCountdownInterval);
  updatePendingCountdowns();
  __pendingCountdownInterval = setInterval(() => {
    if (state.tab !== "pending") {
      clearInterval(__pendingCountdownInterval);
      __pendingCountdownInterval = null;
      return;
    }
    updatePendingCountdowns();
  }, 1000);
}

function updatePendingCountdowns() {
  document.querySelectorAll("[data-delivery-target]").forEach(el => {
    const iso = el.dataset.deliveryTarget;
    if (!iso) return;
    const targetMs = new Date(iso).getTime();
    if (isNaN(targetMs)) return;
    const diffMs = targetMs - Date.now();
    const pad = n => String(n).padStart(2, "0");
    const totalSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const clock = `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
    if (diffMs >= 0) {
      el.textContent = `⏱ Urgent — livrare programată peste ${clock}`;
      el.classList.remove("overdue");
    } else {
      el.textContent = `⏱ ÎNTÂRZIATĂ — ora programată de livrare a trecut cu ${clock}`;
      el.classList.add("overdue");
    }
  });
}

function wirePendingCardButtons() {
  document.querySelectorAll("[data-open-pending]").forEach(btn => {
    btn.addEventListener("click", () => attemptPullByNumber(btn.dataset.openPending));
  });
  document.querySelectorAll("[data-delete-pending]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const docNumber = btn.dataset.deletePending;
      if (!confirm(`Ștergi DEFINITIV fișa ${docNumber} (draftul de pe server și folderul din Drive, dacă există)? Nu se poate anula.`)) return;
      showToast("Se șterge...", 1200);
      const result = await apiDeleteRecord(state.session.nume, state.session.pin, docNumber);
      if (result && result.ok) {
        showToast(`Fișa ${docNumber} a fost ștearsă.`);
        loadPendingRecords();
      } else {
        showToast("Nu s-a putut șterge: " + ((result && result.error) || "eroare necunoscută"), 4000);
      }
    });
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
