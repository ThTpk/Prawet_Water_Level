"""เก็บระดับน้ำตามแนวคลองประเวศ ราย 4 ชั่วโมง ย้อนหลัง 24 ชั่วโมง แล้วส่งขึ้นเว็บ Apps Script

ต้องรันจากเครื่องในไทย: Cloudflare ของ สนน. ตอบ 403 ("Just a moment...") ให้เซิร์ฟเวอร์ Google
จึงให้เครื่องนี้ดึงแทน (Task Scheduler รันทุกชั่วโมง) แล้ว POST ผลไปเก็บที่ Apps Script (doPost ใน gas/Code.gs)

    python collector.py            # ดึง + ส่งขึ้นเว็บ
    python collector.py --dry-run  # ดึงแล้วพิมพ์ผล ไม่ส่ง

ข้อมูลมาจากตาราง "ตารางข้อมูลระดับน้ำย้อนหลัง" (table#example) ในหน้า StationDetail ของแต่ละจุด
— ตารางเดียวกับที่ปุ่ม CSV ของ สนน. export (DataTables export จากตารางในหน้า ไม่มีไฟล์ CSV แยก)
ระดับน้ำย้อนหลัง 48 ชม. ทุก 5 นาที: วัน-เวลา (พ.ศ.) | ระดับน้ำ (ด้านใน) | ระดับน้ำด้านนอก
ดึงแค่ HTML ไม่รันสคริปต์ในหน้า จึงไม่โดนบั๊ก languages/th.json วนซ้ำ → 1 คำขอต่อจุด รวม 8 คำขอต่อรอบ

ไฟล์ collector_secret.txt (ไม่อยู่ใน git) เก็บรหัสที่ใช้ส่งขึ้นเว็บ — Code.gs เก็บเฉพาะ SHA-256 ของรหัส
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests

import config

ROOT = Path(__file__).resolve().parent
SECRET_FILE = ROOT / "collector_secret.txt"
WEBAPP_URL = ("https://script.google.com/macros/s/"
              "AKfycby89ZK2THTWzkvEFOgzwtC5PB62JIF1JFEczwgEIoYp7Ys-W-9UW8dGQ-S5QrSuCHnw/exec")

# จุดวัดเรียงตะวันตก → ตะวันออก (ตรงกับ STATIONS ใน pages/pages.js); wl = จำนวนเส้นระดับน้ำ (countwl)
STATIONS = [(43, 2), (238, 1), (42, 1), (40, 2), (206, 1), (39, 2), (64, 1), (65, 1)]
STEP_HOURS = 4
N_MARKS = 6               # 6 เส้น = ย้อนหลัง 20 ชม. จากรอบล่าสุด (ครอบคลุม 24 ชม.)
MATCH_MINUTES = 10        # ใช้ค่าที่ใกล้เวลารอบที่สุด ภายใน ±10 นาที
PAUSE_SECONDS = 2         # เว้นระหว่างคำขอ ไม่ยิง สนน. ติดกัน

_TABLE = re.compile(r'<table[^>]*id="example"[^>]*>(.*?)</table>', re.S | re.I)
_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<t([hd])([^>]*)>(.*?)</t[hd]>", re.S | re.I)
_TAG = re.compile(r"<[^>]+>")


def _num(txt: str) -> float | None:
    try:
        v = float(txt.replace(",", ""))
    except ValueError:
        return None
    return None if v <= -50 else v   # -99 / -999 = ไม่มีข้อมูล


def parse_table(html: str) -> tuple[dict[datetime, float | None], dict[datetime, float | None]]:
    """ตารางระดับน้ำย้อนหลังของหน้าสถานี → (ด้านใน/ค่าเดียว, ด้านนอก) เป็น {เวลา: ค่า}
    คอลัมน์ที่ซ่อน (ลำดับ) ข้ามไป; เลือกคอลัมน์จากหัวตาราง: id="waterleveloutside" = ด้านนอก,
    คอลัมน์ระดับน้ำแรกที่ไม่ใช่ด้านนอก/แม่น้ำ = ด้านใน; วัน-เวลาเป็น พ.ศ. แปลงเป็น ค.ศ."""
    m = _TABLE.search(html)
    if not m:
        return {}, {}
    rows = _ROW.findall(m.group(1))
    if not rows:
        return {}, {}
    head = [(attrs, _TAG.sub("", txt).strip()) for _, attrs, txt in _CELL.findall(rows[0])
            if "hidden" not in attrs]
    col_in = col_out = None
    for i, (attrs, txt) in enumerate(head):
        if i == 0:
            continue                                   # วัน-เวลา
        if 'id="waterleveloutside"' in attrs or "ด้านนอก" in txt and "สุด" not in txt:
            col_out = i if col_out is None else col_out
        elif col_in is None and "แม่น้ำ" not in txt and "สุด" not in txt:
            col_in = i
    ins: dict[datetime, float | None] = {}
    outs: dict[datetime, float | None] = {}
    for row in rows[1:]:
        cells = [_TAG.sub("", txt).strip() for _, attrs, txt in _CELL.findall(row) if "hidden" not in attrs]
        if len(cells) < 2:
            continue
        try:
            t = datetime.strptime(cells[0], "%d/%m/%Y %H:%M")
        except ValueError:
            continue
        t = t.replace(year=t.year - 543)
        if col_in is not None and col_in < len(cells):
            ins[t] = _num(cells[col_in])
        if col_out is not None and col_out < len(cells):
            outs[t] = _num(cells[col_out])
    return ins, outs


def value_at(series: dict[datetime, float | None], t: datetime) -> float | None:
    best = None
    for ts, v in series.items():
        if v is None:
            continue
        d = abs((ts - t).total_seconds())
        if d <= MATCH_MINUTES * 60 and (best is None or d < best[0]):
            best = (d, v)
    return None if best is None else round(best[1], 2)


def fetch_station(s: requests.Session, wid: int) -> str:
    r = s.get(f"{config.BMA_BASE}/StationDetail", params={"id": wid}, timeout=config.REQUEST_TIMEOUT)
    r.raise_for_status()
    r.encoding = "utf-8"
    return r.text


def collect() -> dict:
    s = requests.Session()
    s.headers.update({"User-Agent": config.USER_AGENT, "Accept-Language": "th,en;q=0.8"})
    series: dict[int, tuple[dict, dict]] = {}
    errors: list[str] = []
    for i, (wid, wl) in enumerate(STATIONS):
        if i:
            time.sleep(PAUSE_SECONDS)
        try:
            series[wid] = parse_table(fetch_station(s, wid))
            if not series[wid][0]:
                errors.append(f"{wid}: ไม่พบตารางระดับน้ำย้อนหลังในหน้า")
        except requests.HTTPError as e:
            errors.append(f"{wid}: {e}")
            if e.response is not None and e.response.status_code in (403, 429):
                # Cloudflare บล็อก/จำกัดอยู่ → หยุดรอบนี้ทันที ไม่ยิงจุดที่เหลือซ้ำเติม (รอบหน้าค่อยลองใหม่)
                retry = e.response.headers.get("Retry-After")
                errors.append(f"หยุดรอบนี้: สนน. ตอบ {e.response.status_code}"
                              + (f" (Retry-After {retry} วินาที)" if retry else ""))
                break
        except Exception as e:  # noqa: BLE001 — จุดเดียวพังไม่ให้ทั้งรอบพัง
            errors.append(f"{wid}: {e}")

    latest = max((t for a, b in series.values() for t, v in {**a, **b}.items() if v is not None),
                 default=None)
    if latest is None:
        raise SystemExit("ดึงข้อมูลไม่ได้เลยสักจุด: " + "; ".join(errors))
    # รอบล่าสุด = เวลาลงตัว 4 ชม. (00, 04, 08, ...) ที่ไม่เกินค่าล่าสุด
    last_mark = latest.replace(hour=latest.hour - latest.hour % STEP_HOURS, minute=0, second=0)
    marks = [last_mark - timedelta(hours=STEP_HOURS * k) for k in range(N_MARKS - 1, -1, -1)]

    values = {}
    for wid, wl in STATIONS:
        a, b = series.get(wid, ({}, {}))
        values[str(wid)] = {"in": [value_at(a, t) for t in marks]}
        if wl >= 2:
            values[str(wid)]["out"] = [value_at(b, t) for t in marks]
    return {
        "updated": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "latest": latest.strftime("%Y-%m-%dT%H:%M"),
        "marks": [t.strftime("%Y-%m-%dT%H:%M") for t in marks],
        "values": values,
        "errors": errors,
    }


def upload(data: dict) -> str:
    token = SECRET_FILE.read_text(encoding="utf-8").strip()
    # Apps Script ตอบ 302 ไปยังหน้าผลลัพธ์ — requests ตามไปด้วย GET ให้เอง
    r = requests.post(WEBAPP_URL, data=json.dumps({"token": token, "data": data}),
                      headers={"Content-Type": "application/json"}, timeout=60)
    r.raise_for_status()
    return r.text.strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="ดึงแล้วพิมพ์ผล ไม่ส่งขึ้นเว็บ")
    args = ap.parse_args()
    data = collect()
    print(json.dumps(data, ensure_ascii=False, indent=1))
    if args.dry_run:
        return
    if data["errors"]:
        # ได้ไม่ครบทุกจุด → ไม่ส่ง (เก็บข้อมูลชุดก่อนบนเว็บไว้ ดีกว่าแทนด้วยค่าที่หายไปบางจุด)
        print("ไม่ส่งขึ้นเว็บ: ดึงได้ไม่ครบ", file=sys.stderr)
        sys.exit(1)
    res = upload(data)
    print("upload:", res)
    if res != "ok":
        sys.exit(1)


if __name__ == "__main__":
    main()
