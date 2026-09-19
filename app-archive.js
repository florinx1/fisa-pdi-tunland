/* ============================================================
   Arhivă — listă căutabilă a fișelor salvate local
   ============================================================ */

function renderArchive() {
  const q = state.archiveQuery.trim().toLowerCase();
  const filtered = state.records
    .filter(r => {
      if (!q) return true;
      const hay = [
        r.docNumber, r.client.nume, r.client.telefon, r.vehicul.vin,
        vehicleDisplayName(r.vehicul), r.dataLivrarii, r.vehicul.nrInmatriculare,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return `
    <div class="pull-box">
      <label>Preia fișă de pe alt dispozitiv (trimisă de altcineva)</label>
      <div class="pull-row">
        <input type="text" id="pull-doc-number" placeholder="ex: ICG-PDI-0007" autocapitalize="characters">
        <button class="btn btn-primary" id="btn-pull-draft" type="button">Preia</button>
      </div>
    </div>

    <div class="search-box">
      <input type="text" id="archive-search" placeholder="Caută în fișele de pe ACEST dispozitiv..." value="${esc(state.archiveQuery)}">
    </div>
    ${filtered.length === 0 ? `<div class="empty-state">Nicio fișă găsită pe acest dispozitiv.</div>` : ""}
    ${filtered.map(r => recordCardHtml(r)).join("")}

    <div class="section-bar" style="margin-top:22px;">Arhiva centrală (toate fișele finalizate, din Drive)</div>
    <div class="section-body">
      <div class="pull-row">
        <input type="text" id="central-search" placeholder="VIN, client, nr. document sau nr. auto..." value="${esc(state.centralQuery || "")}">
        <button class="btn btn-primary" id="btn-central-search" type="button">Caută</button>
      </div>
      <div id="central-results" class="admin-users-list" style="margin-top:12px;">
        ${renderCentralResults()}
      </div>
    </div>
  `;
}

function renderCentralResults() {
  if (state.centralSearching) return `<div class="note">Se caută...</div>`;
  if (state.centralResults === null) return `<div class="note">Caută o fișă mai veche, indiferent pe ce dispozitiv a fost făcută.</div>`;
  if (state.centralResults.length === 0) return `<div class="empty-state">Niciun rezultat.</div>`;
  return state.centralResults.map(r => `
    <div class="user-card">
      <div class="user-main">
        <div class="user-name">${esc(r.clientNume) || "Client necompletat"}</div>
        <div class="user-role">${esc(r.docNumber)} &nbsp;•&nbsp; ${esc(r.marcaModel)} &nbsp;•&nbsp; VIN: ${esc(r.vin) || "-"}${r.creatDe ? " &nbsp;•&nbsp; deschisă de " + esc(r.creatDe) : ""}</div>
      </div>
      <div class="user-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
        ${r.driveUrl ? `<a href="${esc(r.driveUrl)}" target="_blank" rel="noopener" class="btn btn-ghost" style="width:auto; padding:6px 10px; font-size:12px;">Deschide PDF</a>` : `<span class="note" style="margin:0;">fără PDF</span>`}
        ${r.folderUrl ? `<a href="${esc(r.folderUrl)}" target="_blank" rel="noopener" class="btn btn-ghost" style="width:auto; padding:6px 10px; font-size:12px;">Vezi poze</a>` : ""}
      </div>
    </div>
  `).join("");
}

function recordCardHtml(r) {
  const dateStr = r.dataLivrarii || (r.createdAt || "").slice(0, 10);
  return `
    <div class="record-card" data-id="${r.id || ""}">
      <div class="rc-main">
        <div class="rc-doc">${r.docNumber || "(fără număr — draft)"}</div>
        <div class="rc-client">${esc(r.client.nume) || "Client necompletat"}</div>
        <div class="rc-meta">${esc(vehicleDisplayName(r.vehicul))} &nbsp;•&nbsp; ${dateStr || "-"}</div>
      </div>
      <div class="rc-status ${r.status === "finalizat" ? "finalizat" : ""}">${r.status === "finalizat" ? "Finalizat" : "Draft"}</div>
    </div>
  `;
}

function afterArchiveRender() {
  const pullBtn = document.getElementById("btn-pull-draft");
  const pullInput = document.getElementById("pull-doc-number");
  pullBtn.addEventListener("click", async () => attemptPullByNumber(pullInput.value));
  pullInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptPullByNumber(pullInput.value);
  });

  const search = document.getElementById("archive-search");
  search.addEventListener("input", () => {
    state.archiveQuery = search.value;
    // re-randăm doar lista, păstrăm focus pe search
    const scrollY = window.scrollY;
    document.getElementById("main").innerHTML = renderArchive();
    afterArchiveRender();
    document.getElementById("archive-search").focus();
    document.getElementById("archive-search").selectionStart = document.getElementById("archive-search").value.length;
    window.scrollTo(0, scrollY);
  });

  document.querySelectorAll(".record-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const rec = state.records.find(r => r.id === id);
      if (!rec) return;
      openRecordFromArchive(rec);
    });
  });

  const centralInput = document.getElementById("central-search");
  const centralBtn = document.getElementById("btn-central-search");
  const runCentralSearch = async () => {
    const q = centralInput.value.trim();
    state.centralQuery = q;
    if (q.length < 2) { showToast("Scrie cel puțin 2 caractere."); return; }
    state.centralSearching = true;
    document.getElementById("central-results").innerHTML = renderCentralResults();
    const results = await searchFinalizedRemote(q);
    state.centralSearching = false;
    state.centralResults = results || [];
    document.getElementById("central-results").innerHTML = renderCentralResults();
  };
  centralBtn.addEventListener("click", runCentralSearch);
  centralInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runCentralSearch(); });
}

