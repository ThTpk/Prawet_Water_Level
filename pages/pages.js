/* หน้าเว็บ Apps Script: ทุกอย่างโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง) */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
// km = ระยะสะสมโดยประมาณ (เส้นตรงระหว่างพิกัดสถานีของ สนน.)
// histTop / histTopM = ตำแหน่งแถบหัวข้อ "ข้อมูลระดับน้ำย้อนหลัง" (px จากบนสุด) ในหน้าสถานีของ สนน.
//   แบบจอใหญ่ (กว้าง 1180) / แบบมือถือ (กว้าง 440) โดยไม่เลื่อนหน้า
//   (วัดจริง 1 ต.ค. 2569 — ถ้า สนน. ปรับหน้าเว็บต้องวัดใหม่)
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย", km: 0, histTop: 1610, histTopM: 1340 },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 1.8, histTop: 1317, histTopM: 1027 },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", km: 5.1, histTop: 1618, histTopM: 1346 },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ", km: 10.4, histTop: 1647, histTopM: 1358 },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ", km: 12.6, histTop: 1317, histTopM: 1027 },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง", km: 17.0, histTop: 1647, histTopM: 1358 },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 20.7, histTop: 1618, histTopM: 1346 },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง", km: 28.3, histTop: 1618, histTopM: 1346 },
];

/* กราฟระดับน้ำย้อนหลังของ สนน. ใต้ภาพ: เปิดหน้าสถานีในกรอบที่ "สูงพอทั้งหน้า" (หน้าไม่ต้องเลื่อน)
   แล้วตัดให้เห็นเฉพาะหัวข้อ + กราฟที่ตำแหน่ง histTop จากนั้นย่อด้วย CSS ให้พอดีการ์ด
   - ไม่ใช้การเลื่อนไป anchor เพราะหน้า สนน. ปักหมุดแถบเมนูเมื่อเลื่อน ทำให้ตำแหน่งคลาดไม่แน่นอน
   - โหลดเฉพาะสถานีที่กำลังแสดง (สนน. บล็อกชั่วคราวถ้าโหลดหน้าสถานีพร้อมกันหลายหน้า) */
// สองแบบตามความกว้างการ์ด: จอใหญ่ใช้หน้า สนน. แบบเดสก์ท็อป, มือถือใช้หน้า สนน. แบบมือถือ
// (กราฟแคบแต่ตัวหนังสือขนาดปกติ — ถ้าย่อแบบเดสก์ท็อปลงจอมือถือจะอ่านไม่ออก)
const HIST_LAYOUTS = {
  // หน้า สนน. กว้าง 1180: แถบเมนู 260 + เนื้อหา 920; แถบหัวข้อ x≈340, กราฟ x≈345 กว้าง 830 สูง 250
  desktop: { pageW: 1180, cropX: 300, viewW: 900, viewH: 312, topKey: "histTop" },
  // หน้า สนน. กว้าง 440 (ซ่อนแถบเมนูเอง): แถบหัวข้อ x≈80 กว้าง 360, กราฟ x≈85 กว้าง 350 อยู่ใต้หัวข้อ 79px
  mobile: { pageW: 440, cropX: 45, viewW: 405, viewH: 346, topKey: "histTopM" },
};
const HIST_MOBILE_BELOW = 620;  // การ์ดแคบกว่านี้ใช้แบบมือถือ
const BMA_PAGE_H = 3400;        // สูงกว่าทั้งหน้าสถานี หน้าจึงไม่เลื่อนและแถบเมนูไม่ปักหมุด
const HIST_TOP_PAD = 6;         // เผื่อขอบเหนือแถบหัวข้อ
const histMode = (box) => (box.clientWidth < HIST_MOBILE_BELOW ? "mobile" : "desktop");

