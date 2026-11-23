// ============================================================================
// SZIKE Egyesület – Százhalombatta | Alkalmazás logika & Firebase (szike-b4484)
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ----------------------------------------------------------------------------
// 1. FIREBASE KONFIGURÁCIÓ (szike-b4484)
// ----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDV4jSYveE15skWeo3jD41vvuaf6LXYkhg",
  authDomain: "szike-b4484.firebaseapp.com",
  projectId: "szike-b4484",
  storageBucket: "szike-b4484.firebasestorage.app",
  messagingSenderId: "189727523474",
  appId: "1:189727523474:web:3e2b7ad82b6bb9645b9c4b",
  measurementId: "G-9G16JWVHS6"
};

// Ha feltöltöd a GitHub repóba a syikekep.jpeg fájlt az index.html mellé,
// írd át ezt erre: "./syikekep.jpeg" (egyébként az Adminból feltöltött vagy a vektoros logót használja).
const LOCAL_LOGO_PATH = "";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------------------------------------------------------------------
// 2. ALAPÉRTELMEZETT ADATOK, SZÍNPALETTÁK ÉS VEKTOROS SZIKE LOGÓ
// ----------------------------------------------------------------------------
const DEFAULT_THEME = {
  brandPrimary: "#1E4E8C", // Mély középkék
  brandDark: "#0F2544",    // Éjkék
  accentColor: "#E6A100",  // Mély napsárga
  accentText: "#0F2544",   // Éjkék szöveg a sárga gombon
  bgSoft: "#F7F9FC",       // Hideg törtfehér
  bgWhite: "#FFFFFF"       // Tiszta fehér
};

const THEME_PRESETS = {
  "szike-default": { ...DEFAULT_THEME },
  "forest-amber": {
    brandPrimary: "#1B6B52",
    brandDark: "#102A22",
    accentColor: "#E8871E",
    accentText: "#FFFFFF",
    bgSoft: "#F5F9F7",
    bgWhite: "#FFFFFF"
  },
  "modern-slate": {
    brandPrimary: "#334155",
    brandDark: "#0F172A",
    accentColor: "#D99B00",
    accentText: "#0F172A",
    bgSoft: "#F8FAFC",
    bgWhite: "#FFFFFF"
  },
  "berry-cream": {
    brandPrimary: "#881337",
    brandDark: "#2D0A16",
    accentColor: "#EAB308",
    accentText: "#2D0A16",
    bgSoft: "#FDF8F9",
    bgWhite: "#FFFFFF"
  }
};

const DEFAULT_CONFIG = {
  status: "open",
  statusMessage: "Várunk szeretettel az Ifjúsági Műhelyben! Gyere be egy társasra, beszélgetésre vagy projektötletre.",
  hours: "Hétfő–Péntek: 14:00 – 19:00",
  announcementActive: false,
  announcementText: "",
  taxNumber: "18700000-1-13",
  bankAccount: "11742094-20000000-00000000",
  supportNote: "Adód 1%-ával vagy egyszeri támogatással közvetlenül a százhalombattai Ifjúsági Műhely eszközeit, társasjátékait és közösségi rendezvényeit támogatod.",
  logoDataUrl: "",
  theme: { ...DEFAULT_THEME }
};

const VECTOR_LOGO_SVG = `
  <svg viewBox="0 0 220 110" class="w-full h-full object-contain" xmlns="http://www.w3.org/2000/svg" aria-label="SZIKE logó">
    <rect x="6" y="8" width="208" height="6" fill="#0F2544" rx="2"/>
    <rect x="6" y="96" width="208" height="6" fill="#0F2544" rx="2"/>
    <path d="M18 14 C24 28, 30 34, 34 40 M42 14 C46 24, 52 30, 56 32 M176 14 C172 28, 168 34, 162 40 M198 14 C192 26, 188 32, 184 36" stroke="#0F2544" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M22 96 C26 84, 32 78, 38 74 M170 96 C176 86, 184 80, 194 76" stroke="#0F2544" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>
    <text x="110" y="75" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="800" font-size="60" fill="#0F2544" letter-spacing="-2">Szike</text>
    <circle cx="113" cy="30" r="5" fill="#E6A100"/>
  </svg>
`;