async function attemptPullByNumber(rawNumber) {
  const docNumber = (rawNumber || "").trim();
  if (!docNumber) {
    showToast("Scrie numărul fișei (ex: ICG-PDI-0007)");
    return;
  }
  showToast("Se caută fișa...", 1200);
  const record = await pullDraft(docNumber);
  if (!record) return; // pullDraft a arătat deja eroarea
  record._shared = true;
  record._openInForm = true;
  state.records.forEach(r => { r._openInForm = false; });
  state.current = record;
  upsertCurrentIntoRecords();
  state.tab = "form";
  render();
  showToast(`Fișă ${docNumber} preluată — continuă completarea`);
}

function openRecordFromArchive(rec) {
  const canDeleteRemote = isAdmin() && backendConfigured() && rec.docNumber;
  const action = prompt(
    `${rec.docNumber || "Draft"} — ${rec.client.nume || "client necompletat"}\n\n` +
    `Scrie:\n"1" = deschide/editează\n"2" = regenerează PDF\n"3" = șterge de pe acest dispozitiv` +
    (canDeleteRemote ? `\n"4" = șterge DEFINITIV (Sheet + Drive) — doar admin` : ""),
    "1"
  );
  if (action === "1") {
    state.records.forEach(r => { r._openInForm = false; });
    rec._openInForm = true;
    state.current = rec;
    state.tab = "form";
    render();
  } else if (action === "2") {
    generatePdf(rec, { download: true, open: false });
  } else if (action === "3") {
    if (confirm("Ștergi definitiv această fișă de pe acest dispozitiv?")) {
      state.records = state.records.filter(r => r.id !== rec.id);
      saveRecords();
      render();
    }
  } else if (action === "4" && canDeleteRemote) {
    if (confirm(`Ștergi DEFINITIV fișa ${rec.docNumber} — rândul din Sheet, folderul din Drive (PDF + poze) și draftul, dacă mai există? Nu se poate anula.`)) {
      showToast("Se șterge...", 1200);
      apiDeleteRecord(state.session.nume, state.session.pin, rec.docNumber).then(result => {
        if (result && result.ok) {
          state.records = state.records.filter(r => r.id !== rec.id);
          saveRecords();
          showToast(`Fișa ${rec.docNumber} a fost ștearsă definitiv.`);
          render();
        } else {
          showToast("Nu s-a putut șterge: " + ((result && result.error) || "eroare necunoscută"), 4000);
        }
      });
    }
  }
}