// สถานีที่แสดงเมื่อเปิดหน้า (จุดอื่นโหลดเมื่อกดปุ่มเท่านั้น)
const START_STATION_ID = 39; // ปตร.คลองประเวศฯ-ลาดกระบัง

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let currentId = START_STATION_ID;
let profileOn = false;   // กดแสดงแผนภาพทั้งคลองแล้ว

const imgUrl = (id, t) => `${BMA}/StationDetail/CreateCrossection?id=${id}&_=${t}`;
const stationUrl = (id, t) => `${BMA}/StationDetail?id=${id}&_=${t}`;
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
      <div class="hist-frame" data-id="${s.id}">
        <p class="hist-msg muted small">กำลังโหลดกราฟระดับน้ำย้อนหลังจาก สนน.…</p>
      </div>
      <footer class="small">
        <span class="muted">ระดับน้ำและเกณฑ์อยู่ในภาพ (ม.รทก.)</span>
        <a href="${BMA}/StationDetail?id=${s.id}" target="_blank" rel="noopener">หน้าสถานี ↗</a>
      </footer>
    </article>`;
  }).join("");
  $("#stnBar").innerHTML = STATIONS.map((s, i) =>
    `<button class="stn-btn" role="tab" data-id="${s.id}" style="--c:${isGate(s) ? "var(--gate)" : "var(--water)"}"
             title="${esc(s.name)} · ${esc(s.kind)}"><span class="n">${i + 1}</span>
       <span><b>${esc(s.name)}</b><small>${esc(s.kind)}</small></span></button>`).join("");
}

/* ---------- เลือกจุด: แสดงการ์ดของจุดนั้น แล้วโหลดภาพ + กราฟเฉพาะจุดนั้น ---------- */
function select(id) {
  if (!STATIONS.some((s) => s.id === id)) return;
  currentId = id;
  // ทิ้งรายการในคิวของจุดอื่นที่ยังไม่เริ่ม (ไม่ยิง สนน. เพิ่มโดยไม่จำเป็น)
  queue.splice(0, queue.length, ...queue.filter((t) => wanted(t.key)));
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
  sizeHist($(`.hist-frame[data-id="${id}"]`));   // การ์ดเพิ่งแสดง → จัดขนาดกราฟที่เคยโหลดไว้
  queueStation(id);
}
function step(dir) {
  const i = STATIONS.findIndex((s) => s.id === currentId);
  select(STATIONS[(i + dir + STATIONS.length) % STATIONS.length].id);   // วนรอบเมื่อสุดปลาย
}
const markDist = () =>
  $$("#distMap .dm-stn").forEach((g) => g.classList.toggle("on", Number(g.dataset.id) === currentId));

/* ---------- คิวโหลดจากเว็บ สนน. (ทีละรายการ) ----------
   โหลดเฉพาะจุดที่เลือก (ภาพ → กราฟย้อนหลัง) และกราฟทั้งคลองเมื่อกดแสดงเท่านั้น
   เว็บ สนน. (อยู่หลัง Cloudflare) บล็อกเมื่อเรียกถี่/พร้อมกันมาก จึงโหลดทีละรายการ และลองใหม่แบบเว้นระยะ:
   - หน้า 403 เล็กมาก โหลดเสร็จเร็วผิดปกติ (หน้าจริงใช้หลายวินาที) → ถือว่าถูกปฏิเสธ
   - รายการที่ถูกปฏิเสธ นำกลับเข้าคิวอีกครั้งหลัง 5 / 15 / 30 / 60 วินาที (ถ้ายังเป็นจุดที่เลือกอยู่)
   - ภาพที่ยังไม่สำเร็จ แตะที่ภาพเพื่อลองใหม่ทันที */
const FAST_FAIL_MS = 2000;
const RETRY_DELAYS = [5000, 15000, 30000, 60000];
const MAX_PARALLEL = 1;
const TASK_TIMEOUT = 40000;
const queue = [];
const running = new Set();   // key ของรายการที่กำลังโหลด
// โหลดเฉพาะของจุดที่เลือกอยู่ และกราฟทั้งคลอง (ถ้ากดแสดงแล้ว)
const wanted = (key) => (key === "profile" ? profileOn : key === `img${currentId}` || key === `hist${currentId}`);

// key ซ้ำในคิว/กำลังโหลด = ไม่เพิ่มซ้ำ; front = ขึ้นหน้าคิว (ถ้ามีอยู่แล้วก็ย้ายขึ้นหน้า)
function enqueue(key, run, front = false) {
  if (!wanted(key) || running.has(key)) return;
  const i = queue.findIndex((t) => t.key === key);
  if (i >= 0) { if (!front) return; queue.splice(i, 1); }
  const task = { key, run };
  if (front) queue.unshift(task); else queue.push(task);
  pump();
}
function pump() {
  while (queue.length && running.size < MAX_PARALLEL) {
    const task = queue.shift();
    running.add(task.key);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      running.delete(task.key);
      pump();
    };
    const timer = setTimeout(done, TASK_TIMEOUT);
    try { task.run(done); } catch (err) { console.error(err); done(); }
  }
}
function retryLater(key, run, tries) {
  setTimeout(() => enqueue(key, run, true), RETRY_DELAYS[Math.min(tries, RETRY_DELAYS.length - 1)]);
}

// กราฟหลัก (MapLetLeaf)
const profileState = { start: 0, tries: 0, done: null, expecting: false };
function profileTask(done) {
  profileState.start = Date.now();
  profileState.done = done;
  profileState.expecting = true;
  guardScroll(15000);                     // หน้า สนน. ในกรอบอาจลากหน้าเราเลื่อนระหว่างโหลด
  $("#frmProfile").submit();               // โหลดกราฟ MapLetLeaf ใหม่ใน iframe
}
function showProfile() {
  profileOn = true;
  $("#profileLoad").hidden = true;
  $(".frame-wrap").hidden = false;
  fitFrame();
  profileState.tries = 0;
  enqueue("profile", profileTask, true);
}

// ภาพรูปตัด/ประตูระบายน้ำ
function imgTask(img) {
  return (done) => {
    if (img.dataset.state === "ok" || img.dataset.state === "loading") return done();   // ลองใหม่ซ้อน/โหลดแล้ว
    const btn = img.closest(".img-btn");
    img.dataset.state = "loading";
    img.onload = () => { img.dataset.state = "ok"; img.dataset.tries = 0; done(); };
    img.onerror = () => {
      const tries = Number(img.dataset.tries || 0);
      if (tries < RETRY_DELAYS.length) {
        img.dataset.tries = tries + 1;
        img.dataset.state = "retry";
        retryLater(`img${btn.dataset.id}`, imgTask(img), tries);
      } else {
        img.dataset.state = "fail";
        btn.classList.add("img-fail");
      }
      done();
    };
    img.src = imgUrl(btn.dataset.id, Date.now());
  };
}
// กราฟย้อนหลัง: ข้ามถ้าโหลดไปแล้ว (เช่น ลองใหม่ที่ค้างอยู่ หลังผู้ใช้กดกลับมาที่จุดนี้)
const histTask = (id) => (done) => ($(`.hist-frame[data-id="${id}"]`)?.dataset.loaded ? done() : loadHist(id, done));
// ภาพ → กราฟย้อนหลัง ของจุดที่เลือก (ส่วนที่โหลดไว้แล้วไม่โหลดซ้ำ จนถึงรอบรีเฟรช)
function queueStation(id) {
  const img = $(`#st-${id} .img-btn img`);
  const box = $(`.hist-frame[data-id="${id}"]`);
  if (img && (!img.dataset.state || img.dataset.state === "retry")) enqueue(`img${id}`, imgTask(img));
  if (box && !box.dataset.loaded) enqueue(`hist${id}`, histTask(id));
}

