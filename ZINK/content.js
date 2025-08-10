// content.js
console.log("content.js yüklendi");

// === Yardımcı ===
function normWord(w) {
  return (w || "")
    .trim()
    .replace(/^[\s\.,;:!?()"'`]+|[\s\.,;:!?()"'`]+$/g, "")
    .toLowerCase();
}

// === Tooltip stilini sayfaya enjekte et ===
(function injectTooltipStyle() {
  const css = `
    .gpt-tooltip{
      position:absolute;background:#fff;color:#333;border:1px solid #ccc;
      padding:6px 10px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.15);
      z-index:999999;max-width:300px;font-size:14px;line-height:1.4;
      word-break:break-word;display:flex;align-items:center;gap:8px
    }
    .gpt-tooltip::after{
      content:"";position:absolute;width:0;height:0;border-left:6px solid transparent;
      border-right:6px solid transparent;border-top:6px solid #fff;bottom:-6px;left:12px
    }
    .gpt-btn{
      appearance:none;border:1px solid #ddd;background:#f7f7f7;border-radius:4px;
      padding:2px 6px;cursor:pointer;font-size:12px
    }
    .gpt-btn:hover{background:#eee}
    .gpt-close{
      appearance:none;border:0;background:transparent;font-size:16px;line-height:1;
      cursor:pointer;color:#666;margin-left:auto
    }
    .gpt-close:hover{color:#000}
    .gpt-spinner{
      width:14px;height:14px;border:2px solid #ddd;border-top-color:#666;border-radius:50%;
      animation:gpt-spin .9s linear infinite
    }
    @keyframes gpt-spin{to{transform:rotate(360deg)}}
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
})();

let tooltipTimeout;
let currentTip = null;

// === EN telaffuz ===
let GPT_VOICES = [];
function loadVoices() { try { GPT_VOICES = speechSynthesis.getVoices() || []; } catch {} }
if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// === Çift tıklama → çeviri ===
document.addEventListener("dblclick", async (ev) => {
  if (ev.target.closest('input, textarea, [contenteditable], [contenteditable="true"]')) return;

  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) return;

  clearExistingTooltip();
  const tip = showTooltip(`"${selectedText}" çevriliyor...`, { loading: true });
  tip.dataset.original = selectedText;

  const translated = await translate(selectedText);
  setTooltipText(tip, `${selectedText} → ${translated}`, selectedText, translated);

  // storage'i background yapacak:
  saveTranslation(selectedText, translated);
});

// === Tooltip ===
function showTooltip(text, opts = {}) {
  const sel = window.getSelection();
  const rect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;

  const tip = document.createElement("div");
  tip.className = "gpt-tooltip";
  tip.innerHTML = `
    ${opts.loading ? '<span class="gpt-spinner" aria-hidden="true"></span>' : ''}
    <span class="gpt-text"></span>
    <button class="gpt-btn gpt-speak-en" title="İngilizce telaffuz">EN 🔊</button>
    <button class="gpt-btn gpt-fav" title="Favorilere ekle">📘</button>
    <button class="gpt-close" title="Kapat">×</button>
  `;
  tip.querySelector(".gpt-text").textContent = text;
  document.body.appendChild(tip);
  if (rect) positionTooltip(tip, rect);

  tip.querySelector(".gpt-close").addEventListener("click", clearExistingTooltip);
  tip.querySelector(".gpt-speak-en").addEventListener("click", () => {
    speakEN(tip.dataset.original || "");
  });
  tip.querySelector(".gpt-fav").addEventListener("click", async () => {
    const orig = tip.dataset.original || "";
    const tr = tip.dataset.translated || extractTranslated(tip.querySelector(".gpt-text")?.textContent || "");
    await addFavorite(orig, tr);
    const btn = tip.querySelector(".gpt-fav");
    const old = btn.textContent; btn.textContent = "✓"; setTimeout(() => btn.textContent = old, 800);
  });

  document.addEventListener("keydown", (e) => e.key === "Escape" && clearExistingTooltip(), { once: true });
  document.addEventListener("click", (e) => { if (currentTip && !currentTip.contains(e.target)) clearExistingTooltip(); }, { capture: true, once: true });

  tooltipTimeout = setTimeout(clearExistingTooltip, 6000);
  currentTip = tip;
  return tip;
}
function positionTooltip(tip, rect) {
  const top  = window.scrollY + rect.top - tip.offsetHeight - 6;
  const left = window.scrollX + rect.left;
  tip.style.top  = `${Math.max(0, top)}px`;
  tip.style.left = `${Math.max(0, left)}px`;
}
function setTooltipText(tip, text, original, translated) {
  if (!tip) return;
  tip.querySelector(".gpt-text").textContent = text;
  tip.dataset.original = original || tip.dataset.original || "";
  tip.dataset.translated = translated || "";
  tip.querySelector(".gpt-spinner")?.remove();
}
function clearExistingTooltip() {
  clearTimeout(tooltipTimeout);
  currentTip?.remove();
  currentTip = null;
}
function extractTranslated(fullText) {
  const parts = fullText.split("→");
  return parts.length > 1 ? parts[1].trim() : fullText;
}

// === Çeviri (MyMemory) ===
async function translate(word) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.responseData?.translatedText || "Çeviri bulunamadı";
  } catch {
    return "Çeviri hatası!";
  }
}

// === EN telaffuz ===
function speakEN(text) {
  if (!text || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voice = GPT_VOICES.find(v => v.lang && v.lang.toLowerCase().startsWith("en-"));
    if (voice) u.voice = voice;
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
  } catch {}
}

// === Storage'i background'a yaptır ===
function saveTranslation(original, translated) {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(
      { type: "saveTranslation", payload: { original, translated } },
      () => {} // cevaba ihtiyaç yok
    );
  } catch (e) {
    console.warn("saveTranslation mesajı atılamadı:", e);
  }
}

function addFavorite(original, translated) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.runtime?.id) return resolve();
      chrome.runtime.sendMessage(
        { type: "addFavorite", payload: { original, translated } },
        () => resolve()
      );
    } catch (e) {
      console.warn("addFavorite mesajı atılamadı:", e);
      resolve();
    }
  });
}