const STATUS_META = {
  open: {
    label: "NYITVA",
    dotClass: "status-open",
    badgeClasses: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  closed: {
    label: "ZÁRVA",
    dotClass: "status-closed",
    badgeClasses: "bg-rose-50 text-rose-700 border-rose-200"
  },
  event: {
    label: "RENDEZVÉNY",
    dotClass: "status-event",
    badgeClasses: "bg-amber-50 text-amber-800 border-amber-200"
  }
};

// ----------------------------------------------------------------------------
// 3. ALKALMAZÁS ÁLLAPOT (STATE)
// ----------------------------------------------------------------------------
const state = {
  config: { ...DEFAULT_CONFIG },
  publicEvents: [],
  adminEvents: [],
  registrations: [],
  activeCategory: "all",
  searchQuery: "",
  currentUser: null,
  unsubAdminEvents: null,
  unsubAdminRegs: null,
  pendingConfirmAction: null
};

// ----------------------------------------------------------------------------
// 4. SEGÉDFÜGGVÉNYEK
// ----------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, type = "info") {
  const container = $("toast-container");
  if (!container) return;

  const palette = {
    success: "bg-emerald-600 text-white",
    error: "bg-rose-600 text-white",
    info: "bg-slate-900 text-white"
  };

  const el = document.createElement("div");
  el.className = `toast-item px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2.5 ${palette[type] || palette.info}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "all 0.25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3400);
}

async function copyText(text, label = "Vágólapra másolva!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label, "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast(label, "success");
  }
}

function formatDateHu(isoDate) {
  if (!isoDate) return "Hamarosan";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

function formatTimestampHu(ts) {
  if (!ts) return "";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function openConfirmModal(title, message, onConfirm) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  state.pendingConfirmAction = onConfirm;
  $("confirm-modal").classList.remove("hidden");
}

function closeConfirmModal() {
  state.pendingConfirmAction = null;
  $("confirm-modal").classList.add("hidden");
}

// ----------------------------------------------------------------------------
// 5. DINAMIKUS TÉMASZÍN MOTOR
// ----------------------------------------------------------------------------
const COLOR_FIELD_MAP = [
  { key: "brandPrimary", cssVar: "--brand-primary", colorId: "color-brand-primary", hexId: "hex-brand-primary" },
  { key: "brandDark",    cssVar: "--brand-dark",    colorId: "color-brand-dark",    hexId: "hex-brand-dark" },
  { key: "accentColor",  cssVar: "--accent-color",  colorId: "color-accent-color",  hexId: "hex-accent-color" },
  { key: "accentText",   cssVar: "--accent-text",   colorId: "color-accent-text",   hexId: "hex-accent-text" },
  { key: "bgSoft",       cssVar: "--bg-soft",       colorId: "color-bg-soft",       hexId: "hex-bg-soft" },
  { key: "bgWhite",      cssVar: "--bg-white",      colorId: "color-bg-white",      hexId: "hex-bg-white" }
];

function applyThemeToDOM(themeObj = {}) {
  const merged = { ...DEFAULT_THEME, ...themeObj };
  const root = document.documentElement;

  COLOR_FIELD_MAP.forEach(({ key, cssVar }) => {
    const val = isValidHex(merged[key]) ? merged[key] : DEFAULT_THEME[key];
    root.style.setProperty(cssVar, val);
  });

  const metaTheme = $("meta-theme-color");
  if (metaTheme && isValidHex(merged.brandPrimary)) {
    metaTheme.setAttribute("content", merged.brandPrimary);
  }
}

function syncThemeInputs(themeObj = {}) {
  const merged = { ...DEFAULT_THEME, ...themeObj };
  COLOR_FIELD_MAP.forEach(({ key, colorId, hexId }) => {
    const val = (isValidHex(merged[key]) ? merged[key] : DEFAULT_THEME[key]).toUpperCase();
    const colorEl = $(colorId);
    const hexEl = $(hexId);
    if (colorEl) colorEl.value = val;
    if (hexEl) hexEl.value = val;
  });
}

function readThemeFromInputs() {
  const out = {};
  COLOR_FIELD_MAP.forEach(({ key, colorId, hexId }) => {
    const hexVal = ($(hexId)?.value || "").trim();
    const colorVal = ($(colorId)?.value || "").trim();
    out[key] = isValidHex(hexVal) ? hexVal.toUpperCase() : (isValidHex(colorVal) ? colorVal.toUpperCase() : DEFAULT_THEME[key]);
  });
  return out;
}

function initThemeEditorListeners() {
  COLOR_FIELD_MAP.forEach(({ colorId, hexId }) => {
    const colorEl = $(colorId);
    const hexEl = $(hexId);

    colorEl?.addEventListener("input", () => {
      if (hexEl) hexEl.value = colorEl.value.toUpperCase();
      applyThemeToDOM(readThemeFromInputs());
    });

    hexEl?.addEventListener("input", () => {
      let v = hexEl.value.trim();
      if (v && !v.startsWith("#")) v = "#" + v;
      if (isValidHex(v)) {
        if (colorEl) colorEl.value = v;
        applyThemeToDOM(readThemeFromInputs());
      }
    });
  });

  document.querySelectorAll(".theme-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = THEME_PRESETS[btn.dataset.preset];
      if (!preset) return;
      syncThemeInputs(preset);
      applyThemeToDOM(preset);
      showToast("Előnézet frissítve – ne felejts el Menteni!", "info");
    });
  });

  $("save-theme-btn")?.addEventListener("click", async () => {
    const btn = $("save-theme-btn");
    const theme = readThemeFromInputs();
    btn.disabled = true;
    btn.textContent = "Mentés...";
    try {
      await setDoc(doc(db, "siteConfig", "main"), { theme, updatedAt: serverTimestamp() }, { merge: true });
      showToast("Színpaletta elmentve – minden látogatónál frissült!", "success");
    } catch (err) {
      console.error(err);
      showToast("Hiba a színpaletta mentésekor (ellenőrizd a Firestore Rules-t).", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Színpaletta mentése élesbe";
    }
  });

  $("reset-theme-btn")?.addEventListener("click", async () => {
    syncThemeInputs(DEFAULT_THEME);
    applyThemeToDOM(DEFAULT_THEME);
    try {
      await setDoc(doc(db, "siteConfig", "main"), { theme: { ...DEFAULT_THEME }, updatedAt: serverTimestamp() }, { merge: true });
      showToast("Alapértelmezett Fehér–Sárga–Kék paletta visszaállítva!", "success");
    } catch (err) {
      console.error(err);
      showToast("Nem sikerült menteni a visszaállítást.", "error");
    }
  });
}

// ----------------------------------------------------------------------------
// 6. LOGÓ RENDERELÉS ÉS FELTÖLTÉS (TÖMÖRÍTÉSSEL)
// ----------------------------------------------------------------------------
function renderLogos() {
  const src = state.config.logoDataUrl || LOCAL_LOGO_PATH;
  const targets = [
    "nav-logo-container",
    "footer-logo-container",
    "admin-login-logo",
    "admin-sidebar-logo",
    "admin-logo-preview"
  ];

  targets.forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (src) {
      el.innerHTML = `<img src="${escapeHtml(src)}" alt="SZIKE Egyesület logó" class="w-full h-full object-contain" />`;
    } else {
      el.innerHTML = VECTOR_LOGO_SVG;
    }
  });
}

function compressImageToDataUrl(file, maxWidth = 420, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Fájl olvasási hiba"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Érvénytelen képfájl"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleLogoFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Kérlek, érvényes képfájlt (JPG, PNG, WEBP) válassz!", "error");
    return;
  }
  try {
    showToast("Logó optimalizálása és mentése...", "info");
    const dataUrl = await compressImageToDataUrl(file);
    await setDoc(doc(db, "siteConfig", "main"), { logoDataUrl: dataUrl, updatedAt: serverTimestamp() }, { merge: true });
    showToast("Saját logó sikeresen elmentve!", "success");
  } catch (err) {
    console.error(err);
    showToast("Hiba történt a logó mentésekor.", "error");
  }
}

function initLogoUploader() {
  const input = $("logo-file-input");
  const dropzone = $("logo-dropzone");

  input?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleLogoFile(file);
    input.value = "";
  });

  if (dropzone) {
    ["dragenter", "dragover"].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("border-theme-primary", "bg-theme-primary-soft");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-theme-primary", "bg-theme-primary-soft");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleLogoFile(file);
    });
  }

  $("reset-logo-btn")?.addEventListener("click", async () => {
    try {
      await setDoc(doc(db, "siteConfig", "main"), { logoDataUrl: "", updatedAt: serverTimestamp() }, { merge: true });
      showToast("Vektoros SZIKE logó visszaállítva!", "success");
    } catch (err) {
      console.error(err);
      showToast("Nem sikerült visszaállítani a logót.", "error");
    }
  });
}

// ----------------------------------------------------------------------------
// 7. NYILVÁNOS OLDAL RENDERELÉS (STÁTUSZ, TÁMOGATÁS, PROGRAMOK)
// ----------------------------------------------------------------------------
function renderSiteConfig() {
  const cfg = state.config;
  const meta = STATUS_META[cfg.status] || STATUS_META.open;

  // Színek & Logók
  applyThemeToDOM(cfg.theme);
  renderLogos();

  // Közlemény sáv
  const bar = $("announcement-bar");
  if (cfg.announcementActive && cfg.announcementText?.trim()) {
    $("announcement-text").textContent = cfg.announcementText.trim();
    bar.classList.remove("hidden");
  } else {
    bar.classList.add("hidden");
  }

  // Fejléc mini státusz
  const navDot = $("nav-status-dot");
  if (navDot) navDot.className = `sonar-dot ${meta.dotClass}`;
  const navText = $("nav-status-text");
  if (navText) navText.textContent = `Műhelytér: ${meta.label}`;

  // Hero státusz kártya
  const heroDot = $("hero-status-dot");
  if (heroDot) heroDot.className = `sonar-dot ${meta.dotClass}`;
  const heroTitle = $("hero-status-title");
  if (heroTitle) heroTitle.textContent = meta.label;

  const heroBadge = $("hero-status-badge");
  if (heroBadge) {
    heroBadge.className = `inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold border ${meta.badgeClasses}`;
  }

  $("hero-status-message").textContent = cfg.statusMessage || DEFAULT_CONFIG.statusMessage;
  $("hero-status-hours").textContent = cfg.hours || DEFAULT_CONFIG.hours;

  const updatedText = cfg.updatedAt ? `Frissítve: ${formatTimestampHu(cfg.updatedAt)}` : "Valós idejű szinkronizáció";
  $("hero-status-updated").textContent = updatedText;

  // Támogatás szekció
  $("tax-number-display").textContent = cfg.taxNumber || DEFAULT_CONFIG.taxNumber;
  $("bank-account-display").textContent = cfg.bankAccount || DEFAULT_CONFIG.bankAccount;
  $("support-note-display").textContent = cfg.supportNote || DEFAULT_CONFIG.supportNote;

  // Admin űrlap mezők szinkronizálása
  syncAdminConfigForms();
}

function renderPublicEvents() {
  $("events-loading")?.classList.add("hidden");
  const grid = $("events-grid");
  const empty = $("events-empty");

  const term = state.searchQuery.trim().toLowerCase();
  const filtered = state.publicEvents
    .filter((ev) => {
      const catOk = state.activeCategory === "all" || ev.category === state.activeCategory;
      const searchOk =
        !term ||
        (ev.title || "").toLowerCase().includes(term) ||
        (ev.description || "").toLowerCase().includes(term) ||
        (ev.location || "").toLowerCase().includes(term);
      return catOk && searchOk;
    })
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  if (filtered.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");

  grid.innerHTML = filtered
    .map((ev) => {
      const cap = Number(ev.capacity) || 0;
      const reg = Number(ev.registeredCount) || 0;
      const isFull = cap > 0 && reg >= cap;
      const spotsText = cap > 0 ? (isFull ? "Betelt" : `${Math.max(0, cap - reg)} szabad hely`) : "Szabadon látogatható";

      return `
        <article class="theme-card rounded-3xl p-6 flex flex-col justify-between gap-5">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-theme-primary-soft text-theme-primary">
                ${escapeHtml(ev.category || "Program")}
              </span>
              <span class="text-xs font-bold ${isFull ? "text-rose-600" : "text-emerald-700"}">
                ${escapeHtml(spotsText)}
              </span>
            </div>

            <h3 class="text-xl font-extrabold text-theme-dark leading-snug">${escapeHtml(ev.title)}</h3>
            <p class="text-sm text-theme-muted line-clamp-3 leading-relaxed">${escapeHtml(ev.description)}</p>
          </div>

          <div class="space-y-4 pt-2 border-t border-slate-100">
            <div class="space-y-1.5 text-xs text-theme-muted font-medium">
              <div class="flex items-center gap-2">
                <span class="text-theme-primary font-bold">📅</span>
                <span>${escapeHtml(formatDateHu(ev.date))} · ${escapeHtml(ev.time || "")}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-theme-primary font-bold">📍</span>
                <span class="truncate">${escapeHtml(ev.location || "Barátság Művelődési Központ")}</span>
              </div>
            </div>

            <button type="button" data-open-event="${escapeHtml(ev.id)}"
              class="${isFull ? "btn-outline-theme" : "btn-accent"} w-full py-2.5 rounded-xl text-sm font-extrabold">
              ${isFull ? "Részletek megtekintése" : "Részletek & Jelentkezés"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-open-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = state.publicEvents.find((item) => item.id === btn.dataset.openEvent);
      if (ev) openEventModal(ev);
    });
  });
}

