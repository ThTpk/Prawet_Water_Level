/* หน้าตรวจสอบระดับน้ำคลองประเวศ — ข้อมูลปัจจุบัน */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "–" : Number(v).toFixed(d));
const fmtSigned = (v) => (v === null || v === undefined ? "–" : (v > 0 ? "+" : "") + v.toFixed(2));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";

const STATUS = {
  critical: { th: "วิกฤต", c: "--crit" },
  warning: { th: "เตือนภัย", c: "--warn" },
  normal: { th: "ปกติ", c: "--normal" },
  nodata: { th: "ไม่มีข้อมูล", c: "--nodata" },
};
const statusColor = (k) => css(STATUS[k]?.c || "--nodata");

const state = { data: null, xmode: "even", filter: "all", imgStamp: Date.now() };
const STATIC = !!(window.SITE && window.SITE.static);

// เว็บ GitHub Pages ดึงภาพจาก สนน. ตรง ส่วนเซิร์ฟเวอร์ Flask ใช้ตัวกลาง /img/
const imgUrl = (id) => STATIC
  ? `${window.BMA_BASE}/StationDetail/CreateCrossection?id=${id}&_=${state.imgStamp}`
  : `/img/${id}.png?t=${state.imgStamp}`;
const dataUrl = (force) => STATIC
  ? `data.json?t=${Date.now()}`
  : "/api/prawet" + (force ? "?force=1" : "");

/* ---------- helpers ---------- */
function sideStatus(o) {
  if (!o || o.v == null) return "nodata";
  if (o.critical != null && o.v >= o.critical) return "critical";
  if (o.warning != null && o.v >= o.warning) return "warning";
  return "normal";
}
// ฝั่งตะวันตก/ตะวันออกของสถานี (ประตูระบายน้ำมีสองฝั่ง)
function sides(s) {
  const inner = { ...(s.in || {}), label: s.is_gate ? "ด้านใน" : "" };
  if (!s.is_gate) return { west: inner, east: inner };
  const outer = { ...(s.out || {}), label: "ด้านนอก" };
  return s.inner_side === "west" ? { west: inner, east: outer } : { west: outer, east: inner };
}
function kind(s) {
  if (/^ส\./.test(s.name || "")) return "สถานีสูบน้ำ";
  if (s.is_gate || /^ปตร\./.test(s.name || "")) return "ประตูระบายน้ำ";
  return "จุดวัดระดับน้ำ";
}
function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
const pill = (k, text) => `<span class="pill" style="background:${statusColor(k)}">${esc(text || STATUS[k].th)}</span>`;

/* ======================================================================
   แผนภาพระดับน้ำตามแนวคลอง (SVG)
   ====================================================================== */
