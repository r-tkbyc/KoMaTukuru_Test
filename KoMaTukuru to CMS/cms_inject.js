// cms_inject.js

const STORE_PARAMS = {
  shinjuku:   { store_id: "2", store_suffix_number: "1" },
  nihonbashi: { store_id: "1", store_suffix_number: "2" },
};

function getThisPageStoreKey() {
  try {
    const u = new URL(location.href);
    if (u.origin !== "https://cmstakashimaya.com") return null;
    if (!u.pathname.startsWith("/webadmin/addon/store/article/create/")) return null;

    const sp = u.searchParams;
    const sid = sp.get("store_id");
    const suf = sp.get("store_suffix_number");

    for (const [key, v] of Object.entries(STORE_PARAMS)) {
      if (sid === v.store_id && suf === v.store_suffix_number) return key;
    }
    return null;
  } catch {
    return null;
  }
}

function setIfEmpty(selector, value) {
  const v = (value || "").trim();
  if (!v) return { touched: false, filled: false };

  const el = document.querySelector(selector);
  if (!el) return { touched: false, filled: false };

  const cur = (el.value || "").trim();
  if (cur !== "") return { touched: true, filled: false };

  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  return { touched: true, filled: true };
}

function selectFloorsIfNoneSelected(values) {
  const vals = Array.isArray(values) ? values.filter(Boolean) : [];
  if (vals.length === 0) return { touched: false, filled: false };

  const sel = document.querySelector("#article_floor");
  if (!sel) return { touched: false, filled: false };

  const already = Array.from(sel.options).some(o => o.selected);
  if (already) return { touched: true, filled: false };

  const set = new Set(vals);
  let any = false;

  for (const opt of sel.options) {
    if (set.has(opt.value)) {
      opt.selected = true;
      any = true;
    }
  }

  if (any) {
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return { touched: true, filled: true };
  }
  return { touched: true, filled: false };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "CMS_FILL") return;

  const p = msg.payload || {};
  const wantStore = p.storeKey || "shinjuku";

  const hereStore = getThisPageStoreKey();
  if (!hereStore) return;

  if (hereStore !== wantStore) return;

  const results = [];

  results.push(setIfEmpty("#manage_name_name", p.titleText));
  results.push(setIfEmpty("#title", p.titleText));

  results.push(setIfEmpty("#public_from_date", p.publicFromDate));
  results.push(setIfEmpty("#period", p.periodText));

  results.push(setIfEmpty("#article_from_date", p.articleFromDate));
  results.push(setIfEmpty("#article_to_date", p.articleToDate));
  results.push(setIfEmpty("#public_to_date", p.publicToDate));

  results.push(selectFloorsIfNoneSelected(p.floorValues));

  const filledCount = results.filter(r => r.filled).length;
  if (filledCount > 0) alert("入力完了");
});