function openEventModal(ev) {
  const cap = Number(ev.capacity) || 0;
  const reg = Number(ev.registeredCount) || 0;
  const isFull = cap > 0 && reg >= cap;

  $("modal-event-category").textContent = ev.category || "Program";
  $("modal-event-title").textContent = ev.title || "";
  $("modal-event-date").textContent = `${formatDateHu(ev.date)}${ev.time ? " · " + ev.time : ""}`;
  $("modal-event-location").textContent = ev.location || "Barátság Művelődési Központ, Szent István tér 5.";
  $("modal-event-spots").textContent = cap > 0 ? `${Math.max(0, cap - reg)} / ${cap} szabad` : "Korlátlan férőhely";
  $("modal-event-description").textContent = ev.description || "";
  $("reg-event-id").value = ev.id;

  $("reg-form").reset();
  if (isFull) {
    $("reg-full-notice").classList.remove("hidden");
    $("reg-form").classList.add("hidden");
  } else {
    $("reg-full-notice").classList.add("hidden");
    $("reg-form").classList.remove("hidden");
  }

  $("event-modal").classList.remove("hidden");
}

function closeEventModal() {
  $("event-modal").classList.add("hidden");
}
function populateVolunteerEventSelect() {
  const select = $("vol-event");
  if (!select) return;
  const sorted = [...state.publicEvents].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const options = sorted.map(
    (ev) => `<option value="${escapeHtml(ev.id)}">${escapeHtml(ev.title)} (${escapeHtml(formatDateHu(ev.date))})</option>`
  );
  options.push(`<option value="general">Általános önkéntesség (Ifjúsági Műhely / bármely program)</option>`);
  select.innerHTML = `<option value="" disabled selected>Válassz programot...</option>` + options.join("");
}