let lastRefresh = 0;
function refresh() {
  lastRefresh = Date.now();
  // เริ่มคิวใหม่ (รายการที่กำลังโหลดอยู่ปล่อยให้เสร็จ) จุดอื่นจะโหลดใหม่เมื่อถูกเลือก
  queue.length = 0;
  $$(".img-btn").forEach((b) => b.classList.remove("img-fail"));
  $$(".img-btn img").forEach((img) => { if (img.dataset.state !== "loading") delete img.dataset.state; img.dataset.tries = 0; });
  $$(".hist-frame").forEach((b) => { delete b.dataset.loaded; b.dataset.tries = 0; });
  if (profileOn) { profileState.tries = 0; enqueue("profile", profileTask); }
  queueStation(currentId);
  const d = new Date();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  $("#lastUpdate").textContent = `โหลดเมื่อ ${hm} น.`;
}

/* กราฟระดับน้ำคลองประเวศ (หน้า MapLetLeaf ของ สนน.) แบบล็อกไว้ ไม่มีแถบเลื่อน
   เปิดหน้า สนน. ที่ความกว้างคงที่ในกรอบที่สูงพอทั้งหน้า (หน้าไม่ต้องเลื่อน แถบเมนูไม่ปักหมุด)
   แล้วตัดเฉพาะช่องเลือกคลอง + กราฟ ย่อด้วย CSS ให้พอดีกล่อง
   ตำแหน่งวัดจริงที่ความกว้าง 1460px (1 ต.ค. 2569): ช่องเลือกคลอง y≈1017, กราฟ x=345 y=1111 ขนาด 1110×600
   — ถ้า สนน. ปรับหน้าเว็บ ต้องวัดใหม่ */
