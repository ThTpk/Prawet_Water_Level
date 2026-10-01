/* หน้าเว็บ Apps Script: ภาพโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง)
   ไม่ฝังหน้าเว็บ สนน. (iframe) แล้ว: หน้าสถานีของ สนน. (และน่าจะ MapLetLeaf ด้วย) มีสคริปต์โหลด languages/th.json
   วนไม่หยุด (~7 ครั้ง/วินาที ตลอดที่เปิดหน้า วัด 1 ต.ค. 2569) ทำให้ Cloudflare บล็อก IP ผู้ชม — จึงใช้เฉพาะภาพรูปตัด (1 คำขอต่อภาพ)
   ส่วนกราฟเป็นลิงก์ให้เปิดที่เว็บ สนน. เอง */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
// km = ระยะสะสมโดยประมาณ (เส้นตรงระหว่างพิกัดสถานีของ สนน.)
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย", km: 0 },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 1.8 },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 5.1 },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ", km: 10.4 },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ", km: 12.6 },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง", km: 17.0 },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 20.7 },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 28.3 },
];

// สถานีที่แสดงเมื่อเปิดหน้า (จุดอื่นโหลดเมื่อกดปุ่มเท่านั้น)
const START_STATION_ID = 39; // ปตร.คลองประเวศฯ-ลาดกระบัง

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let currentId = START_STATION_ID;

const imgUrl = (id, t) => `${BMA}/StationDetail/CreateCrossection?id=${id}&_=${t}`;
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
        <img alt="ภาพรูปตัดและระดับน้ำ ${esc(s.name)}">
        <span class="img-msg">โหลดภาพจาก สนน. ไม่สำเร็จ — แตะเพื่อลองใหม่</span>
      </button>
      <footer class="small">
        <span class="muted">ระดับน้ำและเกณฑ์อยู่ในภาพ (ม.รทก.)</span>
        <a href="${BMA}/StationDetail?id=${s.id}" target="_blank" rel="noopener">ดูกราฟระดับน้ำย้อนหลังที่หน้า สนน. ↗</a>
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

let lastRefresh = 0;
function refresh() {
  lastRefresh = Date.now();
  // ภาพทุกจุดถือว่าเก่า: จุดที่เลือกโหลดใหม่ตอนนี้ จุดอื่นโหลดใหม่เมื่อถูกเลือก
  $$(".img-btn img").forEach((img) => { if (img.dataset.state !== "loading") delete img.dataset.state; img.dataset.tries = 0; });
  loadImg(currentId);
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
  rz = setTimeout(drawDistMap, 150);
});

$("#stnBar").addEventListener("click", (e) => {
  const b = e.target.closest(".stn-btn");
  if (b) select(Number(b.dataset.id));
});
document.addEventListener("click", (e) => {
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