function updateIkszFieldsVisibility() {
  const isIksz = Boolean($("vol-iksz")?.checked);
  const fieldsWrap = $("vol-iksz-fields");
  const schoolSelect = $("vol-school-select");
  const customWrap = $("vol-school-custom-wrap");
  const customInput = $("vol-school-custom");

  if (!fieldsWrap || !schoolSelect || !customWrap || !customInput) return;

  if (isIksz) {
    fieldsWrap.classList.remove("hidden");
    schoolSelect.required = true;
    const isOther = schoolSelect.value === "other";
    customWrap.classList.toggle("hidden", !isOther);
    customInput.required = isOther;
  } else {
    fieldsWrap.classList.add("hidden");
    customWrap.classList.add("hidden");
    schoolSelect.required = false;
    customInput.required = false;
    schoolSelect.value = "";
    customInput.value = "";
  }
}

function openVolunteerModal() {
  $("volunteer-form")?.reset();
  populateVolunteerEventSelect();
  updateIkszFieldsVisibility();
  $("volunteer-modal")?.classList.remove("hidden");
}

function closeVolunteerModal() {
  $("volunteer-modal")?.classList.add("hidden");
}

// ----------------------------------------------------------------------------
// 8. ADMIN VEZÉRLŐPULT LOGIKA
// ----------------------------------------------------------------------------
function syncAdminConfigForms() {
  const cfg = state.config;
  const meta = STATUS_META[cfg.status] || STATUS_META.open;

  // Státusz form
  $("stat-current-status").textContent = meta.label;
  $("input-status-value").value = cfg.status || "open";
  $("input-status-message").value = cfg.statusMessage || "";
  $("input-status-hours").value = cfg.hours || "";
  $("input-announcement-active").checked = Boolean(cfg.announcementActive);
  $("input-announcement-text").value = cfg.announcementText || "";

  highlightStatusCards(cfg.status || "open");
  updateAdminStatusPreview();

  // Támogatási form
  $("input-tax-number").value = cfg.taxNumber || "";
  $("input-bank-account").value = cfg.bankAccount || "";
  $("input-support-note").value = cfg.supportNote || "";

  // Színpaletta inputok
  syncThemeInputs(cfg.theme);
}

function highlightStatusCards(val) {
  document.querySelectorAll(".status-radio-card").forEach((card) => {
    card.classList.remove("selected-open", "selected-closed", "selected-event");
    if (card.dataset.statusVal === val) {
      card.classList.add(`selected-${val}`);
    }
  });
}

function updateAdminStatusPreview() {
  const val = $("input-status-value").value || "open";
  const meta = STATUS_META[val] || STATUS_META.open;
  $("preview-status-dot").className = `sonar-dot ${meta.dotClass}`;
  $("preview-status-label").textContent = meta.label;
  $("preview-status-message").textContent = $("input-status-message").value || "—";
  $("preview-status-hours").textContent = $("input-status-hours").value ? `(${$("input-status-hours").value})` : "";
}

function renderAdminStats() {
  $("stat-events-count").textContent = String(state.adminEvents.length);
  $("stat-published-count").textContent = String(state.adminEvents.filter((e) => e.published).length);
  $("stat-reg-count").textContent = String(state.registrations.length);
  $("reg-total-badge").textContent = String(state.registrations.length);
}

