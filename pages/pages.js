/* หน้าเว็บ Apps Script: ภาพและกราฟโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง)
   - กราฟรายจุด: ฝังหน้า GraphOnIframe ของ สนน. (หน้ากราฟล้วนที่ สนน. ใช้ใน popup แผนที่ของตัวเอง)
     โหลด languages/th.json ครั้งเดียว ไม่วนซ้ำ (วัด 1 ต.ค. 2569: 10 วินาที = 2 คำขอ)
   - ไม่ฝังหน้าสถานี/MapLetLeaf/หน้าแรก: หน้าเหล่านั้นเรียก getElementById('Nav3') ซึ่งไม่มีในหน้า → error
     → .catch โหลด th.json ใหม่ทันที วนไม่หยุด (~7 ครั้ง/วินาที) จน Cloudflare บล็อก IP ผู้ชม
     กราฟทั้งคลองจึงเป็นลิงก์ให้เปิดที่เว็บ สนน. เอง */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
// km = ระยะสะสมโดยประมาณ (เส้นตรงระหว่างพิกัดสถานีของ สนน.)
// wl = จำนวนเส้นระดับน้ำ (countwl ของหน้า GraphOnIframe = water_count จาก PageMap/GoogleMap): ประตูน้ำ/สถานีสูบ = 2
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย", km: 0, wl: 2 },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 1.8, wl: 1 },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 5.1, wl: 1 },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ", km: 10.4, wl: 2 },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ", km: 12.6, wl: 1 },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง", km: 17.0, wl: 2 },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 20.7, wl: 1 },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 28.3, wl: 1 },
];

// ลิงก์ไปเว็บ สนน. ต่อท้ายด้วย #id เปิดแล้วเลื่อนไปที่กราฟเลย (วัด 1 ต.ค. 2569)
// หน้า สนน. ปักหมุดแถบหัวเว็บ (สูง ~190–230px) เมื่อเลื่อนเกิน 30px แถบจึงบังส่วนบนของจุดที่เลื่อนไป
// → หน้าสถานีชี้ไปที่ "สถานะอุปกรณ์" (#devicestatus) ซึ่งอยู่เหนือหัวข้อกราฟย้อนหลัง ~300px กราฟจึงโผล่ใต้แถบพอดี
// → MapLetLeaf ชี้ไปที่หัวข้อ "ข้อมูลระดับน้ำ" (#waterlevelinformation) เหนือช่องเลือกคลองและกราฟ (ใน pages/index.html)
const HIST_ANCHOR = "#devicestatus";

// สถานีที่แสดงเมื่อเปิดหน้า (จุดอื่นโหลดเมื่อกดปุ่มเท่านั้น)
const START_STATION_ID = 39; // ปตร.คลองประเวศฯ-ลาดกระบัง

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let currentId = START_STATION_ID;

const imgUrl = (id, t) => `${BMA}/StationDetail/CreateCrossection?id=${id}&_=${t}`;
const graphUrl = (s, t) => `${BMA}/GraphOnIframe/Index?id=${s.id}&countwl=${s.wl}&_=${t}`;
const isGate = (s) => s.kind !== "จุดวัดระดับน้ำ";

function renderCards() {
  $("#cards").innerHTML = STATIONS.map((s, i) => {
    const gate = isGate(s);
    return `<article class="st-card" id="st-${s.id}" style="--c:${gate ? "var(--gate)" : "var(--water)"}" hidden>
      <header>
        <div class="num">${i + 1}</div>
        <div class="ttl"><h3>${esc(s.name)}</h3><p class="muted small">${esc(s.kind)} · ${esc(s.district)}</p></div>
      </header>
      <button class="img-btn" data-id="${s.id}" data-cap="${esc(s.name)}" aria-label="ขยายภาพ ${esc(s.name)}">
        <img alt="ภาพรูปตัดและระดับน้ำ ${esc(s.name)}" referrerpolicy="no-referrer">
        <span class="img-msg">โหลดภาพจาก สนน. ไม่สำเร็จ — แตะเพื่อลองใหม่</span>
      </button>
      <div class="graph-frame" data-id="${s.id}">
        <div class="graph-bar"><b>${esc(s.name)}</b><button class="btn small graph-close" aria-label="ปิดกราฟขนาดใหญ่">✕ ปิด</button></div>
        <p class="graph-msg small">กำลังโหลดกราฟระดับน้ำจาก สนน.…</p>
      </div>
      <footer class="small">
        <span class="muted">ระดับน้ำและเกณฑ์อยู่ในภาพ (ม.รทก.) · ชี้ที่กราฟเพื่อดูวันเวลา · ลากบนกราฟเพื่อซูมช่วงเวลา</span>
        <button class="btn small ghost graph-zoom" data-id="${s.id}">⤢ ขยายกราฟ</button>
        <a href="${BMA}/StationDetail?id=${s.id}${HIST_ANCHOR}" target="_blank" rel="noopener noreferrer">ดูกราฟระดับน้ำย้อนหลังที่หน้า สนน. ↗</a>
      </footer>
    </article>`;
  }).join("");
  $("#stnBar").innerHTML = STATIONS.map((s, i) =>
    `<button class="stn-btn" role="tab" data-id="${s.id}" style="--c:${isGate(s) ? "var(--gate)" : "var(--water)"}"
             title="${esc(s.name)} · ${esc(s.kind)}"><span class="n">${i + 1}</span>
       <span><b>${esc(s.name)}</b><small>${esc(s.kind)}</small></span></button>`).join("");
}