// สนน. ดู User-Agent (detectmob ในหน้า MapLetLeaf): มือถือ/ไอแพด → กราฟแบบมือถือ
// (แสดงทีละ 3 สถานี มีแถบเลื่อนในกราฟของ สนน. เอง) คอมพิวเตอร์ → กราฟเต็มทุกสถานี
// หน้าเรา "ไม่ย่อ/ไม่เพิ่มแถบเลื่อน" แค่ตัดเฉพาะกราฟให้พอดีกล่องตามแบบที่ สนน. วาด
const BMA_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);
const PROFILE = BMA_MOBILE
  // กว้าง 700px (1 ต.ค. 2569): กราฟ x=45 y=1250 ขนาด 610×600 → เผื่อขอบ 10px
  // stretchY: กราฟแบบมือถือย่อแล้วเตี้ย จึงยืดความสูงเพิ่ม 20%
  ? { pageW: 700, pageH: 3200, cropX: 35, cropY: 1240, viewW: 630, viewH: 620, stretchY: 1.2 }
  // กว้าง 1460px: กราฟ x≈305–1415 (บางครั้ง 345–1455 ก่อนหน้า สนน. จัดวางใหม่) → เผื่อขอบทั้งสองแบบ
  : { pageW: 1460, pageH: 4600, cropX: 280, cropY: 1009, viewW: 1190, viewH: 712, stretchY: 1 };