function drawProfile() {
  const svg = $("#profile");
  svg.innerHTML = "";
  const S = state.data?.stations || [];
  if (!S.length) return;
  const W = svg.clientWidth, H = svg.clientHeight;

  const xv = S.map((s, i) => (state.xmode === "km" ? s.km : i));
  const x0 = Math.min(...xv), x1 = Math.max(...xv);
  const xpad = (x1 - x0) * 0.05 || 1;
  const m = { l: 52, r: 30, t: 52, b: 70 };
  const pwGuess = W - m.l - m.r;
  const gapPx = Math.min(...xv.slice(1).map((v, i) => v - xv[i])) / (x1 - x0 + 2 * xpad) * pwGuess;
  const vertical = gapPx < 140; // ชื่อยาว: เขียนแนวตั้งตามแนวสถานี
  if (vertical) {
    const probe = el("text", { class: "lbl" }, svg);
    let longest = 0;
    for (const s of S) { probe.textContent = s.name; longest = Math.max(longest, probe.getComputedTextLength()); }
    probe.remove();
    m.b = 34 + Math.ceil(longest);
  }
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const X = (v) => m.l + ((v - (x0 - xpad)) / (x1 - x0 + 2 * xpad)) * pw;

  const vals = [0];
  S.forEach((s) => {
    const sd = sides(s);
    for (const o of [sd.west, sd.east]) [o.v, o.warning, o.critical].forEach((v) => v != null && vals.push(v));
    if (s.control != null) vals.push(s.control);
  });
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  const ypad = Math.max(0.2, (y1 - y0) * 0.12);
  y0 = Math.floor((y0 - ypad) * 2) / 2; y1 = Math.ceil((y1 + ypad) * 2) / 2;
  const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * ph;

  const defs = el("defs", {}, svg);
  const lg = el("linearGradient", { id: "wg", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: "0%", "stop-color": css("--water-fill-top") }, lg);
  el("stop", { offset: "100%", "stop-color": css("--water-fill-bot") }, lg);
  const clip = el("clipPath", { id: "plotclip" }, defs);
  el("rect", { x: m.l, y: m.t, width: pw, height: ph }, clip);

  // แกนตั้ง
  const ax = el("g", { class: "axis" }, svg);
  const step = (y1 - y0) > 3 ? 0.5 : 0.25;
  for (let v = y0; v <= y1 + 1e-9; v += step) {
    el("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: Math.abs(v) < 1e-9 ? "zero" : "gridline" }, ax);
    el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, ax).textContent = v.toFixed(2);
  }
  el("text", { x: 14, y: m.t + ph / 2, transform: `rotate(-90 14 ${m.t + ph / 2})`, "text-anchor": "middle" }, ax)
    .textContent = "ระดับน้ำ (ม.รทก.)";
  if (state.xmode === "km") el("text", { x: m.l - 8, y: m.t + ph + 16, "text-anchor": "end" }, ax).textContent = "กม.";

  el("text", { x: m.l, y: 18, class: "dir" }, svg).textContent = "← แม่น้ำเจ้าพระยา (ตะวันตก)";
  el("text", { x: m.l + pw, y: 18, class: "dir", "text-anchor": "end" }, svg).textContent = "ตะวันออก (ลาดกระบัง) →";

  const G = 8;
  function series(getter) {
    const segs = []; let cur = [];
    S.forEach((s, i) => {
      const sd = sides(s), x = X(xv[i]);
      const pts = s.is_gate ? [[x - G, getter(sd.west, s)], [x + G, getter(sd.east, s)]] : [[x, getter(sd.west, s)]];
      for (const [px, v] of pts) {
        if (v == null) { if (cur.length) segs.push(cur); cur = []; }
        else cur.push([px, Y(v)]);
      }
    });
    if (cur.length) segs.push(cur);
    return segs;
  }
  const pathOf = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");

  const plot = el("g", { "clip-path": "url(#plotclip)" }, svg);
  S.forEach((s, i) => el("line", { x1: X(xv[i]), x2: X(xv[i]), y1: m.t, y2: m.t + ph, class: "stn-line" }, plot));
  series((o) => o.v).forEach((seg) => {
    if (seg.length < 2) return;
    el("path", { d: pathOf(seg) + `L${seg[seg.length - 1][0]},${m.t + ph}L${seg[0][0]},${m.t + ph}Z`, fill: "url(#wg)" }, plot);
    el("path", { d: pathOf(seg), class: "water-line" }, plot);
  });
  series((o, s) => s.control).forEach((seg) => seg.length > 1 && el("path", { d: pathOf(seg), class: "th control" }, plot));
  series((o) => o.warning).forEach((seg) => seg.length > 1 && el("path", { d: pathOf(seg), class: "th warn" }, plot));
  series((o) => o.critical).forEach((seg) => seg.length > 1 && el("path", { d: pathOf(seg), class: "th crit" }, plot));

  // ประตู
  S.forEach((s, i) => {
    if (!s.is_gate) return;
    const x = X(xv[i]);
    const g = el("g", { class: "gate" }, svg);
    el("rect", { x: x - 3, y: m.t, width: 6, height: ph, rx: 1.5 }, g);
    el("text", { x, y: m.t - 7, "text-anchor": "middle" }, g).textContent = kind(s) === "สถานีสูบน้ำ" ? "สถานีสูบน้ำ" : "ปตร.";
  });

  // จุดและค่า
  const marks = el("g", {}, svg);
  S.forEach((s, i) => {
    const x = X(xv[i]), sd = sides(s);
    const pts = s.is_gate ? [[x - G, sd.west, "end", -6], [x + G, sd.east, "start", 6]] : [[x, sd.west, "middle", 0]];
    for (const [px, o, anchor, dx] of pts) {
      if (o.v == null) {
        el("circle", { cx: px, cy: m.t + ph - 8, r: 5, fill: statusColor("nodata"), stroke: css("--panel"), "stroke-width": 2 }, marks);
        continue;
      }
      el("circle", { cx: px, cy: Y(o.v), r: s.is_gate ? 5.5 : 7, fill: statusColor(sideStatus(o)), stroke: css("--panel"), "stroke-width": 2 }, marks);
      el("text", { x: px + dx, y: Y(o.v) - 12, "text-anchor": anchor, class: "val" }, marks).textContent = fmt(o.v);
    }
  });

  // ชื่อสถานี
  const lab = el("g", {}, svg);
  S.forEach((s, i) => {
    const x = X(xv[i]), yb = m.t + ph + 16;
    el("text", { x, y: yb, "text-anchor": "middle", class: "lbl d" }, lab).textContent =
      state.xmode === "km" ? s.km.toFixed(1) : String(i + 1);
    if (vertical) {
      const tx = x + 4, ty = yb + 8;
      el("text", { x: tx, y: ty, "text-anchor": "end", class: "lbl", transform: `rotate(-90 ${tx} ${ty})` }, lab).textContent = s.name;
    } else {
      el("text", { x, y: yb + 18, "text-anchor": "middle", class: "lbl" }, lab).textContent = s.name;
      el("text", { x, y: yb + 34, "text-anchor": "middle", class: "lbl d" }, lab).textContent = s.district || "";
    }
  });

  // hover / click
  const hits = el("g", {}, svg);
  S.forEach((s, i) => {
    const xa = i === 0 ? m.l : (X(xv[i - 1]) + X(xv[i])) / 2;
    const xb = i === S.length - 1 ? m.l + pw : (X(xv[i]) + X(xv[i + 1])) / 2;
    const r = el("rect", { x: xa, y: m.t, width: xb - xa, height: ph + m.b - 20, class: "hit" }, hits);
    r.addEventListener("mousemove", (ev) => showTip(ev, s));
    r.addEventListener("mouseleave", () => ($("#tip").hidden = true));
    r.addEventListener("click", () => focusCard(s.water_id));
  });
}

