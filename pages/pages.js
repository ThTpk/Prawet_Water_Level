/* หน้าเว็บ Apps Script: ทุกอย่างโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง) */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
// km = ระยะสะสมโดยประมาณ (เส้นตรงระหว่างพิกัดสถานีของ สนน.)
// histTop = ตำแหน่งแถบหัวข้อ "ข้อมูลระดับน้ำย้อนหลัง" (px จากบนสุด) ในหน้าสถานีของ สนน.
//   ที่ความกว้าง BMA_PAGE_W โดยไม่เลื่อนหน้า (วัดจริง 1 ต.ค. 2569 — ถ้า สนน. ปรับหน้าเว็บต้องวัดใหม่)
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย", km: 0, histTop: 1610 },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 1.8, histTop: 1317 },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 5.1, histTop: 1618 },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ", km: 10.4, histTop: 1647 },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ", km: 12.6, histTop: 1317 },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง", km: 17.0, histTop: 1647 },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 20.7, histTop: 1618 },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 28.3, histTop: 1618 },
];

/* กราฟระดับน้ำย้อนหลังของ สนน. ใต้ภาพ: เปิดหน้าสถานีในกรอบที่ "สูงพอทั้งหน้า" (หน้าไม่ต้องเลื่อน)
   แล้วตัดให้เห็นเฉพาะหัวข้อ + กราฟที่ตำแหน่ง histTop จากนั้นย่อด้วย CSS ให้พอดีการ์ด
   - ไม่ใช้การเลื่อนไป anchor เพราะหน้า สนน. ปักหมุดแถบเมนูเมื่อเลื่อน ทำให้ตำแหน่งคลาดไม่แน่นอน
   - โหลดเฉพาะสถานีที่กำลังแสดง (สนน. บล็อกชั่วคราวถ้าโหลดหน้าสถานีพร้อมกันหลายหน้า) */
const BMA_PAGE_W = 1180;   // หน้า สนน. กว้างนี้: แถบเมนู 260 + เนื้อหา 920 (คอลัมน์เรียงซ้อนกัน)
const BMA_PAGE_H = 3400;   // สูงกว่าทั้งหน้าสถานี หน้าจึงไม่เลื่อนและแถบเมนูไม่ปักหมุด
const HIST_CROP_X = 322;   // แถบหัวข้อเริ่มที่ x≈340, กราฟ x≈345 → ตัดซ้ายออก
const HIST_VIEW_W = 872;   // กว้างพอดีแถบหัวข้อ + กราฟ (830px) + ขอบ
const HIST_TOP_PAD = 6;    // เผื่อขอบเหนือแถบหัวข้อ
const HIST_VIEW_H = 312;   // แถบหัวข้อ (47px) + กราฟ (250px) + ขอบ

// สถานีที่แสดงเป็นภาพแรกเมื่อเปิดหน้า
const START_STATION_ID = 39; // ปตร.คลองประเวศฯ-ลาดกระบัง

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let filter = "all";
let currentId = START_STATION_ID;

const imgUrl = (id, t) => `${BMA}/StationDetail/CreateCrossection?id=${id}&_=${t}`;
const stationUrl = (id, t) => `${BMA}/StationDetail?id=${id}&_=${t}`;

function renderCards(t) {
  $("#cards").innerHTML = STATIONS.map((s, i) => {
    const gate = s.kind !== "จุดวัดระดับน้ำ";
    return `<article class="st-card" id="st-${s.id}" data-gate="${gate ? 1 : 0}" style="--c:${gate ? "var(--gate)" : "var(--water)"}">
      <header>
        <div class="num">${i + 1}</div>
        <div class="ttl"><h3>${esc(s.name)}</h3><p class="muted small">${esc(s.kind)} · ${esc(s.district)}</p></div>
      </header>
      <button class="img-btn" data-id="${s.id}" data-cap="${esc(s.name)}" aria-label="ขยายภาพ ${esc(s.name)}">
        <img src="${imgUrl(s.id, t)}" alt="ภาพรูปตัดและระดับน้ำ ${esc(s.name)}" loading="lazy"
             onerror="this.closest('.img-btn').classList.add('img-fail')">
        <span class="img-msg">โหลดภาพจาก สนน. ไม่สำเร็จ — กดโหลดใหม่ หรือเปิดหน้าสถานี</span>
      </button>
      <div class="hist-frame" data-id="${s.id}">
        <p class="hist-msg muted small">กำลังโหลดกราฟระดับน้ำย้อนหลังจาก สนน.…</p>
      </div>
      <footer class="small">
        <span class="muted">ระดับน้ำและเกณฑ์อยู่ในภาพ (ม.รทก.)</span>
        <a href="${BMA}/StationDetail?id=${s.id}" target="_blank" rel="noopener">หน้าสถานี ↗</a>
      </footer>
    </article>`;
  }).join("");
  $("#carChips").innerHTML = STATIONS.map((s, i) =>
    `<button class="chip" role="tab" data-id="${s.id}" data-gate="${s.kind !== "จุดวัดระดับน้ำ" ? 1 : 0}"
             title="${esc(s.name)}">${i + 1}. ${esc(s.name)}</button>`).join("");
  applyFilter();
}
function applyFilter() {
  $$(".st-card, .chip").forEach((c) => (c.hidden = filter === "gate" && c.dataset.gate !== "1"));
  const vis = visibleIds();
  goTo(vis.includes(currentId) ? currentId : vis[0], false);
}

