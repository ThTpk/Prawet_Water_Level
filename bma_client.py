"""ดึงข้อมูลปัจจุบันจากระบบตรวจวัดระดับน้ำ สำนักการระบายน้ำ กทม. (weather.bangkok.go.th/water)"""
from __future__ import annotations

import re
import time

import requests

import config


class BMAClient:
    def __init__(self) -> None:
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": config.USER_AGENT,
            "Accept-Language": "th,en;q=0.8",
            "Referer": config.BMA_BASE + "/",
        })

    def fetch_profile(self, river_value: str = config.PROFILE_RIVER_VALUE) -> dict:
        """แผนภาพระดับน้ำตามแนวคลอง จากหน้า MapLetLeaf"""
        r = self.s.post(config.BMA_BASE + "/MapLetLeaf", data={"selriver": river_value},
                        timeout=config.REQUEST_TIMEOUT)
        r.raise_for_status()
        r.encoding = "utf-8"
        return parse_profile(r.text)

    def fetch_snapshot(self) -> dict[int, dict]:
        """ค่าล่าสุดของทุกสถานี (ชื่อ, เขต, พิกัด, เวลา, สถานะ)"""
        r = self.s.post(config.BMA_BASE + "/PageMap/GoogleMap",
                        data={"payload": "TEST_DATA_GOES_HERE"},
                        headers={"X-Requested-With": "XMLHttpRequest"},
                        timeout=config.REQUEST_TIMEOUT)
        r.raise_for_status()
        r.encoding = "utf-8"
        return {int(x["water_id"]): x for x in r.json() if x.get("water_id") is not None}

    def fetch_cross_section(self, water_id: int) -> tuple[bytes, str]:
        """รูปประตูระบายน้ำ/รูปตัดคลองพร้อมระดับน้ำ ที่หน้า StationDetail ใช้"""
        r = self.s.get(config.BMA_BASE + "/StationDetail/CreateCrossection",
                       params={"id": water_id, "_": int(time.time())},
                       headers={"Referer": f"{config.BMA_BASE}/StationDetail?id={water_id}"},
                       timeout=config.REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "image/png")


# ---------------------------------------------------------------- parsing
_KV = re.compile(r"(\w+)\s*:\s*('(?:[^'\\]|\\.)*'|-?[\d.]+|null)")


def _obj(s: str) -> dict:
    out = {}
    for k, v in _KV.findall(s):
        if v == "null":
            out[k] = None
        elif v.startswith("'"):
            out[k] = v[1:-1]
        else:
            out[k] = float(v) if "." in v else int(v)
    return out


def parse_profile(html: str) -> dict:
    """อ่านข้อมูลกราฟ drawSetGraph ของหน้า MapLetLeaf

    คืนค่า {"stations": [{water_id, label, in:{v,warning,critical}, out:{...}|None, control}]}
    """
    i = html.find("function drawSetGraph")
    if i < 0:
        raise ValueError("ไม่พบสคริปต์กราฟ drawSetGraph ในหน้า MapLetLeaf")
    js = html[i:i + 300_000]

    m = re.search(r"applAllid\s*=\s*\[(.*?)\];", js, re.S)
    if not m:
        raise ValueError("ไม่พบ applAllid")
    ids = [int(x) for x in re.findall(r"'(\d+)'", m.group(1))]

    m = re.search(r"\bappl\s*=\s*\[(.*?)\];", js, re.S)
    if not m:
        raise ValueError("ไม่พบข้อมูลระดับน้ำ (appl)")
    entries = [_obj(e) for e in re.findall(r"\{([^{}]*)\}", m.group(1))]

    # ชื่อสถานีภาษาไทย (กิ่ง else ของ applAxisx)
    labels: list[str] = []
    for mm in re.finditer(r"applAxisx\s*=\s*\[(.*?)\];", js, re.S):
        cand = re.findall(r"\[\s*'([^']*)'", mm.group(1))
        if any(re.search(r"[฀-๿]", c) for c in cand):
            labels = [c for c in cand if c]

    by_x: dict[int, list[dict]] = {}
    for e in entries:
        if "x" in e:
            by_x.setdefault(int(e["x"]), []).append(e)

    stations = []
    for x, wid in enumerate(ids):
        es = by_x.get(x, [])
        side_in = side_out = None
        control = None
        for e in es:
            control = e.get("con") if control is None else control
            rec = {"v": e.get("y"), "warning": e.get("warning"), "critical": e.get("critical")}
            if e.get("data") == "(ด้านนอก)":
                side_out = rec
            else:
                side_in = rec
        stations.append({
            "water_id": wid,
            "label": labels[x] if x < len(labels) else None,
            "in": side_in, "out": side_out, "control": control,
        })
    return {"stations": stations}


def clean_level(v):
    """-99 / -999 = ไม่มีข้อมูล"""
    if v is None:
        return None
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if v <= -50 else v