function levelRows(s) {
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  let rows = "";
  if (s.is_gate) {
    rows += row("ระดับน้ำด้านใน", fmt(s.in?.v));
    rows += row("ระดับน้ำด้านนอก", fmt(s.out?.v));
    rows += row("ต่างระดับ (นอก − ใน)", s.in?.v != null && s.out?.v != null ? fmtSigned(s.out.v - s.in.v) : "–");
    rows += row("เตือนภัย / วิกฤต (ใน)", `${fmt(s.in?.warning)} / ${fmt(s.in?.critical)}`);
    rows += row("เตือนภัย / วิกฤต (นอก)", `${fmt(s.out?.warning)} / ${fmt(s.out?.critical)}`);
  } else {
    rows += row("ระดับน้ำ", fmt(s.in?.v));
    rows += row("เตือนภัย / วิกฤต", `${fmt(s.in?.warning)} / ${fmt(s.in?.critical)}`);
    rows += row("เทียบระดับวิกฤต", s.in?.v != null && s.in?.critical != null ? fmtSigned(s.in.v - s.in.critical) : "–");
  }
  rows += row("ระดับควบคุม", fmt(s.control));
  return rows;
}

function showTip(ev, s) {
  const tip = $("#tip");
  tip.innerHTML = `<b>${esc(s.name)}</b><div class="muted small">${esc(kind(s))} · ${esc(s.district || "")}</div>
    <div class="small" style="margin-top:4px">${pill(s.status)} <span class="muted">${esc(s.ts || "")}</span></div>
    <table>${levelRows(s)}</table><div class="muted small" style="margin-top:4px">คลิกเพื่อดูภาพประตู/รูปตัด</div>`;
  tip.hidden = false;
  const we = $("#profileWrap"), wrap = we.getBoundingClientRect();
  const cx = ev.clientX - wrap.left;
  let x = cx + 14, y = ev.clientY - wrap.top + 14;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (x + tw > wrap.width) x = cx - tw - 14;
  if (y + th > wrap.height) y = Math.max(0, wrap.height - th);
  tip.style.left = Math.max(0, x) + we.scrollLeft + "px"; tip.style.top = y + "px";
}

/* ======================================================================
   การ์ดภาพประตูระบายน้ำ / รูปตัด รายจุด
   ====================================================================== */
function card(s, idx) {
  const levels = s.is_gate
    ? `<div class="lv"><span>ด้านใน</span><b style="color:${statusColor(sideStatus(s.in))}">${fmt(s.in?.v)}</b></div>
       <div class="lv"><span>ด้านนอก</span><b style="color:${statusColor(sideStatus(s.out))}">${fmt(s.out?.v)}</b></div>`
    : `<div class="lv"><span>ระดับน้ำ</span><b style="color:${statusColor(sideStatus(s.in))}">${fmt(s.in?.v)}</b></div>`;
  const thr = s.is_gate
    ? `เตือนภัย ${fmt(s.in?.warning)}/${fmt(s.out?.warning)} · วิกฤต ${fmt(s.in?.critical)}/${fmt(s.out?.critical)} <span class="muted">(ใน/นอก)</span>`
    : `เตือนภัย ${fmt(s.in?.warning)} · วิกฤต ${fmt(s.in?.critical)}`;
  const img = imgUrl(s.water_id);
  const stale = s.minutes_old != null && s.minutes_old > 30;
  return `<article class="st-card" id="st-${s.water_id}" data-gate="${s.is_gate ? 1 : 0}" style="--c:${statusColor(s.status)}">
    <header>
      <div class="num">${idx ?? "•"}</div>
      <div class="ttl"><h3>${esc(s.name)}</h3><p class="muted small">${esc(kind(s))} · ${esc(s.district || "")}</p></div>
      ${pill(s.status)}
    </header>
    <button class="img-btn" data-img="${img}" data-cap="${esc(s.full_name || s.name)}" aria-label="ขยายภาพ ${esc(s.name)}">
      <img src="${img}" alt="ภาพรูปตัดและระดับน้ำ ${esc(s.name)}" loading="lazy">
    </button>
    <div class="levels">${levels}<div class="lv"><span>ควบคุม</span><b>${fmt(s.control)}</b></div></div>
    <p class="thr small">${thr} <span class="muted">ม.รทก.</span></p>
    <footer class="small">
      <span class="${stale ? "stale" : "muted"}">${stale ? "⚠ ข้อมูลไม่อัปเดต · " : ""}เวลา ${esc(s.ts || "–")}${s.bma_status ? ` · สนน.: ${esc(s.bma_status)}` : ""}</span>
      <a href="${s.url}" target="_blank" rel="noopener">หน้า สนน. ↗</a>
    </footer>
  </article>`;
}

