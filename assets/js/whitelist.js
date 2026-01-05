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

async function postJson(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error ? json.error : String(res.status);
    throw new Error(msg);
  }
  return json;
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error ? json.error : String(res.status);
    throw new Error(msg);
  }
  return json;
}

function setResult(el, msg) {
  if (!el) return;
  el.textContent = msg;
}

function initIntroToggle() {
  const SENT_KEY = "whitelistSent";
  const intro = qs("#whitelist-intro");
  const confirm = qs("#whitelist-confirm");
  const formCard = qs("#whitelist-form-card");
  const startBtn = qs("#whitelist-start");
  const confirmStartBtn = qs("#whitelist-confirm-start");
  const confirmBackBtn = qs("#whitelist-confirm-back");

  if (!intro || !confirm || !formCard || !startBtn || !confirmStartBtn || !confirmBackBtn) return;

  if (window.localStorage.getItem(SENT_KEY)) {
    intro.style.display = "none";
    confirm.style.display = "none";
    formCard.style.display = "block";
    return;
  }

  const showIntro = () => {
    confirm.style.display = "none";
    formCard.style.display = "none";
    intro.style.display = "block";
    intro.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showConfirm = () => {
    intro.style.display = "none";
    formCard.style.display = "none";
    confirm.style.display = "block";
    confirm.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startForm = () => {
    intro.style.display = "none";
    confirm.style.display = "none";
    formCard.style.display = "block";
    const first = formCard.querySelector("textarea, input");
    if (first) first.focus();
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  startBtn.addEventListener("click", showConfirm);
  confirmBackBtn.addEventListener("click", showIntro);
  confirmStartBtn.addEventListener("click", startForm);
}

function initWhitelistForm() {
  const SENT_KEY = "whitelistSent";
  const form = qs("#whitelist-form");
  const result = qs("#submit-result");
  const success = qs("#whitelist-success");
  const successText = qs("#whitelist-success-text");
  const intro = qs("#whitelist-intro");
  const confirm = qs("#whitelist-confirm");
  const formCard = qs("#whitelist-form-card");
  if (!form) return;

  const showSuccess = (text) => {
    if (success) {
      form.style.display = "none";
      if (result) result.style.display = "none";
      success.style.display = "block";
      if (successText) successText.textContent = text || "Formulario enviado.";
    } else {
      setResult(result, text || "Formulario enviado.");
    }
  };

  const existing = window.localStorage.getItem(SENT_KEY);
  if (existing) {
    let parsed = null;
    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = null;
    }
    const text =
      parsed && parsed.id && parsed.secret
        ? `Formulario enviado. Tu ID es ${parsed.id} y tu código es ${parsed.secret}.`
        : "Formulario enviado.";
    if (intro) intro.style.display = "none";
    if (confirm) confirm.style.display = "none";
    if (formCard) formCard.style.display = "block";
    showSuccess(text);
    return;
  }

  let submitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (submitting) return;

    const requiredFields = Array.from(
      form.querySelectorAll("textarea[required], input[required]")
    );

    for (const field of requiredFields) {
      const raw = typeof field.value === "string" ? field.value : "";
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        setResult(result, "Completa todas las preguntas antes de enviar.");
        field.focus();
        return;
      }
      if (field.value !== trimmed) field.value = trimmed;
    }

    submitting = true;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    setResult(result, "Enviando...");

    const fd = new FormData(form);
    const answers = {};
    for (const [k, v] of fd.entries()) {
      if (/^q\d+$/i.test(String(k))) {
        const trimmed = String(v || "").trim();
        answers[String(k).toLowerCase()] = trimmed;
      }
    }

    const discord = String(fd.get("q1") || "").trim();
    const payload = {
      name: discord,
      discord,
      ...answers,
    };

    try {
      const out = await postJson(`${API_BASE}/api/whitelist/submit`, payload);
      form.reset();

      window.localStorage.setItem(
        SENT_KEY,
        JSON.stringify({ id: out.id, secret: out.secret, at: Date.now() })
      );
      showSuccess(`Formulario enviado. Tu ID es ${out.id} y tu código es ${out.secret}.`);
    } catch (err) {
      submitting = false;
      if (submitBtn) submitBtn.disabled = false;
      setResult(result, `Error: ${err && err.message ? err.message : ""}`);
    }
  });
}

initWhitelistForm();
initIntroToggle();