function renderAdminEvents() {
  renderAdminStats();
  const list = $("admin-events-list");
  if (!list) return;

  const sorted = [...state.adminEvents].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  // Jelentkezők szűrő dropdown frissítése
  const select = $("reg-filter-event");
  const prevVal = select.value;
 const volCount = state.registrations.filter((r) => r.role === "volunteer").length;
  const ikszCount = state.registrations.filter((r) => r.iksz).length;
  select.innerHTML =
    `<option value="all">Összes jelentkező (${state.registrations.length})</option>` +
    `<option value="volunteers-only">Csak önkéntesek (${volCount})</option>` +
    `<option value="iksz-only">Csak IKSZ jelentkezők (${ikszCount})</option>` +
    sorted.map((ev) => `<option value="${escapeHtml(ev.id)}">${escapeHtml(ev.title)}</option>`).join("");
  if ([...select.options].some((o) => o.value === prevVal)) select.value = prevVal;

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="bg-theme-surface rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-2">
        <p class="font-bold text-theme-dark">Még nincs felvett program.</p>
        <p class="text-xs text-theme-muted">Kattints az „+ Új program felvétele” gombra, vagy töltsd fel a kezdő mintadatokat az első fülön!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = sorted
    .map((ev) => {
      const cap = Number(ev.capacity) || 0;
      const reg = Number(ev.registeredCount) || 0;
      return `
        <div class="bg-theme-surface rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1.5 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                ev.published ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
              }">
                ${ev.published ? "Publikus" : "Piszkozat"}
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-theme-primary-soft text-theme-primary">
                ${escapeHtml(ev.category || "Program")}
              </span>
              <span class="text-xs font-bold text-theme-muted">
                👥 ${reg}${cap > 0 ? " / " + cap : " fő"}
              </span>
            </div>
            <h3 class="text-lg font-extrabold text-theme-dark truncate">${escapeHtml(ev.title)}</h3>
            <p class="text-xs text-theme-muted">
              📅 ${escapeHtml(formatDateHu(ev.date))} ${escapeHtml(ev.time || "")} · 📍 ${escapeHtml(ev.location || "")}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" data-toggle-pub="${escapeHtml(ev.id)}" class="btn-outline-theme px-3 py-1.5 rounded-xl text-xs font-bold">
              ${ev.published ? "Elrejtés" : "Publikálás"}
            </button>
            <button type="button" data-edit-event="${escapeHtml(ev.id)}" class="btn-primary px-3 py-1.5 rounded-xl text-xs font-bold">
              Szerkesztés
            </button>
            <button type="button" data-delete-event="${escapeHtml(ev.id)}" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200">
              Törlés
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll("[data-toggle-pub]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ev = state.adminEvents.find((x) => x.id === btn.dataset.togglePub);
      if (!ev) return;
      try {
        await updateDoc(doc(db, "events", ev.id), { published: !ev.published });
        showToast(ev.published ? "Program piszkozatra állítva." : "Program publikálva!", "success");
      } catch (err) {
        console.error(err);
        showToast("Hiba a státusz módosításakor.", "error");
      }
    });
  });

  list.querySelectorAll("[data-edit-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = state.adminEvents.find((x) => x.id === btn.dataset.editEvent);
      if (ev) openEventEditor(ev);
    });
  });

  list.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = state.adminEvents.find((x) => x.id === btn.dataset.deleteEvent);
      if (!ev) return;
      openConfirmModal("Program törlése", `Biztosan végleg törlöd a(z) „${ev.title}” programot?`, async () => {
        try {
          await deleteDoc(doc(db, "events", ev.id));
          showToast("Program törölve.", "success");
        } catch (err) {
          console.error(err);
          showToast("Nem sikerült törölni a programot.", "error");
        }
      });
    });
  });
}

function openEventEditor(ev = null) {
  $("event-editor-form").reset();
  if (ev) {
    $("editor-modal-title").textContent = "Program szerkesztése";
    $("edit-event-id").value = ev.id;
    $("edit-event-title").value = ev.title || "";
    $("edit-event-category").value = ev.category || "Ifjúsági Műhely";
    $("edit-event-capacity").value = Number(ev.capacity) || 0;
    $("edit-event-date").value = ev.date || "";
    $("edit-event-time").value = ev.time || "";
    $("edit-event-location").value = ev.location || "Barátság Művelődési Központ, Szent István tér 5.";
    $("edit-event-description").value = ev.description || "";
    $("edit-event-published").checked = Boolean(ev.published);
  } else {
    $("editor-modal-title").textContent = "Új program felvétele";
    $("edit-event-id").value = "";
    $("edit-event-location").value = "Barátság Művelődési Központ, Szent István tér 5.";
    $("edit-event-capacity").value = 25;
    $("edit-event-published").checked = true;
  }
  $("event-editor-modal").classList.remove("hidden");
}

function closeEventEditor() {
  $("event-editor-modal").classList.add("hidden");
}

function renderRegistrations() {
  renderAdminStats();
  const tbody = $("admin-registrations-body");
  const empty = $("admin-registrations-empty");
  const filterId = $("reg-filter-event").value;

const filtered = state.registrations
    .filter((r) => {
      if (filterId === "all") return true;
      if (filterId === "volunteers-only") return r.role === "volunteer";
      if (filterId === "iksz-only") return Boolean(r.iksz);
      return r.eventId === filterId;
    })
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  tbody.innerHTML = filtered
    .map(
      (r) => `
      <tr class="hover:bg-theme-soft/60">
        <td class="px-5 py-3.5 font-bold text-theme-dark">
          <div class="flex flex-wrap items-center gap-1.5">
            <span>${escapeHtml(r.name)}</span>
            ${
              r.role === "volunteer"
                ? `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-theme-accent">ÖNKÉNTES</span>`
                : ""
            }
            ${
              r.iksz
                ? `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-theme-primary-soft text-theme-primary border border-theme-primary">IKSZ</span>`
                : ""
            }
          </div>
          ${
            r.iksz && r.school
              ? `<span class="block text-[11px] font-medium text-theme-muted mt-0.5">🏫 ${escapeHtml(r.school)}</span>`
              : ""
          }
        </td>
        <td class="px-5 py-3.5 text-xs font-semibold text-theme-primary">${escapeHtml(r.eventTitle || "—")}</td>
        <td class="px-5 py-3.5 text-xs">
          <a href="mailto:${escapeHtml(r.email)}" class="block font-semibold text-theme-dark hover:underline">${escapeHtml(r.email)}</a>
          ${r.phone ? `<a href="tel:${escapeHtml(r.phone)}" class="text-theme-muted hover:underline">${escapeHtml(r.phone)}</a>` : ""}
        </td>
        <td class="px-5 py-3.5 text-xs text-theme-muted max-w-[220px] truncate" title="${escapeHtml(r.note || "")}">${escapeHtml(r.note || "—")}</td>
        <td class="px-5 py-3.5 text-xs text-theme-muted whitespace-nowrap">${escapeHtml(formatTimestampHu(r.createdAt) || "Most")}</td>
        <td class="px-5 py-3.5 text-right">
          <button type="button" data-delete-reg="${escapeHtml(r.id)}" class="text-xs font-bold text-rose-600 hover:underline">Törlés</button>
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll("[data-delete-reg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reg = state.registrations.find((x) => x.id === btn.dataset.deleteReg);
      if (!reg) return;
      openConfirmModal("Jelentkezés törlése", `Biztosan törlöd ${reg.name} jelentkezését?`, async () => {
        try {
          await deleteDoc(doc(db, "registrations", reg.id));
          if (reg.eventId && reg.eventId !== "general" && reg.role !== "volunteer") {
            const ev = state.adminEvents.find((e) => e.id === reg.eventId);
            if (ev && Number(ev.registeredCount) > 0) {
              await updateDoc(doc(db, "events", reg.eventId), { registeredCount: increment(-1) });
            }
          }
          showToast("Jelentkezés törölve.", "success");
        } catch (err) {
          console.error(err);
          showToast("Hiba a törlés során.", "error");
        }
      });
    });
  });
}