/* ---------- เลือกจุด: แสดงการ์ดของจุดนั้น แล้วโหลดภาพเฉพาะจุดนั้น ---------- */
function select(id) {
  if (!STATIONS.some((s) => s.id === id)) return;
  currentId = id;
  $$(".st-card").forEach((c) => (c.hidden = c.id !== `st-${id}`));
  $$(".stn-btn").forEach((b) => {
    const on = Number(b.dataset.id) === id;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
    if (on) {  // แถบปุ่มเลื่อนแนวนอนบนมือถือ: เลื่อนเฉพาะแถบ ไม่ให้ทั้งหน้ากระโดด
      const bar = $("#stnBar");
      const left = b.offsetLeft - bar.offsetLeft;
      if (left < bar.scrollLeft || left + b.offsetWidth > bar.scrollLeft + bar.clientWidth)
        bar.scrollTo({ left: left - (bar.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
    }
  });
  markDist();
  loadImg(id);
  loadGraph(id);
}
function step(dir) {
  const i = STATIONS.findIndex((s) => s.id === currentId);
  select(STATIONS[(i + dir + STATIONS.length) % STATIONS.length].id);   // วนรอบเมื่อสุดปลาย
}
const markDist = () =>
  $$("#distMap .dm-stn").forEach((g) => g.classList.toggle("on", Number(g.dataset.id) === currentId));

/* ---------- ภาพรูปตัด/ประตูระบายน้ำ ----------
   โหลดเฉพาะจุดที่เลือก ภาพที่โหลดแล้วไม่โหลดซ้ำจนถึงรอบรีเฟรช
   โหลดไม่สำเร็จ (สนน./Cloudflare ปฏิเสธชั่วคราว) → ลองใหม่หลัง 5 / 15 / 30 / 60 วินาที ถ้ายังเป็นจุดที่เลือกอยู่
   ครบแล้วยังไม่ได้ → แตะที่ภาพเพื่อลองใหม่ */
const RETRY_DELAYS = [5000, 15000, 30000, 60000];
const imgOf = (id) => $(`#st-${id} .img-btn img`);
function loadImg(id, force = false) {
  const img = imgOf(id);
  if (!img || (!force && img.dataset.state)) return;   // โหลดอยู่/โหลดแล้ว/รอลองใหม่
  const btn = img.closest(".img-btn");
  btn.classList.remove("img-fail");
  img.dataset.state = "loading";
  img.onload = () => { img.dataset.state = "ok"; img.dataset.tries = 0; };
  img.onerror = () => {
    const tries = Number(img.dataset.tries || 0);
    if (tries >= RETRY_DELAYS.length) {
      img.dataset.state = "fail";
      btn.classList.add("img-fail");
      return;
    }
    img.dataset.tries = tries + 1;
    img.dataset.state = "retry";
    setTimeout(() => {
      if (img.dataset.state !== "retry") return;          // รีเฟรช/แตะลองใหม่ไปแล้ว
      if (id === currentId) loadImg(id, true);
      else delete img.dataset.state;                       // ไม่ได้ดูจุดนี้แล้ว → โหลดเมื่อถูกเลือกอีกครั้ง
    }, RETRY_DELAYS[tries]);
  };
  img.src = imgUrl(id, Date.now());
}

/* ---------- กราฟระดับน้ำย้อนหลัง (หน้า GraphOnIframe ของ สนน.) ----------
   หน้ากราฟของ สนน. ล็อกความสูงไว้ 150px (+ ขอบ body 8px) กว้างเต็มกรอบ และเราแก้ข้างในกรอบไม่ได้
   → ย่อ/ขยายทั้งกรอบด้วย transform แยกแนวนอน (sx) กับแนวตั้ง (sy): ยืดแนวตั้งมากกว่าเพื่อให้แกน Y ห่างขึ้น
     (ตัวหนังสือในกราฟสูงขึ้นตาม จึงจำกัด sy/sx ไม่เกิน GRAPH_STRETCH_MAX)
   กราฟที่โหลดแล้วเก็บไว้ (ไม่ยิงซ้ำ) จนถึงรอบรีเฟรช
   ปุ่ม "ขยายกราฟ": ทำให้กรอบเดิมเต็มจอ (CSS .zoomed) แล้วขยายใหม่ — ไม่ย้าย iframe จึงไม่โหลดซ้ำ ไม่ยิง สนน. เพิ่ม
   (กราฟของ สนน. ตั้ง zoomType: 'x' ไว้แล้ว ลากเมาส์/นิ้วบนกราฟเพื่อซูมช่วงเวลาได้ทั้งแบบปกติและแบบขยาย) */
const GRAPH_PAGE_H = 166;
const GRAPH_BASE_W = 560;        // ความกว้างที่ให้หน้า สนน. วาด (จอกว้างกว่านี้ขยายทั้งกรอบแทน)
const GRAPH_H_MIN = 240;         // ความสูงกรอบกราฟปกติ (px บนจอ) ต่ำสุด / สูงสุด
const GRAPH_H_MAX = 340;
const GRAPH_STRETCH_MAX = 2;     // ยืดแนวตั้งได้ไม่เกิน 2 เท่าของแนวนอน
function loadGraph(id, force = false) {
  const box = $(`.graph-frame[data-id="${id}"]`);
  const st = STATIONS.find((s) => s.id === id);
  if (!box || !st || (!force && box.dataset.loaded)) return;
  box.dataset.loaded = "1";
  box.classList.remove("ready");
  $("iframe", box)?.remove();
  const f = document.createElement("iframe");
  f.title = `กราฟระดับน้ำย้อนหลัง ${st.name} จากสำนักการระบายน้ำ`;
  f.scrolling = "no";
  f.tabIndex = -1;
  f.referrerPolicy = "no-referrer";
  f.onload = () => box.classList.add("ready");
  box.appendChild(f);
  fitGraph(box);
  f.src = graphUrl(st, Date.now());
}
const GRAPH_ZOOM_BAR = 52;   // แถบชื่อจุด + ปุ่มปิด ตอนขยายเต็มจอ
// วางหน้ากราฟของ สนน. ในพื้นที่กว้าง W สูงไม่เกิน H: sx ตามความกว้าง, sy ยืดให้เต็มความสูง (ไม่เกิน sx × GRAPH_STRETCH_MAX)
function graphScale(W, H, maxSx) {
  const sx = Math.min(Math.max(W / GRAPH_BASE_W, 1), maxSx);
  const sy = Math.min(Math.max(H / GRAPH_PAGE_H, sx), sx * GRAPH_STRETCH_MAX);
  return { sx, sy };
}
function fitGraph(box) {
  const f = box && $("iframe", box);
  if (!f || !box.clientWidth) return;
  const zoomed = box.classList.contains("zoomed");
  const W = zoomed ? box.clientWidth - 24 : box.clientWidth;
  const H = zoomed ? box.clientHeight - GRAPH_ZOOM_BAR - 12
    : Math.min(Math.max(W * 0.38, GRAPH_H_MIN), GRAPH_H_MAX);
  const { sx, sy } = graphScale(W, H, zoomed ? Infinity : 1.6);
  f.style.width = `${W / sx}px`;
  f.style.height = `${GRAPH_PAGE_H}px`;
  f.style.transform = `scale(${sx}, ${sy})`;
  if (zoomed) {   // เต็มจอ: วางกลางแนวตั้ง
    f.style.left = "12px";
    f.style.top = `${GRAPH_ZOOM_BAR + Math.max(0, (H - GRAPH_PAGE_H * sy) / 2)}px`;
  } else {
    f.style.left = f.style.top = "0";
    box.style.height = `${Math.round(GRAPH_PAGE_H * sy)}px`;
  }
}
const zoomedGraph = () => $(".graph-frame.zoomed");
function zoomGraph(box, on) {
  if (!box) return;
  box.classList.toggle("zoomed", on);
  document.body.classList.toggle("graph-open", on);
  fitGraph(box);
  if (on) $(".graph-close", box).focus({ preventScroll: true });
}

/* ---------- ระดับน้ำตามแนวคลอง ราย 4 ชม. ย้อนหลัง 24 ชม. ----------
   ข้อมูล: collector.py (เครื่องในไทย ทุกชั่วโมง) อ่านตารางระดับน้ำย้อนหลังในหน้าสถานีของ สนน.
   แล้วส่งมาเก็บใน Apps Script → หน้านี้อ่านผ่าน google.script.run.getProfile24() (ไม่ยิง สนน.)
   { updated, latest, marks: [6 เวลา เก่า→ใหม่], values: { id: { in: [6], out?: [6] } } }
   ประตูน้ำ/สถานีสูบมี 2 ค่า (ด้านใน/ด้านนอก) วาดเป็นขั้นที่ตำแหน่งสถานี ด้านในอยู่ฝั่งตาม GATE_INNER_SIDE */
const GATE_INNER_SIDE = { 43: "east", 40: "west", 39: "west" };   // ตรงกับ config.py
// สีเส้น เก่า (ฟ้าอ่อน) → ใหม่ (น้ำเงินเข้ม) ใช้ตัวแปร CSS --p24-0..5 (โหมดมืดเลื่อนสว่างขึ้นหนึ่งระดับ ใน style.css)
const P24_COLORS = [0, 1, 2, 3, 4, 5].map((k) => `var(--p24-${k})`);
const P24_STALE_H = 3;   // ข้อมูลเก่ากว่านี้ (ชม.) แจ้งว่าเครื่องดึงข้อมูลอาจหยุดทำงาน
let p24 = null;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const parseLocal = (s) => {
  const [d, t] = s.split("T"), [y, m, dd] = d.split("-"), [h, mi] = t.split(":");
  return new Date(+y, m - 1, +dd, +h, +mi);
};
const hhmm = (dt) => `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
const dateTh = (dt) => `${dt.getDate()} ${TH_MONTHS[dt.getMonth()]}`;
const p24Color = (k, n) => P24_COLORS[k + P24_COLORS.length - n] || P24_COLORS[k];

function loadProfile24() {
  const done = (json) => {
    try { p24 = json ? (typeof json === "string" ? JSON.parse(json) : json) : null; } catch { p24 = null; }
    drawProfile24();
  };
  if (window.google?.script?.run) {
    google.script.run.withSuccessHandler(done).withFailureHandler(() => done(null)).getProfile24();
  } else {   // เปิดในเครื่อง (ไม่ใช่ Apps Script): ใช้ไฟล์ตัวอย่างข้างหน้า ถ้ามี
    fetch("profile24.sample.json").then((r) => (r.ok ? r.json() : null)).then(done, () => done(null));
  }
}

function drawProfile24() {
  const box = $("#p24"), note = $("#p24Note"), legend = $("#p24Legend");
  // ยังไม่มีแหล่งข้อมูล (ต้องมีเครื่องในไทยรัน collector.py) → ซ่อนทั้งกล่อง
  $("#p24Panel").hidden = !(p24 && p24.marks);
  if (!p24 || !p24.marks) {
    box.replaceChildren(); legend.replaceChildren();
    return;
  }
  const marks = p24.marks.map(parseLocal), n = marks.length;
  const upd = parseLocal(p24.updated);
  const ageH = (Date.now() - upd) / 36e5;
  note.innerHTML = `ระดับน้ำ (ม.รทก.) ทุก 4 ชม. ถึง ${dateTh(marks[n - 1])} ${hhmm(marks[n - 1])} น.` +
    ` · ดึงจาก สนน. เมื่อ ${dateTh(upd)} ${hhmm(upd)} น.` +
    (ageH > P24_STALE_H ? ` · <span class="stale">ข้อมูลไม่อัปเดตมา ${Math.floor(ageH)} ชม. (เครื่องดึงข้อมูลอาจปิดอยู่)</span>` : "") +
    " · ชี้/แตะจุดเพื่อดูค่า";

  // แกน X: สถานีละ 1 ช่องเท่ากัน; ประตูน้ำแยกเป็น 2 จุดชิดกัน (ด้านใน/ด้านนอก ตามฝั่ง)
  const W = box.clientWidth, narrow = W < 700;
  if (!W) return;
  const H = narrow ? 280 : 340, L = 46, R = 14, T = 14, B = narrow ? 30 : 60;
  const slot = (W - L - R) / STATIONS.length;
  const pts = [];
  STATIONS.forEach((s, i) => {
    const cx = L + slot * (i + 0.5), v = p24.values[s.id] || {};
    if (v.out) {
      const d = Math.min(14, slot * 0.18), innerWest = GATE_INNER_SIDE[s.id] !== "east";
      pts.push({ x: cx - d, id: s.id, side: innerWest ? "in" : "out" });
      pts.push({ x: cx + d, id: s.id, side: innerWest ? "out" : "in" });
    } else pts.push({ x: cx, id: s.id, side: "in" });
  });
  const val = (p, k) => p24.values[p.id]?.[p.side]?.[k] ?? null;
  const all = pts.flatMap((p) => marks.map((_, k) => val(p, k))).filter((v) => v != null);
  if (!all.length) { note.textContent = "ข้อมูลว่าง"; box.replaceChildren(); legend.replaceChildren(); return; }
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.12, 0.05);
  lo -= pad; hi += pad;
  const step = [0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => (hi - lo) / s <= 7) || 1;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": "กราฟระดับน้ำตามแนวคลองประเวศ ราย 4 ชั่วโมง ย้อนหลัง 24 ชั่วโมง" });
  for (let v = lo; v <= hi + 1e-9; v += step) {
    svgEl("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "p24-grid" }, svg);
    svgEl("text", { x: L - 6, y: Y(v) + 4, class: "p24-ytick", "text-anchor": "end" }, svg, v.toFixed(step < 0.1 ? 2 : 1));
  }
  const midY = T + (H - T - B) / 2;
  svgEl("text", { x: 12, y: midY, class: "p24-ytick", "text-anchor": "middle", transform: `rotate(-90 12 ${midY})` }, svg, "ม.รทก.");
  // แถบประตูน้ำ + เลข/ชื่อสถานี
  STATIONS.forEach((s, i) => {
    const cx = L + slot * (i + 0.5);
    if (p24.values[s.id]?.out) svgEl("rect", { x: cx - 3, y: T, width: 6, height: H - T - B, class: "p24-gate" }, svg);
    svgEl("text", { x: cx, y: H - B + 16, "text-anchor": "middle", class: "p24-num" }, svg, `${i + 1}`);
    if (!narrow) {
      const name = s.name.replace(/^ปตร\.คลองประเวศฯ-/, "ปตร.").replace(/^ค\.ประเวศฯ?-?\s?/, "");
      svgEl("text", { x: cx, y: H - B + 32 + (i % 2) * 14, "text-anchor": "middle", class: "p24-name" }, svg, name);
    }
  });
  // 6 เส้น: เก่า (อ่อน) → ใหม่ (เข้ม) วาดเส้นใหม่ทับเส้นเก่า; ค่าที่หายไปตัดเส้นเป็นช่วง
  marks.forEach((m, k) => {
    const color = p24Color(k, n), last = k === n - 1;
    const g = svgEl("g", {}, svg);
    let seg = [];
    const flush = () => {
      if (seg.length > 1) svgEl("polyline", { points: seg.join(" "), fill: "none", style: `stroke:${color}`, "stroke-width": last ? 3 : 2 }, g);
      seg = [];
    };
    pts.forEach((p) => {
      const v = val(p, k);
      if (v == null) flush(); else seg.push(`${p.x.toFixed(1)},${Y(v).toFixed(1)}`);
    });
    flush();
    pts.forEach((p) => {
      const v = val(p, k);
      if (v == null) return;
      const st = STATIONS.find((s) => s.id === p.id);
      const side = p24.values[p.id]?.out ? (p.side === "in" ? " (ด้านใน)" : " (ด้านนอก)") : "";
      const c = svgEl("circle", { cx: p.x, cy: Y(v), r: last ? 4 : 3, style: `fill:${color}` }, g);
      svgEl("title", {}, c, `${dateTh(m)} ${hhmm(m)} น. · ${st.name}${side} : ${v.toFixed(2)} ม.รทก.`);
    });
  });
  box.replaceChildren(svg);
  legend.innerHTML = marks.map((m, k) => {
    const day = k === 0 || m.getDate() !== marks[k - 1].getDate() ? `${dateTh(m)} ` : "";
    return `<span><i style="background:${p24Color(k, n)}"></i>${day}${hhmm(m)} น.</span>`;
  }).join("") + (narrow ? `<span class="muted">เลข 1–8 = ลำดับจุดตามปุ่มด้านล่าง</span>` : "");
}

/* ---------- ระดับน้ำตลอดคลองประเวศ (หน้า KlongMap ของ สนน.) ----------
   หน้าเราอ่านข้อมูล KlongMap (/Klongmap/GetDataForUpdate) เองไม่ได้ (ไม่มี CORS) และสั่งเลือกคลองในกรอบแทนผู้ใช้ไม่ได้
   → ปุ่มเปิดหน้า KlongMap เต็มจอ ผู้ใช้เลือก "คลองประเวศบุรีรมย์" เองแล้วกราฟของ สนน. ขึ้นใน popup
   KlongMap ไม่มีบั๊ก Nav3 (ตรวจ 4 ต.ค. 2569) แต่หน้าใหญ่ (~3.3 MB) และดึงข้อมูลทุกสถานี (~2 MB) ทุก 5 นาที
   จึงโหลดเมื่อกดปุ่มเท่านั้น และปิดแล้วลบกรอบทิ้ง (หยุดการดึงซ้ำ) */
// เรดาร์ฝน: หน้า RadarNongchok.aspx ของ สนน. (ภาพเรดาร์หนองจอก 965×800 ภาพเดียว ไม่มีรีเฟรชเอง ไม่มีบั๊ก Nav3
// ตรวจ 4 ต.ค. 2569) — เปิดใหม่ทุกครั้งที่กดปุ่ม จึงได้ภาพล่าสุด
const EXT_PAGES = {
  klong: {
    url: "https://weather.bangkok.go.th/KlongMap",
    title: "ระดับน้ำตลอดคลองประเวศ — แผนผังบริหารจัดการน้ำ สนน.",
    sub: "เลือก “คลองประเวศบุรีรมย์” ในช่อง “เลือกคลอง” มุมขวาบนของแผนผัง",
    wait: "กำลังโหลดแผนผังจาก สนน.… (ประมาณ 10–20 วินาที)",
    frameTitle: "แผนผังบริหารจัดการน้ำ กรุงเทพมหานคร จากสำนักการระบายน้ำ",
    hint: true,
  },
  radar: {
    url: "https://weather.bangkok.go.th/Radar/RadarNongchok.aspx",
    title: "เรดาร์ฝน สถานีหนองจอก — สนน.",
    sub: "ภาพเรดาร์ล่าสุดตอนเปิด · ปิดแล้วกดใหม่เพื่อดูภาพล่าสุด",
    wait: "กำลังโหลดภาพเรดาร์จาก สนน.…",
    frameTitle: "เรดาร์ฝน สถานีหนองจอก จากสำนักการระบายน้ำ",
    hint: false,
  },
};

function openExt(key) {
  const page = EXT_PAGES[key];
  if (!page) return;
  const ov = $("#klongOverlay"), wrap = $(".klong-frame", ov);
  $("iframe", wrap)?.remove();
  wrap.classList.remove("ready", "hint");
  $("#extTitle").textContent = page.title;
  $("#extSub").textContent = page.sub;
  $("#extWait").textContent = page.wait;
  ov.hidden = false;
  document.body.classList.add("graph-open");
  const f = document.createElement("iframe");
  f.title = page.frameTitle;
  f.referrerPolicy = "no-referrer";
  f.onload = () => {
    wrap.classList.add("ready");
    wrap.classList.toggle("hint", page.hint);
  };
  f.src = page.url;
  wrap.appendChild(f);
  $("#klongClose").focus({ preventScroll: true });
}
function closeKlongMap() {
  const ov = $("#klongOverlay");
  if (ov.hidden) return;
  $(".klong-frame iframe", ov)?.remove();
  $(".klong-frame", ov).classList.remove("hint");
  ov.hidden = true;
  document.body.classList.remove("graph-open");
}

// ผู้ใช้คลิกเข้าไปในแผนผัง (โฟกัสย้ายเข้ากรอบ) → ซ่อนป้ายบอกทาง
window.addEventListener("blur", () => {
  if (document.activeElement?.closest?.(".klong-frame")) $(".klong-frame").classList.remove("hint");
});

let lastRefresh = 0;
function refresh() {
  lastRefresh = Date.now();
  // ภาพทุกจุดถือว่าเก่า: จุดที่เลือกโหลดใหม่ตอนนี้ จุดอื่นโหลดใหม่เมื่อถูกเลือก
  $$(".img-btn img").forEach((img) => { if (img.dataset.state !== "loading") delete img.dataset.state; img.dataset.tries = 0; });
  loadImg(currentId);
  $$(".graph-frame").forEach((b) => delete b.dataset.loaded);   // จุดอื่นโหลดกราฟใหม่เมื่อถูกเลือก
  loadGraph(currentId);
  loadProfile24();
  const d = new Date();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  $("#lastUpdate").textContent = `โหลดเมื่อ ${hm} น.`;
}

/* ---------- แผนผังระยะห่างระหว่างจุดวัดตามแนวคลอง ---------- */
const svgEl = (n, a, p, txt) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (const k in a) e.setAttribute(k, a[k]);
  if (txt != null) e.textContent = txt;
  if (p) p.appendChild(e);
  return e;
};
// จอแคบ: แผนผังแนวตั้ง (บน = ตะวันตก, ล่าง = ตะวันออก) ความสูงแต่ละช่วงตามระยะจริง แต่ไม่ชิดเกินไป
function drawDistMapVertical(box) {
  const W = box.clientWidth, LX = Math.min(86, W * 0.24), T = 34, B = 40, PX_PER_KM = 16, MIN_GAP = 46;
  const ys = [T];
  STATIONS.slice(1).forEach((s, i) => ys.push(ys[i] + Math.max(MIN_GAP, (s.km - STATIONS[i].km) * PX_PER_KM)));
  const H = ys[ys.length - 1] + B;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": "แผนผังระยะห่างระหว่างจุดวัดระดับน้ำตามแนวคลองประเวศ" });
  svgEl("text", { x: LX, y: 14, class: "dm-end", "text-anchor": "middle" }, svg, "↑ ตะวันตก");
  svgEl("text", { x: LX, y: H - 8, class: "dm-end", "text-anchor": "middle" }, svg, "ตะวันออก ↓");
  svgEl("line", { x1: LX, x2: LX, y1: ys[0], y2: ys[ys.length - 1], class: "dm-canal" }, svg);
  STATIONS.slice(1).forEach((s, i) => {
    const y0 = ys[i], y1 = ys[i + 1];
    svgEl("line", { x1: LX - 22, x2: LX - 22, y1: y0, y2: y1, class: "dm-dim" }, svg);
    svgEl("text", { x: LX - 28, y: (y0 + y1) / 2 + 4, class: "dm-seg", "text-anchor": "end" }, svg,
      `${(s.km - STATIONS[i].km).toFixed(1)} กม.`);
  });
  STATIONS.forEach((s, i) => {
    const y = ys[i], gate = s.kind !== "จุดวัดระดับน้ำ";
    const g = svgEl("g", { class: "dm-stn", "data-id": s.id, tabindex: 0, role: "button",
      "aria-label": `${s.name} กม. ${s.km.toFixed(1)}` }, svg);
    svgEl("title", {}, g, `${s.name} · ${s.kind} · กม. ${s.km.toFixed(1)}`);
    svgEl("rect", { x: LX - 24, y: y - 18, width: W - LX + 24, height: 36, class: "dm-hit" }, g);
    svgEl("line", { x1: LX - 26, x2: LX - 18, y1: y, y2: y, class: "dm-tick" }, g);
    if (gate) svgEl("rect", { x: LX - 12, y: y - 4, width: 24, height: 8, rx: 1.5, class: "dm-gate" }, g);
    else svgEl("circle", { cx: LX, cy: y, r: 7, class: "dm-pt" }, g);
    svgEl("text", { x: LX + 20, y: y - 2, class: "dm-name" }, g, `${i + 1}. ${s.name}`);
    svgEl("text", { x: LX + 20, y: y + 14, class: "dm-km" }, g, `กม. ${s.km.toFixed(1)} · ${s.kind}`);
  });
  box.replaceChildren(svg);
  markDist();
}

function drawDistMap() {
  const box = $("#distMap");
  if (box.clientWidth < 860) return drawDistMapVertical(box);   // แคบกว่านี้ชื่อสถานีแนวนอนจะชนกัน
  const NS = "http://www.w3.org/2000/svg";
  const W = Math.max(box.clientWidth, 900), H = 158, L = 64, R = 64, LINE_Y = 52;
  const total = STATIONS[STATIONS.length - 1].km;
  const X = (km) => L + (km / total) * (W - L - R);
  const el = (n, a, p, txt) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    p.appendChild(e);
    return e;
  };
  // สร้างใหม่ทั้งชิ้นแล้วค่อยสลับ (ไม่ล้างกล่องก่อน) ความสูงหน้าจึงไม่กระตุก
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
    "aria-label": "แผนผังระยะห่างระหว่างจุดวัดระดับน้ำตามแนวคลองประเวศ" })) svg.setAttribute(k, v);
  el("text", { x: 4, y: LINE_Y + 4, class: "dm-end" }, svg, "ตะวันตก");
  el("text", { x: W - 4, y: LINE_Y + 4, class: "dm-end", "text-anchor": "end" }, svg, "ตะวันออก");
  el("line", { x1: X(0), x2: X(total), y1: LINE_Y, y2: LINE_Y, class: "dm-canal" }, svg);
  // ระยะระหว่างจุด
  STATIONS.slice(1).forEach((s, i) => {
    const a = STATIONS[i], xm = (X(a.km) + X(s.km)) / 2;
    el("line", { x1: X(a.km), x2: X(s.km), y1: LINE_Y - 20, y2: LINE_Y - 20, class: "dm-dim" }, svg);
    el("text", { x: xm, y: LINE_Y - 25, class: "dm-seg", "text-anchor": "middle" }, svg,
      `${(s.km - a.km).toFixed(1)} กม.`);
  });
  // สถานี (ชื่อสลับสองแถวกันชนกัน)
  STATIONS.forEach((s, i) => {
    const x = X(s.km), gate = s.kind !== "จุดวัดระดับน้ำ";
    const g = el("g", { class: "dm-stn", "data-id": s.id, tabindex: 0, role: "button",
      "aria-label": `${s.name} กม. ${s.km.toFixed(1)}` }, svg);
    el("title", {}, g, `${s.name} · ${s.kind} · กม. ${s.km.toFixed(1)}`);
    el("line", { x1: x, x2: x, y1: LINE_Y - 20, y2: LINE_Y - 14, class: "dm-tick" }, g);
    if (gate) el("rect", { x: x - 4, y: LINE_Y - 12, width: 8, height: 24, rx: 1.5, class: "dm-gate" }, g);
    else el("circle", { cx: x, cy: LINE_Y, r: 7, class: "dm-pt" }, g);
    const ly = LINE_Y + (i % 2 ? 76 : 34);                 // ชื่อ + กม. สองบรรทัด สลับแถวบน/ล่าง
    // ป้ายชื่อจุดแรก/จุดสุดท้ายชิดเข้าด้านใน ไม่ให้ล้นขอบ
    const anchor = i === 0 ? "start" : i === STATIONS.length - 1 ? "end" : "middle";
    const tx = i === 0 ? x - 8 : i === STATIONS.length - 1 ? x + 8 : x;
    if (i % 2) el("line", { x1: x, x2: x, y1: LINE_Y + 14, y2: ly - 14, class: "dm-lead" }, g);
    el("text", { x: tx, y: ly, "text-anchor": anchor, class: "dm-name" }, g, `${i + 1}. ${s.name}`);
    el("text", { x: tx, y: ly + 17, "text-anchor": anchor, class: "dm-km" }, g, `กม. ${s.km.toFixed(1)}`);
  });
  box.replaceChildren(svg);
  markDist();
}
function onDistPick(e) {
  const g = e.target.closest(".dm-stn");
  if (!g || (e.type === "keydown" && e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  select(Number(g.dataset.id));
  $("#stations").scrollIntoView({ behavior: "smooth", block: "start" });
}

// วาดแผนผังใหม่เฉพาะเมื่อ "ความกว้าง" เปลี่ยน — ใน Apps Script กรอบของ Google ปรับความสูงตามเนื้อหา
// ซึ่งยิง resize ทุกครั้งที่ความสูงเปลี่ยน ถ้าวาดใหม่ทุกครั้งจะวนไม่จบ (หน้าค้าง)
let rz, lastW = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(rz);
  rz = setTimeout(() => { drawDistMap(); drawProfile24(); fitGraph(zoomedGraph() || $(`.graph-frame[data-id="${currentId}"]`)); }, 150);
});

$$("[data-ext]").forEach((b) => b.addEventListener("click", () => openExt(b.dataset.ext)));
$("#klongClose").addEventListener("click", closeKlongMap);
$("#stnBar").addEventListener("click", (e) => {
  const b = e.target.closest(".stn-btn");
  if (b) select(Number(b.dataset.id));
});
document.addEventListener("click", (e) => {
  const z = e.target.closest(".graph-zoom");
  if (z) { zoomGraph($(`.graph-frame[data-id="${z.dataset.id}"]`), true); return; }
  // ปุ่มปิด หรือคลิกพื้นหลังรอบกราฟ (ตัวกราฟอยู่ใน iframe คลิกในกราฟไม่มาถึงตรงนี้)
  const zb = zoomedGraph();
  if (zb && (e.target.closest(".graph-close") || e.target === zb)) { zoomGraph(zb, false); return; }
  const b = e.target.closest(".img-btn");
  const lb = $("#lightbox");
  if (b && b.classList.contains("img-fail")) {      // แตะภาพที่โหลดไม่สำเร็จ = ลองใหม่ทันที
    $("img", b).dataset.tries = 0;
    loadImg(Number(b.dataset.id), true);
    return;
  }
  if (b && $("img", b).dataset.state === "ok") {
    $("img", lb).src = $("img", b).src; $("figcaption", lb).textContent = b.dataset.cap; lb.hidden = false;
  } else if (e.target.closest("#lightbox")) lb.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { $("#lightbox").hidden = true; zoomGraph(zoomedGraph(), false); closeKlongMap(); return; }
  if (!$("#klongOverlay").hidden) return;
  if (zoomedGraph()) return;   // เปิดกราฟเต็มจออยู่ ไม่เปลี่ยนสถานีด้วยลูกศร
  // ลูกศรซ้าย/ขวา เปลี่ยนสถานี (เมื่อไม่ได้เปิดภาพขยายหรือพิมพ์อยู่)
  const busy = !$("#lightbox").hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  if (!busy && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    step(e.key === "ArrowLeft" ? -1 : 1);
  }
});

$("#distMap").addEventListener("click", onDistPick);
$("#distMap").addEventListener("keydown", onDistPick);

renderCards();
drawDistMap();
select(currentId);
refresh();
// รีเฟรชทุก 5 นาทีเฉพาะตอนเปิดดูหน้าอยู่ (แท็บที่ซ่อนไว้ไม่ยิง สนน.) กลับมาดูแล้วค่อยโหลดใหม่
const REFRESH_MS = 5 * 60e3;
setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastRefresh > REFRESH_MS) refresh();
});