/* ---------- เลื่อนซ้าย-ขวาทีละสถานี ---------- */
const visibleIds = () => $$(".st-card:not([hidden])").map((c) => Number(c.id.slice(3)));

function goTo(id, smooth = true) {
  const card = $(`#st-${id}`), track = $("#cards");
  if (!card) return;
  currentId = id;
  track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  markCurrent();
}
function step(dir) {
  const vis = visibleIds();
  const i = vis.indexOf(currentId);
  goTo(vis[(i + dir + vis.length) % vis.length]);   // วนรอบเมื่อสุดปลาย
}
function markCurrent() {
  const vis = visibleIds();
  $$(".chip").forEach((c) => {
    const on = Number(c.dataset.id) === currentId;
    c.classList.toggle("on", on);
    c.setAttribute("aria-selected", String(on));
    if (on) {  // เลื่อนเฉพาะแถบชิป ไม่ให้ทั้งหน้ากระโดด
      const bar = $("#carChips");
      const left = c.offsetLeft - bar.offsetLeft;
      if (left < bar.scrollLeft || left + c.offsetWidth > bar.scrollLeft + bar.clientWidth)
        bar.scrollTo({ left: left - (bar.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
    }
  });
  $$(".st-card").forEach((c) => c.setAttribute("aria-hidden", String(c.id !== `st-${currentId}`)));
  $("#carPos").textContent = `${vis.indexOf(currentId) + 1} / ${vis.length}`;
  $$("#distMap .dm-stn").forEach((g) => g.classList.toggle("on", Number(g.dataset.id) === currentId));
  // โหลดกราฟย้อนหลังเฉพาะสถานีที่แสดง (หน่วงเล็กน้อย เผื่อกำลังกดเลื่อนผ่านหลายสถานี)
  clearTimeout(markCurrent.t);
  markCurrent.t = setTimeout(() => loadHist(currentId), 400);
}
// ปัดด้วยนิ้ว/ทัชแพด: อัปเดตสถานีปัจจุบันตามการ์ดที่อยู่กลางกรอบ
let scrollT;
function onTrackScroll() {
  // ระหว่างโหลดกราฟ สนน. ถ้าแถบเลื่อนขยับเองโดยผู้ใช้ไม่ได้ทำ ให้กลับไปสถานีเดิม
  if (Date.now() < guardUntil && Date.now() - lastUserInput > 800) {
    const card = $(`#st-${currentId}`), track = $("#cards");
    if (card && Math.abs(track.scrollLeft - (card.offsetLeft - track.offsetLeft)) > 2) goTo(currentId, false);
    return;
  }
  clearTimeout(scrollT);
  scrollT = setTimeout(() => {
    const track = $("#cards");
    const mid = track.scrollLeft + track.clientWidth / 2;
    const card = $$(".st-card:not([hidden])", track)
      .find((c) => c.offsetLeft - track.offsetLeft <= mid && mid < c.offsetLeft - track.offsetLeft + c.offsetWidth);
    if (card && Number(card.id.slice(3)) !== currentId) { currentId = Number(card.id.slice(3)); markCurrent(); }
  }, 80);
}

function refresh() {
  const t = Date.now();
  $("#frmProfile").submit();               // โหลดกราฟ MapLetLeaf ใหม่ใน iframe
  $$(".img-btn").forEach((b) => b.classList.remove("img-fail"));
  if (!$("#cards").children.length) renderCards(t);
  else {
    $$(".img-btn img").forEach((img) => (img.src = imgUrl(img.closest(".img-btn").dataset.id, t)));
    // กราฟย้อนหลัง: ให้สถานีอื่นโหลดใหม่เมื่อเลื่อนไปถึง ส่วนสถานีที่แสดงอยู่โหลดใหม่ทันที
    $$(".hist-frame").forEach((b) => delete b.dataset.loaded);
    loadHist(currentId, true);
  }
  const d = new Date();
  $("#lastUpdate").textContent = `โหลดเมื่อ ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} น.`;
}

/* ซ่อนแถบเมนูซ้ายของเว็บ สนน. ในกรอบ
   iframe ต่างโดเมน สั่งกดปุ่มย่อเมนูของ สนน. ไม่ได้ จึงขยาย iframe ให้กว้างขึ้นเท่าแถบเมนู
   แล้วเลื่อนไปทางซ้ายให้แถบเมนูพ้นกรอบแทน
   (ธีมของ สนน.: แถบเมนูกว้าง 260px และจะซ่อนเองเมื่อหน้าแคบกว่า 769px) */
const BMA_SIDEBAR_PX = 260;
const BMA_SMALL_BREAK_PX = 769;
let showSidebar = false;

// ใช้ได้ทั้งกรอบกราฟหลักและกรอบในหน้าต่างกราฟย้อนหลัง
function cropSidebar(wrap, f, hide, extra = 0) {
  const w = wrap.clientWidth;
  const crop = hide && w + BMA_SIDEBAR_PX >= BMA_SMALL_BREAK_PX;
  f.style.width = `${(crop ? w + BMA_SIDEBAR_PX : w) + extra}px`;
  f.style.marginLeft = crop ? `-${BMA_SIDEBAR_PX}px` : "0";
}
function fitFrame(extra = 0) {
  cropSidebar($(".frame-wrap"), $("#bmaProfile"), !showSidebar, extra);
}

/* ---------- แผนผังระยะห่างระหว่างจุดวัดตามแนวคลอง ---------- */
function drawDistMap() {
  const box = $("#distMap");
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
  markCurrent();
}
function onDistPick(e) {
  const g = e.target.closest(".dm-stn");
  if (!g || (e.type === "keydown" && e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  if ($(`#st-${g.dataset.id}`).hidden) {   // จุดนี้ถูกกรองออก → กลับไปแสดงทุกจุด
    filter = "all";
    $$("#cardFilter button").forEach((x) => x.classList.toggle("on", x.dataset.f === "all"));
    $$(".st-card, .chip").forEach((c) => (c.hidden = false));
  }
  goTo(Number(g.dataset.id));
  $("#carousel").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------- กราฟระดับน้ำย้อนหลังของ สนน. ใต้ภาพ ---------- */
function sizeHist(box) {
  const f = $("iframe", box);
  if (!f) return;
  const st = STATIONS.find((s) => s.id === Number(box.dataset.id));
  const s = box.clientWidth / HIST_VIEW_W;          // ย่อ/ขยายให้พอดีการ์ด
  const top = st.histTop - HIST_TOP_PAD;
  box.style.height = `${Math.round(HIST_VIEW_H * s)}px`;
  f.style.height = `${BMA_PAGE_H}px`;
  f.style.transform = `scale(${s}) translate(${-HIST_CROP_X}px, ${-top}px)`;
}
/* หน้าสถานีของ สนน. ในกรอบกราฟย้อนหลังมีการโฟกัส/เลื่อนบางอย่างระหว่างโหลด ซึ่งลากหน้าเราลงไปด้วย
   ระหว่างโหลด จึงคืนตำแหน่งเลื่อนเดิม ถ้าการเลื่อนนั้นไม่ได้มาจากผู้ใช้ (ล้อเมาส์/นิ้ว/คีย์/คลิก) */
let lastUserInput = 0, guardUntil = 0, guardY = 0;
["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) =>
  window.addEventListener(ev, () => { lastUserInput = Date.now(); }, { passive: true, capture: true }));
window.addEventListener("scroll", () => {
  const now = Date.now();
  if (now < guardUntil && now - lastUserInput > 800) window.scrollTo(0, guardY);
  else guardY = window.scrollY;
}, { passive: true });
function guardScroll(ms) {
  guardY = window.scrollY;
  guardUntil = Date.now() + ms;
}

function loadHist(id, force = false) {
  const box = $(`.hist-frame[data-id="${id}"]`);
  if (!box || (box.dataset.loaded && !force)) return;
  guardScroll(15000);
  box.dataset.loaded = "1";
  box.classList.remove("ready");
  $("iframe", box)?.remove();
  const f = document.createElement("iframe");
  f.title = `กราฟระดับน้ำย้อนหลังจากสำนักการระบายน้ำ`;
  f.scrolling = "no";
  f.tabIndex = -1;
  f.style.width = `${BMA_PAGE_W}px`;
  box.appendChild(f);
  sizeHist(box);
  f.onload = () => {
    // รอภาพในหน้า สนน. โหลดเสร็จ (ตำแหน่งกราฟจึงนิ่ง) แล้วขยับความกว้าง 1px ให้ Highcharts วาดใหม่
    // ซ่อนกรอบไว้จนเสร็จ ผู้ชมจึงไม่เห็นหน้า สนน. ขยับ
    setTimeout(() => { if (box.contains(f)) f.style.width = `${BMA_PAGE_W + 1}px`; }, 1200);
    setTimeout(() => {
      if (!box.contains(f)) return;
      f.style.width = `${BMA_PAGE_W}px`;
      box.classList.add("ready");
    }, 1500);
  };
  f.src = stationUrl(id, Date.now());
}
// กราฟ Highcharts ของ สนน. วัดขนาดก่อนหน้าเว็บจัดวางเสร็จเมื่ออยู่ใน iframe จึงกว้างเกินกรอบ
// ขยับความกว้าง iframe 1px หลังโหลด เพื่อให้เกิด resize ภายใน แล้วกราฟจะวาดใหม่ให้พอดี
$("#bmaProfile").addEventListener("load", () => {
  setTimeout(() => { fitFrame(1); setTimeout(() => fitFrame(0), 150); }, 600);
});
$("#btnSidebar").addEventListener("click", (e) => {
  showSidebar = !showSidebar;
  e.currentTarget.textContent = showSidebar ? "ซ่อนเมนู สนน." : "แสดงเมนู สนน.";
  e.currentTarget.setAttribute("aria-pressed", String(showSidebar));
  fitFrame();
});
// จัดขนาดใหม่เฉพาะเมื่อ "ความกว้าง" เปลี่ยน — ใน Apps Script กรอบของ Google ปรับความสูงตามเนื้อหา
// ซึ่งยิง resize ทุกครั้งที่ความสูงเปลี่ยน ถ้าวาดใหม่ทุกครั้งจะวนไม่จบ (หน้าค้าง)
let rz, lastW = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(rz);
  rz = setTimeout(() => {
    fitFrame(); drawDistMap(); $$(".hist-frame").forEach(sizeHist); goTo(currentId, false);
  }, 150);
});
fitFrame();

$("#btnRefresh").addEventListener("click", refresh);
$("#carPrev").addEventListener("click", () => step(-1));
$("#carNext").addEventListener("click", () => step(1));
$("#cards").addEventListener("scroll", onTrackScroll, { passive: true });
$("#carChips").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) goTo(Number(c.dataset.id));
});
$$("#cardFilter button").forEach((b) => b.addEventListener("click", () => {
  $$("#cardFilter button").forEach((x) => x.classList.toggle("on", x === b));
  filter = b.dataset.f; applyFilter();
}));
document.addEventListener("click", (e) => {
  const b = e.target.closest(".img-btn");
  const lb = $("#lightbox");
  if (b && !b.classList.contains("img-fail")) {
    $("img", lb).src = $("img", b).src; $("figcaption", lb).textContent = b.dataset.cap; lb.hidden = false;
  } else if (e.target.closest("#lightbox")) lb.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { $("#lightbox").hidden = true; return; }
  // ลูกศรซ้าย/ขวา เปลี่ยนสถานี (เมื่อไม่ได้เปิดภาพขยายหรือพิมพ์อยู่)
  const busy = !$("#lightbox").hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  if (!busy && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    step(e.key === "ArrowLeft" ? -1 : 1);
  }
});

$("#distMap").addEventListener("click", onDistPick);
$("#distMap").addEventListener("keydown", onDistPick);

refresh();
drawDistMap();
setInterval(refresh, 5 * 60e3);
