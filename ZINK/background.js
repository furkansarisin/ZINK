// background.js — storage işlemleri burada

function normWord(w) {
  return (w || "")
    .trim()
    .replace(/^[\s\.,;:!?()"'`]+|[\s\.,;:!?()"'`]+$/g, "")
    .toLowerCase();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // Asenkron cevap vereceğiz:
  if (msg.type === "saveTranslation") {
    const { original, translated } = msg.payload || {};
    chrome.storage.local.get({ history: [], favorites: [] }, (data) => {
      const history = data.history || [];
      const favorites = data.favorites || [];

      const key = normWord(original);
      let idx = history.findIndex((it) => normWord(it.word) === key);

      if (idx !== -1) {
        // zaten var
        history[idx].count = (history[idx].count || 1) + 1;
        if (translated) history[idx].translation = translated;
        history[idx].last_seen = new Date().toISOString();

        // 2. kere olunca otomatik favori
        if (history[idx].count === 2 && !history[idx].favorited) {
          const favKey = normWord(history[idx].word) + "|" + normWord(history[idx].translation);
          const exists = favorites.some(
            (f) => normWord(f.word) + "|" + normWord(f.translation) === favKey
          );
          if (!exists && history[idx].word && history[idx].translation) {
            favorites.push({
              word: history[idx].word,
              translation: history[idx].translation,
              date: new Date().toISOString()
            });
          }
          history[idx].favorited = true;
        }
      } else {
        // ilk defa
        history.push({
          word: original,
          translation: translated,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          count: 1,
          favorited: false
        });
      }

      chrome.storage.local.set({ history, favorites }, () => {
        sendResponse({ ok: true });
      });
    });
    return true; // async
  }

  if (msg.type === "addFavorite") {
    const { original, translated } = msg.payload || {};
    chrome.storage.local.get({ favorites: [] }, (data) => {
      const favorites = data.favorites || [];
      const k = normWord(original) + "|" + normWord(translated);
      const exists = favorites.some(
        (f) => normWord(f.word) + "|" + normWord(f.translation) === k
      );
      if (!exists && original && translated) {
        favorites.push({
          word: original,
          translation: translated,
          date: new Date().toISOString()
        });
      }
      chrome.storage.local.set({ favorites }, () => {
        sendResponse({ ok: true });
      });
    });
    return true; // async
  }
});
