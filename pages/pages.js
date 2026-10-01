/* หน้าเว็บ Apps Script: ทุกอย่างโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง) */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
// anchor = จุดที่ให้หน้าสถานีของ สนน. เลื่อนไป เพื่อให้กราฟย้อนหลังอยู่ใต้แถบเมนูที่ปักหมุดด้านบน
//   ค่าเริ่มต้น div_status (กล่องสถานะอุปกรณ์ เหนือกราฟ ~360px); สถานีที่ไม่มีกล่องนี้ใช้ภาพรูปตัด
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย" },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง", anchor: "crossection" },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง" },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ" },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ", anchor: "crossection" },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง" },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง" },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง" },
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let filter = "all";

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
      <div class="hist-row">
        <button class="btn hist-btn" data-id="${s.id}" data-name="${esc(s.name)}">ดูกราฟระดับน้ำย้อนหลัง</button>
      </div>
      <footer class="small">
        <span class="muted">ระดับน้ำและเกณฑ์อยู่ในภาพ (ม.รทก.)</span>
        <a href="${BMA}/StationDetail?id=${s.id}" target="_blank" rel="noopener">หน้าสถานี ↗</a>
      </footer>
    </article>`;
  }).join("");
  applyFilter();
}
function applyFilter() {
  $$(".st-card").forEach((c) => (c.hidden = filter === "gate" && c.dataset.gate !== "1"));
}

function refresh() {
  const t = Date.now();
  $("#frmProfile").submit();               // โหลดกราฟ MapLetLeaf ใหม่ใน iframe
  $$(".img-btn").forEach((b) => b.classList.remove("img-fail"));
  if (!$("#cards").children.length) renderCards(t);
  else $$(".img-btn img").forEach((img) => (img.src = imgUrl(img.closest(".img-btn").dataset.id, t)));
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
  if (!$("#histModal").hidden) cropSidebar($("#histModal .modal-frame"), $("#histFrame"), true);
}

/* หน้าต่างกราฟระดับน้ำย้อนหลัง: เปิดหน้าสถานีของ สนน. ทีละหน้าเมื่อกดปุ่ม
   (ไม่ฝังพร้อมกันทุกจุด เพราะหน้าสถานีหนัก และ สนน. บล็อกชั่วคราวถ้าโหลดพร้อมกันหลายหน้า)
   - หน้า สนน. ปักหมุดแถบเมนูไว้ด้านบนเมื่อเลื่อนลง → CSS ตัดขอบบนของกรอบทิ้ง (ดู #histFrame)
   - โหลดหน้าก่อน แล้วค่อยเลื่อนไปที่ anchor หลังภาพโหลดเสร็จ ตำแหน่งจึงไม่คลาด */
function openHistory(id, name) {
  const m = $("#histModal"), f = $("#histFrame"), wrap = $("#histModal .modal-frame");
  const st = STATIONS.find((s) => String(s.id) === String(id)) || {};
  $("#histTitle").textContent = `กราฟระดับน้ำย้อนหลัง · ${name}`;
  $("#histLink").href = `${BMA}/StationDetail?id=${id}`;
  m.hidden = false;
  document.body.style.overflow = "hidden";
  cropSidebar(wrap, f, true);
  const url = stationUrl(id, Date.now());
  let jumped = false;
  f.onload = () => {
    if (jumped) return;
    setTimeout(() => {
      jumped = true;
      f.src = `${url}#${st.anchor || "div_status"}`;   // เปลี่ยนแค่ # = เลื่อนในหน้าเดิม ไม่โหลดใหม่
      // ให้ Highcharts ของ สนน. วาดใหม่ให้พอดีกรอบ (เหมือนกรอบกราฟหลัก)
      cropSidebar(wrap, f, true, 1);
      setTimeout(() => cropSidebar(wrap, f, true), 150);
    }, 800);
  };
  f.src = url;
}
function closeHistory() {
  const m = $("#histModal");
  if (m.hidden) return;
  m.hidden = true;
  document.body.style.overflow = "";
  $("#histFrame").onload = null;
  $("#histFrame").src = "about:blank";
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
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(fitFrame, 100); });
fitFrame();

$("#btnRefresh").addEventListener("click", refresh);
$$("#cardFilter button").forEach((b) => b.addEventListener("click", () => {
  $$("#cardFilter button").forEach((x) => x.classList.toggle("on", x === b));
  filter = b.dataset.f; applyFilter();
}));
document.addEventListener("click", (e) => {
  const h = e.target.closest(".hist-btn");
  if (h) return openHistory(h.dataset.id, h.dataset.name);
  if (e.target.closest("#histClose") || e.target.id === "histModal") return closeHistory();
  const b = e.target.closest(".img-btn");
  const lb = $("#lightbox");
  if (b && !b.classList.contains("img-fail")) {
    $("img", lb).src = $("img", b).src; $("figcaption", lb).textContent = b.dataset.cap; lb.hidden = false;
  } else if (e.target.closest("#lightbox")) lb.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { $("#lightbox").hidden = true; closeHistory(); }
});

refresh();
setInterval(refresh, 5 * 60e3);