// ย่อ/ขยายให้กราฟพอดีความกว้างกล่อง (ไม่มีแถบเลื่อนของหน้าเรา)
function fitFrame() {
  const wrap = $(".frame-wrap"), clip = $(".frame-clip"), f = $("#bmaProfile");
  const s = wrap.clientWidth / PROFILE.viewW, sy = s * PROFILE.stretchY;
  wrap.style.height = `${Math.round(PROFILE.viewH * sy)}px`;
  // หน้าต่างตัดขนาดเท่าส่วนกราฟ → ส่วนอื่นของหน้า สนน. ไม่โผล่
  clip.style.width = `${PROFILE.viewW * s}px`;
  clip.style.height = `${PROFILE.viewH * sy}px`;
  f.style.width = `${PROFILE.pageW}px`;
  f.style.height = `${PROFILE.pageH}px`;
  f.style.transform = `scale(${s}, ${sy}) translate(${-PROFILE.cropX}px, ${-PROFILE.cropY}px)`;
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

/* ---------- กราฟระดับน้ำย้อนหลังของ สนน. ใต้ภาพ ---------- */
function sizeHist(box) {
  const f = box && $("iframe", box);
  if (!f || !box.clientWidth) return;   // การ์ดที่ซ่อนอยู่ จัดขนาดตอนถูกเลือก
  // ความกว้างการ์ดข้ามเกณฑ์มือถือ/จอใหญ่ → ต้องโหลดหน้า สนน. แบบใหม่
  if (box.dataset.mode && box.dataset.mode !== histMode(box)) {
    delete box.dataset.loaded;
    if (Number(box.dataset.id) === currentId) queueStation(currentId);
    return;
  }
  const L = HIST_LAYOUTS[box.dataset.mode || histMode(box)];
  const st = STATIONS.find((s) => s.id === Number(box.dataset.id));
  const s = box.clientWidth / L.viewW;               // ย่อ/ขยายให้พอดีการ์ด
  const top = st[L.topKey] - HIST_TOP_PAD;
  box.style.height = `${Math.round(L.viewH * s)}px`;
  f.style.height = `${BMA_PAGE_H}px`;
  f.style.transform = `scale(${s}) translate(${-L.cropX}px, ${-top}px)`;
}
/* หน้า สนน. ในกรอบ (โดยเฉพาะหน้าสถานี) ดึงโฟกัสเข้าไปในตัวเองหลังโหลด เบราว์เซอร์จึงเลื่อนหน้าเรา
   ไปหากรอบนั้น → ถ้ากรอบดึงโฟกัส/หน้าเลื่อนเองโดยผู้ใช้ไม่ได้ทำ (ล้อเมาส์/นิ้ว/คีย์/คลิก)
   ให้ดึงโฟกัสกลับและคืนตำแหน่งเลื่อนเดิม */
let lastUserInput = 0, guardUntil = 0, stealAt = 0, stableY = 0;
const userActive = () => Date.now() - lastUserInput < 800;
["wheel", "touchstart", "keydown", "mousedown", "pointerdown"].forEach((ev) =>
  window.addEventListener(ev, () => { lastUserInput = Date.now(); }, { passive: true, capture: true }));
const autoScrollBlocked = () => !userActive() && (Date.now() < guardUntil || Date.now() - stealAt < 2000);
window.addEventListener("scroll", () => {
  if (autoScrollBlocked()) window.scrollTo(0, stableY);
  else stableY = window.scrollY;
}, { passive: true });
// เมาส์อยู่บน "กรอบเดียวกับที่ได้โฟกัส" = ผู้ใช้กำลังใช้กราฟ/ช่องเลือกในกรอบนั้น ไม่ดึงโฟกัสกลับ
// (ถ้าเมาส์ค้างอยู่บนกรอบอื่น เช่น กราฟหลัก แล้วกรอบกราฟย้อนหลังแย่งโฟกัส ยังต้องดึงกลับ)
// ต้องวางเมาส์บนกรอบนั้นมาแล้วอย่างน้อย 1 วินาที — ถ้าหน้าเพิ่งเลื่อนจนกรอบมาอยู่ใต้เมาส์เองไม่นับ
let hoveredFrame = null, hoverSince = 0;
document.addEventListener("pointerover", (e) => {
  const f = e.target.tagName === "IFRAME" ? e.target : null;
  if (f !== hoveredFrame) { hoveredFrame = f; hoverSince = Date.now(); }
}, true);
document.addEventListener("pointerout", (e) => { if (e.target === hoveredFrame) hoveredFrame = null; }, true);
function reclaimFocus() {
  // เบราว์เซอร์อาจเลื่อนหน้า "หลัง" จากที่ดึงโฟกัสกลับแล้ว → 2 วินาทีหลังถูกแย่งโฟกัส คอยคืนตำแหน่งเลื่อน
  if (Date.now() - stealAt < 2000 && !userActive() && Math.abs(window.scrollY - stableY) > 2) {
    window.scrollTo(0, stableY);
  }
  // โฟกัสย้ายเข้าไปในกรอบ สนน. เอง (ผู้ใช้ไม่ได้คลิกกรอบ) → ดึงกลับ และคืนตำแหน่งเลื่อน
  const a = document.activeElement;
  const usingFrame = a === hoveredFrame && Date.now() - hoverSince > 1000 && Math.abs(window.scrollY - stableY) < 3;
  if (a?.tagName !== "IFRAME" || usingFrame || userActive()) return;
  stealAt = Date.now();
  $("#focusSink").focus({ preventScroll: true });
  if (Math.abs(window.scrollY - stableY) > 2) window.scrollTo(0, stableY);
}
window.addEventListener("blur", reclaimFocus);
setInterval(reclaimFocus, 150);   // สำรอง เผื่อเบราว์เซอร์ไม่ยิง blur (เช็กถี่ หน้าจะได้ไม่กระตุกนาน)
function guardScroll(ms) {
  stableY = window.scrollY;
  guardUntil = Date.now() + ms;
}

// โหลดกราฟย้อนหลังของสถานี (เรียกจากคิวเท่านั้น; done = แจ้งคิวว่าเสร็จ)
function loadHist(id, done = () => {}) {
  const box = $(`.hist-frame[data-id="${id}"]`);
  if (!box) return done();
  guardScroll(15000);
  box.dataset.loaded = "1";
  box.dataset.mode = histMode(box);
  const pageW = HIST_LAYOUTS[box.dataset.mode].pageW;
  box.classList.remove("ready");
  $("iframe", box)?.remove();
  const f = document.createElement("iframe");
  f.title = `กราฟระดับน้ำย้อนหลังจากสำนักการระบายน้ำ`;
  f.scrolling = "no";
  f.tabIndex = -1;
  f.style.width = `${pageW}px`;
  box.appendChild(f);
  sizeHist(box);
  const started = Date.now();
  f.onload = () => {
    // เสร็จเร็วผิดปกติ = ได้หน้า 403 ของ สนน. → กลับเข้าคิวอีกครั้งภายหลัง (สูงสุด 4 ครั้ง)
    const tries = Number(box.dataset.tries || 0);
    if (Date.now() - started < FAST_FAIL_MS && tries < RETRY_DELAYS.length) {
      box.dataset.tries = tries + 1;
      delete box.dataset.loaded;
      retryLater(`hist${id}`, histTask(id), tries);
      return done();
    }
    box.dataset.tries = 0;
    // รอภาพในหน้า สนน. โหลดเสร็จ (ตำแหน่งกราฟจึงนิ่ง) แล้วขยับความกว้าง 1px ให้ Highcharts วาดใหม่
    // ซ่อนกรอบไว้จนเสร็จ ผู้ชมจึงไม่เห็นหน้า สนน. ขยับ
    setTimeout(() => { if (box.contains(f)) f.style.width = `${pageW + 1}px`; }, 1200);
    setTimeout(() => {
      if (box.contains(f)) { f.style.width = `${pageW}px`; box.classList.add("ready"); }
      done();
    }, 1500);
  };
  f.src = stationUrl(id, Date.now());
}
// แสดงกรอบเมื่อหน้า สนน. โหลดเสร็จ (ก่อนหน้านั้นเห็นข้อความกำลังโหลด)
$("#bmaProfile").addEventListener("load", (e) => {
  if (!profileState.start) return;
  // load ของกรอบว่าง (about:blank) ตอนเปิดหน้า อาจมาถึงหลังเริ่มส่งฟอร์มแล้ว → ไม่นับ
  // (กรอบว่างอ่านได้ ส่วนหน้า สนน. ต่างโดเมนอ่านไม่ได้ → เกิด error = เป็นหน้า สนน. จริง)
  try { if (e.target.contentWindow.location.href === "about:blank") return; } catch { /* หน้า สนน. */ }
  if (!profileState.expecting) {
    // หน้าโหลดเองโดยเราไม่ได้สั่ง = ผู้ใช้คลิกจุดบนกราฟ แล้วหน้า สนน. พาไปหน้าสถานีในกรอบ
    // (ห้ามจากภายนอกไม่ได้) → ซ่อนกรอบแล้วโหลดกราฟกลับมาทันที
    $(".frame-wrap").classList.remove("ready");
    $(".frame-msg").textContent = "กำลังโหลดกราฟระดับน้ำจาก สนน.…";
    enqueue("profile", profileTask, true);
    return;
  }
  profileState.expecting = false;
  const done = profileState.done || (() => {});
  profileState.done = null;
  if (Date.now() - profileState.start < FAST_FAIL_MS) {
    // ได้หน้า 403 → ซ่อนกรอบ (แสดงข้อความ) แล้วกลับเข้าคิวภายหลัง
    // กราฟหลักลองใหม่ไปเรื่อย ๆ (ทุก 1 นาทีหลังครั้งที่ 5) ไม่ยอมแสดงหน้า 403 เป็นกราฟขาว
    $(".frame-wrap").classList.remove("ready");
    $(".frame-msg").textContent = profileState.tries < 2
      ? "กำลังโหลดกราฟระดับน้ำจาก สนน.…"
      : "สนน. ปฏิเสธการเชื่อมต่อชั่วคราว (มีคนเรียกข้อมูลถี่) — จะลองใหม่อัตโนมัติ";
    retryLater("profile", profileTask, profileState.tries++);
    return done();
  }
  profileState.tries = 0;
  // กราฟ Highcharts ของ สนน. อาจวัดขนาดก่อนหน้าเว็บจัดวางเสร็จ จึงกว้างเกิน (ขวาโดนตัด)
  // ขยับความกว้างกรอบ 1px ให้เกิด resize ภายใน แล้วกราฟจะวาดใหม่พอดีหน้า
  const f = e.target;
  setTimeout(() => { f.style.width = `${PROFILE.pageW + 1}px`; }, 500);
  setTimeout(() => { f.style.width = `${PROFILE.pageW}px`; }, 700);
  setTimeout(() => { $(".frame-wrap").classList.add("ready"); done(); }, 1000);
});
// จัดขนาดใหม่เฉพาะเมื่อ "ความกว้าง" เปลี่ยน — ใน Apps Script กรอบของ Google ปรับความสูงตามเนื้อหา
// ซึ่งยิง resize ทุกครั้งที่ความสูงเปลี่ยน ถ้าวาดใหม่ทุกครั้งจะวนไม่จบ (หน้าค้าง)
let rz, lastW = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(rz);
  rz = setTimeout(() => {
    if (profileOn) fitFrame();
    drawDistMap(); sizeHist($(`.hist-frame[data-id="${currentId}"]`));
  }, 150);
});

$("#stnBar").addEventListener("click", (e) => {
  const b = e.target.closest(".stn-btn");
  if (b) select(Number(b.dataset.id));
});
$("#profileLoad").addEventListener("click", showProfile);
document.addEventListener("click", (e) => {
  const b = e.target.closest(".img-btn");
  const lb = $("#lightbox");
  if (b && b.classList.contains("img-fail")) {      // แตะภาพที่โหลดไม่สำเร็จ = ลองใหม่ทันที
    const img = $("img", b);
    b.classList.remove("img-fail");
    img.dataset.tries = 0;
    enqueue(`img${b.dataset.id}`, imgTask(img), true);
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