function renderCards() {
  const S = state.data?.stations || [];
  $("#cards").innerHTML = S.map((s, i) => card(s, i + 1)).join("") ||
    `<p class="muted">ไม่มีข้อมูล</p>`;
  const E = state.data?.extra || [];
  $("#extraSection").hidden = !E.length;
  $("#extraCards").innerHTML = E.map((s) => card(s, null)).join("");
  applyFilter();
}
function applyFilter() {
  $$(".st-card", $("#cards")).forEach((c) => (c.hidden = state.filter === "gate" && c.dataset.gate !== "1"));
}
function focusCard(id) {
  if (state.filter === "gate") { state.filter = "all"; $$("#cardFilter button").forEach((b) => b.classList.toggle("on", b.dataset.f === "all")); applyFilter(); }
  const c = $("#st-" + id);
  if (!c) return;
  c.scrollIntoView({ behavior: "smooth", block: "center" });
  c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
}

function renderSummary() {
  const S = state.data?.stations || [];
  const n = (k) => S.filter((s) => s.status === k).length;
  $("#summary").innerHTML = ["critical", "warning", "normal", "nodata"]
    .filter((k) => n(k) || k !== "nodata")
    .map((k) => `<span class="sum"><i class="dot s-${k}"></i>${STATUS[k].th} <b>${n(k)}</b></span>`).join("");
}

/* ======================================================================
   โหลดข้อมูล
   ====================================================================== */
async function load(force = false) {
  const r = await fetch(dataUrl(force), { cache: "no-store" });
  if (!r.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ " + r.status);
  state.data = await r.json();
  state.imgStamp = Date.now();
  $("#loading").hidden = true;
  const errs = state.data.errors || [];
  $("#errors").hidden = !errs.length;
  $("#errors").innerHTML = errs.map((e) => `<div>⚠ ${esc(e)}</div>`).join("");
  const ts = (state.data.stations || []).map((s) => s.ts).filter(Boolean);
  $("#lastUpdate").textContent = `ข้อมูลระดับน้ำ ${ts.length ? ts.sort().slice(-1)[0] : "–"} น.`;
  if ($("#builtAt")) $("#builtAt").textContent = (state.data.fetched_at || "–") + " น.";
  renderSummary();
  drawProfile();
  renderCards();
}

$("#btnRefresh").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = "กำลังดึง…";
  try { await load(true); } catch (err) { alert(err.message); }
  finally { b.disabled = false; b.textContent = STATIC ? "โหลดใหม่" : "ดึงข้อมูลใหม่"; }
});
if (STATIC) $("#btnRefresh").textContent = "โหลดใหม่";
$$("[data-xmode]").forEach((b) => b.addEventListener("click", () => {
  $$("[data-xmode]").forEach((x) => x.classList.toggle("on", x === b));
  state.xmode = b.dataset.xmode; drawProfile();
}));
$$("#cardFilter button").forEach((b) => b.addEventListener("click", () => {
  $$("#cardFilter button").forEach((x) => x.classList.toggle("on", x === b));
  state.filter = b.dataset.f; applyFilter();
}));

// ขยายภาพ
document.addEventListener("click", (e) => {
  const b = e.target.closest(".img-btn");
  const lb = $("#lightbox");
  if (b) {
    $("img", lb).src = b.dataset.img; $("figcaption", lb).textContent = b.dataset.cap; lb.hidden = false;
  } else if (e.target.closest("#lightbox")) lb.hidden = true;
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#lightbox").hidden = true; });

let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawProfile, 120); });

load().catch((e) => { $("#lastUpdate").textContent = e.message; });
setInterval(() => load().catch(console.error), 5 * 60e3);
