const API_BASE =
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1") &&
  window.location.port &&
  window.location.port !== "3000"
    ? "http://localhost:3000"
    : window.location.protocol === "http:" || window.location.protocol === "https:"
      ? ""
      : "http://localhost:3000";

function qs(sel) {
  return document.querySelector(sel);
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(el, text) {
  if (el) el.textContent = text;
}

function tokenGet() {
  return window.localStorage.getItem("adminToken") || "";
}

function tokenSet(v) {
  if (v) window.localStorage.setItem("adminToken", v);
}

function tokenClear() {
  window.localStorage.removeItem("adminToken");
}

async function postJson(url, data, token = "") {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error ? json.error : String(res.status);
    throw new Error(msg);
  }
  return json;
}

async function getJson(url, token = "") {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error ? json.error : String(res.status);
    throw new Error(msg);
  }
  return json;
}

function statusLabel(s) {
  const map = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
  };
  return map[s] || s;
}

function showAuthedUI(authed) {
  const loginCard = qs("#login-card");
  const filterCard = qs("#filter-card");
  const listCard = qs("#list-card");
  const detailCard = qs("#detail-card");
  const logoutBtn = qs("#logout-btn");

  if (loginCard) loginCard.style.display = authed ? "none" : "block";
  if (filterCard) filterCard.style.display = authed ? "block" : "none";
  if (listCard) listCard.style.display = authed ? "block" : "none";
  if (detailCard) detailCard.style.display = authed ? "block" : "none";
  if (logoutBtn) logoutBtn.style.display = authed ? "inline-flex" : "none";
}

