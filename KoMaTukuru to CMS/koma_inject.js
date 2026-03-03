// koma_inject.js

function isKoMaTukuruPage() {
  const titleSet = document.querySelector('[data-set="title"]');
  const kaikiSet = document.querySelector('[data-set="kaiki"]');
  if (!titleSet || !kaikiSet) return false;

  const hasConvert = !!titleSet.querySelector('.btn-convert');
  const hasOutput = !!titleSet.querySelector('textarea.output');
  return hasConvert && hasOutput;
}

function getValue(selector) {
  const el = document.querySelector(selector);
  if (!el) return "";
  if ("value" in el) return (el.value || "").trim();
  return (el.textContent || "").trim();
}

function fmtDtFree(datetimeLocalValue) {
  // "2026-01-19T12:30" -> "2026/01/19 12:30"
  const v = (datetimeLocalValue || "").trim();
  if (!v) return "";
  if (v.length >= 16 && v[10] === "T") {
    const y = v.slice(0, 4);
    const mo = v.slice(5, 7);
    const d = v.slice(8, 10);
    const hh = v.slice(11, 13);
    const mm = v.slice(14, 16);
    return `${y}/${mo}/${d} ${hh}:${mm}`;
  }
  return v;
}

function getSelectedStoreKey() {
  return document.querySelector('input[name="store"]:checked')?.value || "shinjuku";
}

/** 全角数字→半角 */
function toHalfDigits(s) {
  return String(s || "").replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

function getVenueLines(venueText) {
  const s = String(venueText || "");
  if (!s.trim()) return [];
  return s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/**
 * 共通：行から「地下N階」または「N階」または「屋上」を抽出
 * 戻り: { kind: 'B'|'F'|'R', n?: number } | null
 */
function extractFloorInfoFromLine(line) {
  const s = toHalfDigits(line);

  if (s.includes("屋上")) return { kind: "R" };

  const b = s.match(/地下\s*([0-9]{1,2})\s*階/);
  if (b) return { kind: "B", n: Number(b[1]) };

  const f = s.match(/([0-9]{1,2})\s*階/);
  if (f) return { kind: "F", n: Number(f[1]) };

  return null;
}

/** 新宿（館なし）: 行から value */
function mapShinjukuFloorValue(line) {
  const info = extractFloorInfoFromLine(line);
  if (!info) return null;

  if (info.kind === "B") {
    if (info.n === 1) return "F00201B01";
    if (info.n === 2) return "F00201B02";
    return null;
  }
  if (info.kind === "F") {
    const n = info.n;
    if (n >= 1 && n <= 14) return "F00201F" + String(n).padStart(2, "0");
    return null;
  }
  return null;
}

/**
 * 日本橋: 行に必ず「本館/新館/東館」が入る前提
 */
function mapNihonbashiFloorValue(line) {
  const s = String(line || "");
  const hall =
    s.includes("本館") ? "honkan" :
    s.includes("新館") ? "shinkan" :
    s.includes("東館") ? "toukan" :
    null;
  if (!hall) return null;

  const info = extractFloorInfoFromLine(s);
  if (!info) return null;

  if (hall === "shinkan") {
    const prefix = "F00101";
    if (info.kind === "B") {
      if (info.n === 1) return prefix + "B01";
      if (info.n === 4) return prefix + "B04";
      return null;
    }
    if (info.kind === "F") {
      const n = info.n;
      if (n >= 1 && n <= 7) return prefix + "F" + String(n).padStart(2, "0");
      return null;
    }
    return null; // 新館に屋上なし
  }

  if (hall === "honkan") {
    const prefix = "F00102";
    if (info.kind === "B") {
      if (info.n === 1) return prefix + "B01";
      if (info.n === 2) return prefix + "B02";
      return null;
    }
    if (info.kind === "F") {
      const n = info.n;
      if (n >= 1 && n <= 8) return prefix + "F" + String(n).padStart(2, "0");
      return null;
    }
    if (info.kind === "R") return prefix + "R01";
    return null;
  }

  if (hall === "toukan") {
    const prefix = "F00103";
    if (info.kind === "B") {
      if (info.n === 1) return prefix + "B01";
      if (info.n === 3) return prefix + "B03";
      return null;
    }
    if (info.kind === "F") {
      const n = info.n;
      if (n >= 1 && n <= 6) return prefix + "F" + String(n).padStart(2, "0");
      return null;
    }
    if (info.kind === "R") return prefix + "R01";
    return null;
  }

  return null;
}

function uniqKeepOrder(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    if (!v) continue;
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

function buildPayload() {
  const storeKey = getSelectedStoreKey();

  const titleOutput = getValue('[data-set="title"] textarea.output');
  const dtFreeRaw = getValue('[data-set="kaiki"] .dt-free');
  const publicFrom = fmtDtFree(dtFreeRaw);

  const kaikiOutput =
    getValue('[data-set="kaiki"] textarea.output.kaiki-output') ||
    getValue('[data-set="kaiki"] textarea.output');

  const startStr = getValue('[data-set="kaiki"] textarea.date-start');
  const endStr   = getValue('[data-set="kaiki"] textarea.date-end');

  const venueOut = getValue('[data-set="venue"] textarea.output');
  const venueLines = getVenueLines(venueOut);

  let floorValues = [];
  if (storeKey === "shinjuku") {
    floorValues = uniqKeepOrder(venueLines.map(mapShinjukuFloorValue));
  } else if (storeKey === "nihonbashi") {
    floorValues = uniqKeepOrder(venueLines.map(mapNihonbashiFloorValue));
  }

  return {
    storeKey,

    titleText: titleOutput,
    publicFromDate: publicFrom,
    periodText: kaikiOutput,
    articleFromDate: startStr,
    articleToDate: endStr,
    publicToDate: endStr,

    floorValues
  };
}

function insertToCmsButton() {
  const titleSet = document.querySelector('[data-set="title"]');
  if (!titleSet) return;

  const actions = titleSet.querySelector('.set-head .actions');
  if (!actions) return;

  if (actions.querySelector('.btn-to-cms')) return;

  const convertBtn = actions.querySelector('.btn-convert');
  if (!convertBtn) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-to-cms';
  btn.textContent = 'toCMS';
  btn.title = 'CMSへ自動入力（空欄のみ）';

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    try {
      await chrome.runtime.sendMessage({ type: "KOMA_SEND_TO_CMS", payload });
    } catch {}
  });

  actions.insertBefore(btn, convertBtn);
}

function boot() {
  if (!isKoMaTukuruPage()) return;
  insertToCmsButton();

  const mo = new MutationObserver(() => {
    if (!isKoMaTukuruPage()) return;
    insertToCmsButton();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

boot();
