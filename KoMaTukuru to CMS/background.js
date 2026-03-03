// background.js (MV3 service worker)

const CMS_CREATE_URL_PATTERN =
  "https://cmstakashimaya.com/webadmin/addon/store/article/create/*";

// 店舗ごとのCMS識別（URLクエリで厳密チェック）
const STORE_PARAMS = {
  shinjuku:   { store_id: "2", store_suffix_number: "1" },
  nihonbashi: { store_id: "1", store_suffix_number: "2" },
};

function isTargetCmsUrl(urlStr, storeKey) {
  try {
    const u = new URL(urlStr);
    if (u.origin !== "https://cmstakashimaya.com") return false;
    if (!u.pathname.startsWith("/webadmin/addon/store/article/create/")) return false;

    const target = STORE_PARAMS[storeKey];
    if (!target) return false;

    const sp = u.searchParams;
    return sp.get("store_id") === target.store_id &&
           sp.get("store_suffix_number") === target.store_suffix_number;
  } catch {
    return false;
  }
}

async function findBestCmsTab(storeKey) {
  const tabs = await chrome.tabs.query({ url: CMS_CREATE_URL_PATTERN });
  const candidates = tabs.filter(t => t.url && isTargetCmsUrl(t.url, storeKey));
  if (candidates.length === 0) return null;

  // 最後に触ったタブを優先
  candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return candidates[0];
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || msg.type !== "KOMA_SEND_TO_CMS") return;

    const payload = msg.payload || {};
    const storeKey = payload.storeKey || "shinjuku"; // フォールバックは新宿

    const cmsTab = await findBestCmsTab(storeKey);
    if (!cmsTab || !cmsTab.id) {
      sendResponse({ ok: false, reason: "CMS tab not found", storeKey });
      return;
    }

    await chrome.tabs.sendMessage(cmsTab.id, {
      type: "CMS_FILL",
      payload
    });

    sendResponse({ ok: true, tabId: cmsTab.id, storeKey });
  })();

  return true;
});
