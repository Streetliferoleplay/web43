const CONFIG = {
  serverName: "STREETLIFE ROLEPLAY",
  discordUrl: "https://discord.gg/2pX3pyGHrN",
  connectUrl: "https://cfx.re/join/yg3azj",
  connectDisplay: "cfx.re/join/yg3azj",
  logoUrl: "assets/img/logo-sl.png",
  heroImageUrl: "assets/img/hero-sl.png",
  galleryImages: [
    "assets/img/galeria-1.jpg",
    "assets/img/galeria-2.jpg",
    "assets/img/galeria-3.jpg",
    "assets/img/galeria-4.jpg",
    "assets/img/galeria-5.jpg",
    "assets/img/galeria-6.jpg",
  ],
};

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
}

function setHref(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.setAttribute("href", value);
  });
}

function setTitle(value) {
  document.title = `${value} | FiveM`;
  const brand = document.querySelector(".brand__text");
  if (brand) brand.textContent = value;
  const footer = document.querySelector(".footer__text");
  if (footer) footer.innerHTML = `© <span data-year></span> ${value}.`;
}

function initNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initCopy() {
  const btn = document.querySelector("[data-copy-connect]");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.connectUrl);
      const prev = btn.textContent;
      btn.textContent = "Copiado";
      window.setTimeout(() => (btn.textContent = prev), 900);
    } catch {
      // No clipboard access
      window.prompt("Copia el enlace:", CONFIG.connectUrl);
    }
  });
}

function initYear() {
  setText("[data-year]", String(new Date().getFullYear()));
}

function initConfig() {
  setTitle(CONFIG.serverName);
  setHref("[data-discord-link]", CONFIG.discordUrl);
  setHref("[data-connect-link]", CONFIG.connectUrl);
  setText("[data-connect-display]", CONFIG.connectDisplay);

  const panelLogo = document.querySelector("[data-panel-logo]");
  if (panelLogo && CONFIG.logoUrl) {
    panelLogo.src = CONFIG.logoUrl;
  }

  const heroMedia = document.querySelector("[data-hero-image]");
  if (heroMedia && CONFIG.heroImageUrl) {
    heroMedia.style.backgroundImage = `url('${CONFIG.heroImageUrl}')`;
  }

  const shots = Array.from(document.querySelectorAll(".shot"));
  if (shots.length && Array.isArray(CONFIG.galleryImages) && CONFIG.galleryImages.length) {
    shots.forEach((shot, idx) => {
      const url = CONFIG.galleryImages[idx];
      if (!url) return;
      shot.style.backgroundImage = `url('${url}')`;
      shot.style.backgroundSize = "cover";
      shot.style.backgroundPosition = "center";
    });
  }
}

initNav();
initCopy();
initYear();
initConfig();
