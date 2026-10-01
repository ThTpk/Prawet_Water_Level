/* GitHub Pages: ทุกอย่างโหลดสดจากเว็บ สนน. ในเบราว์เซอร์ของผู้ชม (ไม่มีเซิร์ฟเวอร์กลาง) */
"use strict";

const BMA = "https://weather.bangkok.go.th/water";

// สถานีบนแผนภาพคลองประเวศ เรียงตะวันตก -> ตะวันออก (ตามหน้า MapLetLeaf, selriver=30_1)
const STATIONS = [
  { id: 43, name: "ส.พระโขนง", kind: "สถานีสูบน้ำ", district: "คลองเตย" },
  { id: 238, name: "ค.ประเวศ ซ.อ่อนนุช 17", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง" },
  { id: 42, name: "ค.ประเวศฯ-วัดขจรฯ", kind: "จุดวัดระดับน้ำ", district: "สวนหลวง" },
  { id: 40, name: "ปตร.คลองประเวศฯ-วัดกระทุ่มฯ", kind: "ประตูระบายน้ำ", district: "ประเวศ" },
  { id: 206, name: "ค.ตาพุก ถ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ประเวศ" },
  { id: 39, name: "ปตร.คลองประเวศฯ-ลาดกระบัง", kind: "ประตูระบายน้ำ", district: "ลาดกระบัง" },
  { id: 64, name: "ค.ประเวศฯ-รพ.ลาดกระบัง", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง" },
  { id: 65, name: "ค.ประเวศฯ-ถ.ร่วมพัฒนา", kind: "จุดวัดระดับน้ำ", district: "ลาดกระบัง" },
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let filter = "all";

const imgUrl = (id, t) => `${BMA}/StationDetail/CreateCrossection?id=${id}&_=${t}`;

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

$("#btnRefresh").addEventListener("click", refresh);
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#lightbox").hidden = true; });

refresh();
setInterval(refresh, 5 * 60e3);