async function refreshList() {
  const t = tokenGet();
  const statusSel = qs("#status-filter");
  const status = statusSel ? String(statusSel.value || "") : "";

  const url = new URL(`${API_BASE}/api/admin/submissions`, window.location.origin);
  if (status) url.searchParams.set("status", status);

  const out = await getJson(url.toString(), t);
  const list = qs("#list");
  if (!list) return;

  list.innerHTML = "";

  if (!out.rows || !out.rows.length) {
    list.innerHTML =
      '<div class="status__row"><span class="status__label">—</span><span class="status__value">Sin solicitudes</span></div>';
    return;
  }

  out.rows.forEach((r) => {
    const row = document.createElement("div");
    row.className = "status__row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <span class="status__label">#${escapeHtml(r.id)} ${escapeHtml(r.discord)}</span>
      <span class="status__value">${escapeHtml(statusLabel(r.status))}</span>
    `;
    row.addEventListener("click", () => loadDetail(r.id));
    list.appendChild(row);
  });
}

async function loadDetail(id) {
  const t = tokenGet();
  const out = await getJson(`${API_BASE}/api/admin/submissions/${encodeURIComponent(id)}`, t);
  const el = qs("#detail");
  if (!el) return;

  const r = out.row;

  let answers = {};
  try {
    answers = r && r.answers_json ? JSON.parse(String(r.answers_json)) : {};
  } catch {
    answers = {};
  }

  const qLabels = {
    q1: "1) Usuario de Discord (EJEM: Pepe#1034).",
    q2: "2) Edad OOC.",
    q3: "3) Perfil de steam.",
    q4: "4) ¿Qué es el rol serio y qué comportamientos lo rompen?.",
    q5: "5) ¿Por qué es obligatorio valorar la vida del personaje en todo momento?.",
    q6: "6) ¿Qué se considera FairPlay y cuándo ocurre?.",
    q7: "7) Explica el metagaming y por qué está prohibido.",
    q8: "8) ¿Qué es powergaming? Da un ejemplo claro.",
    q9: "9) ¿Está permitido usar información de Discord o streams dentro del juego? ¿Por qué?.",
    q10: "10) ¿Qué es el rol entorno y cómo debe respetarse?.",
    q11: "11) ¿Qué consecuencias puede tener incumplir la normativa de rol?.",
    q12: "12) ¿Cómo debes actuar si otro jugador está rompiendo el rol en una escena?.",
    q13: "13) ¿Cuándo está permitido reportar a otro jugador?",
    q14: "14) ¿Está permitido cortar un rol sin motivo válido? Explica tu respuesta.",
    q15: "15) Diferencia entre PK y CK según la normativa.",
    q16: "16) ¿Qué recuerdas después de una muerte con PK?.",
    q17: "17) ¿En qué casos se puede realizar un CK?.",
    q18: "18) ¿Está permitido buscar venganza después de morir? ¿Por qué?.",
    q19: "19) ¿Por qué es importante mantener coherencia con la historia de tu personaje?.",
    q20: "20) ¿Qué harías si una situación no te favorece pero sigue siendo válida en rol?.",
    q21: "21) ¿Cómo afecta la normativa a la toma de decisiones de tu personaje?.",
    q22: "22) ¿Qué significa priorizar el rol por encima de ganar una escena?.",
  };

  const answersHtml = Object.keys(qLabels)
    .map((k) => {
      const v = answers && typeof answers === "object" ? answers[k] : "";
      return `
        <div class="status__row" style="flex-direction:column; align-items:flex-start; justify-content:flex-start; gap:8px">
          <span class="status__label">${escapeHtml(qLabels[k])}</span>
          <div class="status__value" style="white-space:pre-wrap; text-align:left; font-weight:500">${escapeHtml(v || "—")}</div>
        </div>
      `;
    })
    .join("\n");

  el.innerHTML = `
    <div class="status">
      <div class="status__row"><span class="status__label">ID</span><span class="status__value">#${escapeHtml(r.id)}</span></div>
      <div class="status__row"><span class="status__label">Estado</span><span class="status__value">${escapeHtml(statusLabel(r.status))}</span></div>
    </div>

    <div class="card card--soft" style="margin-top:12px">
      <h3 class="card__title" style="margin-bottom:10px">Respuestas</h3>
      <div class="status" style="margin-top:0">
        ${answersHtml}
      </div>
    </div>

    <div style="margin-top:12px">
      <div style="margin-top:12px">
        <textarea class="input" id="detail-note" style="width:100%; min-height:110px; white-space:pre-wrap" placeholder="Nota (opcional)"></textarea>
      </div>
      <div class="card__actions">
        ${r.status === "pending" ? '<button class="btn btn--primary" type="button" id="approve-btn">Aceptar</button><button class="btn" type="button" id="reject-btn">Rechazar</button>' : '<button class="btn" type="button" id="delete-btn">Borrar</button>'}
      </div>
      <p class="card__text" id="save-result" style="margin-top:12px"></p>
    </div>
  `;
  const note = qs("#detail-note");
  if (note) note.value = r.admin_note || "";

  const resEl = qs("#save-result");
  const approveBtn = qs("#approve-btn");
  const rejectBtn = qs("#reject-btn");
  const deleteBtn = qs("#delete-btn");

  async function setDecision(status) {
    const admin_note = note ? note.value : "";
    setText(resEl, "Guardando...");
    try {
      await postJson(
        `${API_BASE}/api/admin/submissions/${encodeURIComponent(id)}/update`,
        { status, admin_note },
        t
      );
      setText(resEl, "Actualizado.");
      await refreshList();
      await loadDetail(id);
    } catch (err) {
      setText(resEl, `Error: ${err && err.message ? err.message : ""}`);
    }
  }

  if (approveBtn) approveBtn.addEventListener("click", () => setDecision("approved"));
  if (rejectBtn) rejectBtn.addEventListener("click", () => setDecision("rejected"));

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      setText(resEl, "Borrando...");
      deleteBtn.disabled = true;
      try {
        await postJson(`${API_BASE}/api/admin/submissions/${encodeURIComponent(id)}/delete`, {}, t);
        setText(resEl, "Borrada.");
        const detail = qs("#detail");
        if (detail) detail.innerHTML = "";
        await refreshList();
      } catch (err) {
        deleteBtn.disabled = false;
        setText(resEl, `Error: ${err && err.message ? err.message : ""}`);
      }
    });
  }
}

function initLogin() {
  const form = qs("#login-form");
  const resEl = qs("#login-result");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(resEl, "Entrando...");

    const fd = new FormData(form);
    const user = String(fd.get("user") || "");
    const pass = String(fd.get("pass") || "");

    try {
      const out = await postJson(`${API_BASE}/api/admin/login`, { user, pass });
      tokenSet(out.token);
      showAuthedUI(true);
      setText(resEl, "");
      await refreshList();
    } catch (err) {
      setText(resEl, `Error: ${err && err.message ? err.message : ""}`);
    }
  });
}

function initControls() {
  const refreshBtn = qs("#refresh-btn");
  const logoutBtn = qs("#logout-btn");
  const statusSel = qs("#status-filter");
  const adminRes = qs("#admin-result");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      try {
        setText(adminRes, "Actualizando...");
        await refreshList();
        setText(adminRes, "");
      } catch (err) {
        setText(adminRes, `Error: ${err && err.message ? err.message : ""}`);
      }
    });
  }

  if (statusSel) {
    statusSel.addEventListener("change", () => {
      refreshList().catch(() => {});
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      tokenClear();
      showAuthedUI(false);
      const detail = qs("#detail");
      const list = qs("#list");
      if (detail) detail.innerHTML = "";
      if (list) list.innerHTML = "";
    });
  }
}

(function boot() {
  const authed = Boolean(tokenGet());
  showAuthedUI(authed);
  initLogin();
  initControls();
  if (authed) refreshList().catch(() => showAuthedUI(false));
})();
