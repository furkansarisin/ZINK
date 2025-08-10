// popup.js

const list = document.getElementById("list");
const tabWords = document.getElementById("tab-words");
const tabFavs = document.getElementById("tab-favs");
const clearAllBtn = document.getElementById("clear-all");
const downloadTxtBtn = document.getElementById("download-txt");
const themeToggle = document.getElementById("theme-toggle");

let activeTab = "words";

/* ============== Tema ============== */
(async function initTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = theme || (prefersDark ? "dark" : "light");
  setTheme(initial);
  themeToggle.checked = initial === "dark";
})();

themeToggle?.addEventListener("change", () => {
  setTheme(themeToggle.checked ? "dark" : "light");
});

function setTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  chrome.storage.local.set({ theme: mode });
}

/* ============== Tabs ============== */
tabWords?.addEventListener("click", () => {
  activeTab = "words";
  tabWords.classList.add("active");
  tabFavs?.classList.remove("active");
  render();
});

tabFavs?.addEventListener("click", () => {
  activeTab = "favs";
  tabFavs.classList.add("active");
  tabWords?.classList.remove("active");
  render();
});

/* ======== Tümünü Temizle ========= */
clearAllBtn?.addEventListener("click", () => {
  if (!confirm("Tüm çeviri geçmişi ve favoriler silinsin mi?")) return;
  chrome.storage.local.set({ history: [], favorites: [] }, render);
});

/* ========= TXT İndir ========= */
downloadTxtBtn?.addEventListener("click", async () => {
  const items = await getDedupedWordsNewestFirst();
  if (!items.length) return alert("İndirilecek kayıt yok.");

  const lines = items
    .filter(it => (it.word || "").trim() && (it.translation || "").trim())
    .map(it => `${it.word} = ${it.translation}`);

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `translations_${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
});

/* ============ Listeleme ============ */
function render() {
  if (activeTab === "words") return renderWords();
  return renderFavs();
}

async function renderWords() {
  const items = await getDedupedWordsNewestFirst();
  renderList(items);
}

function renderFavs() {
  chrome.storage.local.get("favorites", (data) => {
    const items = (data.favorites || []).slice().reverse();
    renderList(items);
  });
}

function renderList(items) {
  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "(kayıt yok)";
    list.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = `${item.word} → ${item.translation}`;
    list.appendChild(li);
  }
}

/* ---- Tekilleştirme (en güncel çeviri) ---- */
function getDedupedWordsNewestFirst() {
  return new Promise((resolve) => {
    chrome.storage.local.get("history", (data) => {
      const items = data.history || [];
      const byWord = new Map();
      for (const it of items.slice().reverse()) {
        const key = (it.word || "").trim().toLowerCase();
        if (!key) continue;
        if (!byWord.has(key)) byWord.set(key, it);
      }
      resolve(Array.from(byWord.values()));
    });
  });
}

/* İlk açılış */
render();