function exportRegistrationsCsv() {
  const filterId = $("reg-filter-event").value;
  const rows = state.registrations.filter((r) => {
    if (filterId === "all") return true;
    if (filterId === "volunteers-only") return r.role === "volunteer";
    if (filterId === "iksz-only") return Boolean(r.iksz);
    return r.eventId === filterId;
  });
  if (rows.length === 0) {
    showToast("Nincs exportálható jelentkező ebben a nézetben.", "info");
    return;
  }

  const headers = ["Típus", "IKSZ", "Iskola", "Név", "Program", "E-mail", "Telefonszám", "Megjegyzés", "Jelentkezés ideje"];
  const escapeCsv = (val) => `"${String(val || "").replaceAll('"', '""')}"`;

  const csvLines = [
    headers.map(escapeCsv).join(";"),
    ...rows.map((r) =>
      [
        r.role === "volunteer" ? "Önkéntes" : "Résztvevő",
        r.iksz ? "Igen" : "Nem",
        r.school || "",
        r.name,
        r.eventTitle,
        r.email,
        r.phone,
        r.note,
        formatTimestampHu(r.createdAt)
      ]
        .map(escapeCsv)
        .join(";")
    )
  ];

  const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `szike-jelentkezok-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("CSV fájl sikeresen letöltve!", "success");
}

async function seedInitialData() {
  const btn = $("seed-data-btn");
  btn.disabled = true;
  btn.textContent = "Feltöltés...";
  try {
    await setDoc(doc(db, "siteConfig", "main"), {
      ...DEFAULT_CONFIG,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (state.adminEvents.length === 0) {
      const samples = [
        {
          title: "Pénteki Társasjáték Est",
          category: "Ifjúsági Műhely",
          date: "2026-12-04",
          time: "17:00 – 21:00",
          location: "Barátság Művelődési Központ, Szent István tér 5.",
          capacity: 24,
          registeredCount: 0,
          published: true,
          description: "Stratégiai, parti- és kooperatív társasjátékok, jó társaság, tea és rágcsa. Hozd el a barátaidat, vagy gyere egyedül – nálunk minden asztalnál van hely!",
          createdAt: serverTimestamp()
        },
        {
          title: "Kreatív Műhely & Zine Workshop",
          category: "Workshop",
          date: "2026-12-11",
          time: "16:30 – 19:00",
          location: "Barátság Művelődési Központ, Ifjúsági Műhely",
          capacity: 15,
          registeredCount: 0,
          published: true,
          description: "Készíts saját füzetet, kollázst vagy kitűzőt! Minden eszközt mi biztosítunk, előképzettség nem szükséges.",
          createdAt: serverTimestamp()
        },
        {
          title: "Önkéntes & IKSZ Csapatépítő",
          category: "Önkéntesség",
          date: "2026-12-18",
          time: "15:30 – 18:00",
          location: "Barátság Művelődési Központ, Szent István tér 5.",
          capacity: 30,
          registeredCount: 0,
          published: true,
          description: "Ismerd meg a SZIKE csapatát, tervezzük meg együtt a következő félév programjait, és tudj meg mindent az IKSZ órák teljesítéséről!",
          createdAt: serverTimestamp()
        }
      ];
      for (const item of samples) {
        await addDoc(collection(db, "events"), item);
      }
    }
    showToast("Kezdő adatok és mintaprogramok sikeresen feltöltve!", "success");
  } catch (err) {
    console.error(err);
    showToast("Hiba a kezdő adatok feltöltésekor (ellenőrizd a Firestore Rules-t).", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Kezdő mintadatok feltöltése";
  }
}

// ----------------------------------------------------------------------------
// 9. FIRESTORE VALÓS IDEJŰ FIGYELŐK (SZIGORÚ RULES-KOMPATIBILIS)
// ----------------------------------------------------------------------------
function startPublicListeners() {
  // 1. Oldalbeállítások, Műhelytér státusz, Színek és Logó
  onSnapshot(
    doc(db, "siteConfig", "main"),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        state.config = {
          ...DEFAULT_CONFIG,
          ...data,
          theme: { ...DEFAULT_THEME, ...(data.theme || {}) }
        };
      } else {
        state.config = { ...DEFAULT_CONFIG };
      }
      renderSiteConfig();
    },
    (err) => {
      console.error("siteConfig listener hiba:", err);
      renderSiteConfig();
    }
  );

  // 2. Csak a publikus programok (szigorú Firestore Rules-hoz illeszkedve!)
  const publicEventsQuery = query(collection(db, "events"), where("published", "==", true));
  onSnapshot(
    publicEventsQuery,
    (snap) => {
      state.publicEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPublicEvents();
    },
    (err) => {
      console.error("public events listener hiba:", err);
      $("events-loading")?.classList.add("hidden");
      $("events-empty")?.classList.remove("hidden");
    }
  );
}

function startAdminListeners() {
  stopAdminListeners();

  state.unsubAdminEvents = onSnapshot(
    collection(db, "events"),
    (snap) => {
      state.adminEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAdminEvents();
    },
    (err) => console.error("admin events hiba:", err)
  );

  state.unsubAdminRegs = onSnapshot(
    collection(db, "registrations"),
    (snap) => {
      state.registrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderRegistrations();
    },
    (err) => console.error("admin regs hiba:", err)
  );
}

function stopAdminListeners() {
  if (state.unsubAdminEvents) {
    state.unsubAdminEvents();
    state.unsubAdminEvents = null;
  }
  if (state.unsubAdminRegs) {
    state.unsubAdminRegs();
    state.unsubAdminRegs = null;
  }
}

// ----------------------------------------------------------------------------
// 10. ROUTING (#admin) ÉS AUTHENTIKÁCIÓ
// ----------------------------------------------------------------------------
function handleRoute() {
  const isAdminRoute = window.location.hash === "#admin";
  if (isAdminRoute) {
    $("public-view").classList.add("hidden");
    $("admin-view").classList.remove("hidden");
    updateAdminAuthUI();
  } else {
    $("admin-view").classList.add("hidden");
    $("public-view").classList.remove("hidden");
  }
}

function updateAdminAuthUI() {
  if (state.currentUser) {
    $("admin-login-screen").classList.add("hidden");
    $("admin-dashboard").classList.remove("hidden");
    $("admin-user-email").textContent = state.currentUser.email || "Admin";
    syncAdminConfigForms();
  } else {
    $("admin-dashboard").classList.add("hidden");
    $("admin-login-screen").classList.remove("hidden");
  }
}

function mapAuthErrorHu(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Hibás e-mail cím vagy jelszó.";
    case "auth/too-many-requests":
      return "Túl sok sikertelen próbálkozás. Próbáld újra pár perc múlva.";
    case "auth/unauthorized-domain":
      return "Ez a domain még nincs engedélyezve a Firebase Authentication → Authorized domains listában!";
    case "auth/network-request-failed":
      return "Hálózati hiba – ellenőrizd az internetkapcsolatot.";
    default:
      return `Belépési hiba (${code}).`;
  }
}

// ----------------------------------------------------------------------------
// 11. ESEMÉNYKEZELŐK INICIALIZÁLÁSA
// ----------------------------------------------------------------------------
function initUIEvents() {
  // Lábléc év
  $("footer-year").textContent = String(new Date().getFullYear());

  // Mobil menü
  $("mobile-menu-btn")?.addEventListener("click", () => {
    $("mobile-menu").classList.toggle("hidden");
  });
  document.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", () => $("mobile-menu").classList.add("hidden"));
  });
  // "Kik vagyunk?" kártyák érintéses nyitása/csukása mobilon
  document.querySelectorAll(".pillar-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      card.classList.toggle("is-expanded");
    });
  });
  // Görgetéses reveal animáció
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  // Másolás gombok
  $("copy-tax-btn")?.addEventListener("click", () => {
    copyText($("tax-number-display").textContent.trim(), "Adószám a vágólapra másolva!");
  });
  $("copy-bank-btn")?.addEventListener("click", () => {
    copyText($("bank-account-display").textContent.trim(), "Bankszámlaszám a vágólapra másolva!");
  });
  document.querySelectorAll(".copy-trigger").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.copy, "Vágólapra másolva!"));
  });

  // Kapcsolatfelvételi űrlap (mailto)
  $("contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("contact-name").value.trim();
    const email = $("contact-email").value.trim();
    const msg = $("contact-message").value.trim();
    const subject = encodeURIComponent(`Weboldal üzenet – ${name}`);
    const body = encodeURIComponent(`Név: ${name}\nE-mail: ${email}\n\nÜzenet:\n${msg}`);
    window.location.href = `mailto:ifjusagimuhely@gmail.com?subject=${subject}&body=${body}`;
    showToast("Levelezőprogram megnyitása...", "info");
  });

  // Program szűrők és kereső
  $("event-search")?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderPublicEvents();
  });
  $("event-category-filters")?.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("event-category-filters").querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeCategory = btn.dataset.category;
      renderPublicEvents();
    });
  });

  // Program részletek modal bezárás + Jelentkezés beküldés
  $("modal-close-btn")?.addEventListener("click", closeEventModal);
  $("event-modal")?.addEventListener("click", (e) => {
    if (e.target === $("event-modal")) closeEventModal();
  });

  $("reg-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const eventId = $("reg-event-id").value;
    const ev = state.publicEvents.find((x) => x.id === eventId);
    if (!ev) return;

    const btn = $("reg-submit-btn");
    btn.disabled = true;
    btn.textContent = "Beküldés...";

    try {
      await addDoc(collection(db, "registrations"), {
        eventId,
        eventTitle: ev.title,
        name: $("reg-name").value.trim(),
        email: $("reg-email").value.trim(),
        phone: $("reg-phone").value.trim(),
        note: $("reg-note").value.trim(),
        gdprAccepted: $("reg-gdpr").checked,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "events", eventId), {
        registeredCount: increment(1)
      });

      closeEventModal();
      showToast("Sikeres jelentkezés! Várunk szeretettel a programon!", "success");
    } catch (err) {
      console.error(err);
      showToast("Hiba történt a jelentkezés során. Kérlek próbáld újra!", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Jelentkezés beküldése";
    }
  });

  // Admin Login & Logout
  $("toggle-password-btn")?.addEventListener("click", () => {
    const pw = $("admin-password");
    const isPw = pw.type === "password";
    pw.type = isPw ? "text" : "password";
    $("toggle-password-btn").textContent = isPw ? "Elrejt" : "Mutat";
  });

  $("admin-login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = $("admin-login-error");
    errBox.classList.add("hidden");
    const btn = $("admin-login-btn");
    btn.disabled = true;
    btn.textContent = "Bejelentkezés...";

    try {
      await signInWithEmailAndPassword(auth, $("admin-email").value.trim(), $("admin-password").value);
      showToast("Sikeres admin belépés!", "success");
    } catch (err) {
      errBox.textContent = mapAuthErrorHu(err.code);
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Bejelentkezés az Adminba";
    }
  });

  $("admin-logout-btn")?.addEventListener("click", async () => {
    await signOut(auth);
    showToast("Kijelentkeztél az adminból.", "info");
  });

  const goHome = () => {
    window.location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  $("back-to-site-btn")?.addEventListener("click", goHome);
  $("admin-view-site-btn")?.addEventListener("click", goHome);

  // Admin fülváltó
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".admin-tab-panel").forEach((p) => p.classList.add("hidden"));
      $(`tab-${target}`)?.classList.remove("hidden");
    });
  });

  // Admin Műhelytér státusz kártyák & mentés
  document.querySelectorAll(".status-radio-card").forEach((card) => {
    card.addEventListener("click", () => {
      const val = card.dataset.statusVal;
      $("input-status-value").value = val;
      highlightStatusCards(val);
      updateAdminStatusPreview();
    });
  });

  ["input-status-message", "input-status-hours"].forEach((id) => {
    $(id)?.addEventListener("input", updateAdminStatusPreview);
  });

  $("status-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("save-status-btn");
    btn.disabled = true;
    btn.textContent = "Mentés...";
    try {
      await setDoc(
        doc(db, "siteConfig", "main"),
        {
          status: $("input-status-value").value,
          statusMessage: $("input-status-message").value.trim(),
          hours: $("input-status-hours").value.trim(),
          announcementActive: $("input-announcement-active").checked,
          announcementText: $("input-announcement-text").value.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      showToast("Műhelytér státusz elmentve és frissítve!", "success");
    } catch (err) {
      console.error(err);
      showToast("Hiba a mentéskor (ellenőrizd a Firestore Rules-t).", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Státusz és közlemény mentése";
    }
  });

  $("seed-data-btn")?.addEventListener("click", seedInitialData);

  // Admin Program CRUD modal
  $("new-event-btn")?.addEventListener("click", () => openEventEditor(null));
  $("editor-close-btn")?.addEventListener("click", closeEventEditor);
  $("event-editor-modal")?.addEventListener("click", (e) => {
    if (e.target === $("event-editor-modal")) closeEventEditor();
  });

  $("event-editor-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("save-event-btn");
    btn.disabled = true;
    btn.textContent = "Mentés...";

    const editId = $("edit-event-id").value;
    const payload = {
      title: $("edit-event-title").value.trim(),
      category: $("edit-event-category").value,
      capacity: Math.max(0, Number($("edit-event-capacity").value) || 0),
      date: $("edit-event-date").value,
      time: $("edit-event-time").value.trim(),
      location: $("edit-event-location").value.trim(),
      description: $("edit-event-description").value.trim(),
      published: $("edit-event-published").checked
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "events", editId), payload);
        showToast("Program frissítve!", "success");
      } else {
        await addDoc(collection(db, "events"), {
          ...payload,
          registeredCount: 0,
          createdAt: serverTimestamp()
        });
        showToast("Új program hozzáadva!", "success");
      }
      closeEventEditor();
    } catch (err) {
      console.error(err);
      showToast("Nem sikerült menteni a programot.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Program mentése";
    }
  });

  // Jelentkezők szűrés & CSV export
  $("reg-filter-event")?.addEventListener("change", renderRegistrations);
  $("export-csv-btn")?.addEventListener("click", exportRegistrationsCsv);

  // Támogatási adatok mentése
  $("org-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("save-org-btn");
    btn.disabled = true;
    btn.textContent = "Mentés...";
    try {
      await setDoc(
        doc(db, "siteConfig", "main"),
        {
          taxNumber: $("input-tax-number").value.trim(),
          bankAccount: $("input-bank-account").value.trim(),
          supportNote: $("input-support-note").value.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      showToast("Támogatási adatok elmentve!", "success");
    } catch (err) {
      console.error(err);
      showToast("Hiba a mentés során.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Támogatási adatok mentése";
    }
  });

  // Megerősítő modal
  $("confirm-cancel-btn")?.addEventListener("click", closeConfirmModal);
  $("confirm-ok-btn")?.addEventListener("click", async () => {
    const fn = state.pendingConfirmAction;
    closeConfirmModal();
    if (fn) await fn();
  });

  // Színválasztó & Logófeltöltő
  initThemeEditorListeners();
  initLogoUploader();

  // Önkéntes jelentkezés modal nyitása, zárása és mentése
  $("open-volunteer-modal-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openVolunteerModal();
  });
  $("vol-modal-close-btn")?.addEventListener("click", closeVolunteerModal);
  $("volunteer-modal")?.addEventListener("click", (e) => {
    if (e.target === $("volunteer-modal")) closeVolunteerModal();
  });

  $("vol-iksz")?.addEventListener("change", updateIkszFieldsVisibility);
  $("vol-school-select")?.addEventListener("change", updateIkszFieldsVisibility);

  $("volunteer-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selectedId = $("vol-event").value;
    if (!selectedId) return;

    const isIksz = Boolean($("vol-iksz")?.checked);
    let school = "";
    if (isIksz) {
      const selVal = $("vol-school-select")?.value || "";
      school = selVal === "other" ? ($("vol-school-custom")?.value.trim() || "") : selVal;
      if (!school) {
        showToast("Kérlek, add meg az iskolád nevét az IKSZ órákhoz!", "error");
        return;
      }
    }

    const ev = state.publicEvents.find((x) => x.id === selectedId);
    const eventTitle =
      selectedId === "general"
        ? "Általános önkéntesség (Ifjúsági Műhely)"
        : ev?.title || "Kiválasztott program";

    const btn = $("vol-submit-btn");
    btn.disabled = true;
    btn.textContent = "Beküldés...";

    try {
      await addDoc(collection(db, "registrations"), {
        eventId: selectedId,
        eventTitle,
        role: "volunteer",
        iksz: isIksz,
        school,
        name: $("vol-name").value.trim(),
        email: $("vol-email").value.trim(),
        phone: $("vol-phone").value.trim(),
        note: $("vol-note").value.trim(),
        gdprAccepted: $("vol-gdpr").checked,
        createdAt: serverTimestamp()
      });

      closeVolunteerModal();
      showToast("Köszönjük! Önkéntes jelentkezésed sikeresen megérkezett!", "success");
    } catch (err) {
      console.error(err);
      showToast("Hiba történt a jelentkezés során. Kérlek próbáld újra!", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Önkéntes jelentkezés beküldése";
    }
  });
  // Hash változás figyelése
  window.addEventListener("hashchange", handleRoute);
}

// ----------------------------------------------------------------------------
// 12. INDÍTÁS
// ----------------------------------------------------------------------------
initUIEvents();
applyThemeToDOM(DEFAULT_THEME);
renderLogos();
startPublicListeners();
handleRoute();

onAuthStateChanged(auth, (user) => {
  state.currentUser = user;
  if (user) {
    startAdminListeners();
  } else {
    stopAdminListeners();
    state.adminEvents = [];
    state.registrations = [];
  }
  updateAdminAuthUI();
});