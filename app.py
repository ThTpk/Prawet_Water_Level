"""หน้าตรวจสอบระดับน้ำคลองประเวศบุรีรมย์ — รวมข้อมูลปัจจุบันจาก สนน. กทม. ไว้หน้าเดียว

    python app.py      ->  http://127.0.0.1:8050
"""
from __future__ import annotations

import argparse
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from flask import Flask, Response, abort, jsonify, render_template, request

import config
from bma_client import BMAClient, clean_level

TH_TZ = timezone(timedelta(hours=7))

app = Flask(__name__)
app.json.ensure_ascii = False

_lock = threading.Lock()
_cache: dict[str, tuple[float, object]] = {}


_key_locks: dict[str, threading.Lock] = {}


def cached(key: str, fn, force: bool = False):
    """แคชสั้นๆ ต่อคีย์ (ล็อกแยกคีย์ เพื่อให้โหลดรูปหลายสถานีพร้อมกันได้)"""
    with _lock:
        lk = _key_locks.setdefault(key, threading.Lock())
    with lk:
        hit = _cache.get(key)
        if hit and not force and time.time() - hit[0] < config.CACHE_SECONDS:
            return hit[1]
        val = fn()
        _cache[key] = (time.time(), val)
        return val


def side_status(side) -> str:
    if not side or side.get("v") is None:
        return "nodata"
    v, w, c = side["v"], side.get("warning"), side.get("critical")
    if c is not None and v >= c:
        return "critical"
    if w is not None and v >= w:
        return "warning"
    return "normal"


def worst(*s: str) -> str:
    order = ["nodata", "normal", "warning", "critical"]
    return max(s, key=order.index)


def _km(a, b) -> float:
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = (math.sin((la2 - la1) * p / 2) ** 2
         + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(h))


def _station_info(wid: int, snap: dict) -> dict:
    r = snap.get(wid) or {}
    return {
        "water_id": wid,
        "name": r.get("water_shortname"), "full_name": r.get("water_name"),
        "river": r.get("river_name"), "district": r.get("district_name"),
        "lat": r.get("latitude"), "lon": r.get("longitude"),
        "ts": r.get("site_timestampTH"), "minutes_old": r.get("datediffnow"),
        "bma_status": r.get("txtStatus"), "bma_color": r.get("colorStatus"),
        "left_bank": r.get("left_bank"), "right_bank": r.get("right_bank"),
        "url": f"{config.BMA_BASE}/StationDetail?id={wid}",
    }


def build_data(force: bool = False) -> dict:
    errors = []
    # ดึงสองหน้าพร้อมกัน (requests.Session แยกกัน)
    with ThreadPoolExecutor(2) as ex:
        f_prof = ex.submit(cached, "profile", lambda: BMAClient().fetch_profile(), force)
        f_snap = ex.submit(cached, "snapshot", lambda: BMAClient().fetch_snapshot(), force)
    try:
        prof = f_prof.result()
    except Exception as e:
        prof = {"stations": []}
        errors.append(f"แผนภาพคลองประเวศ (MapLetLeaf): {e}")
    try:
        snap = f_snap.result()
    except Exception as e:
        snap = {}
        errors.append(f"ข้อมูลสถานี (GoogleMap): {e}")

    stations, prev, dist = [], None, 0.0
    for p in prof["stations"]:
        wid = p["water_id"]
        info = _station_info(wid, snap)
        pt = (info["lat"], info["lon"])
        if prev and all(pt) and all(prev):
            dist += _km(prev, pt)
        prev = pt
        is_gate = p["out"] is not None
        status = worst(side_status(p["in"]), side_status(p["out"]))
        stations.append({
            **info, "name": info["name"] or p["label"],
            "km": round(dist, 2), "is_gate": is_gate,
            "inner_side": config.GATE_INNER_SIDE.get(wid, "west"),
            "in": p["in"], "out": p["out"], "control": p["control"], "status": status,
        })

    extra = []
    for wid in config.EXTRA_STATION_IDS:
        r = snap.get(wid)
        if not r:
            continue
        sin = {"v": clean_level(r.get("wl_in")), "warning": r.get("warning"), "critical": r.get("critical")}
        out_v = clean_level(r.get("wl_out01"))
        sout = {"v": out_v, "warning": r.get("warning_out01"), "critical": r.get("critical_out01")} \
            if out_v is not None else None
        extra.append({**_station_info(wid, snap), "is_gate": sout is not None, "in": sin, "out": sout,
                      "control": r.get("water_control"),
                      "status": worst(side_status(sin), side_status(sout))})

    return {
        # เวลาไทยเสมอ (เครื่อง GitHub Actions ใช้ UTC)
        "fetched_at": datetime.fromtimestamp(_cache.get("profile", (time.time(),))[0], TH_TZ)
                              .strftime("%Y-%m-%d %H:%M:%S"),
        "stations": stations, "extra": extra, "errors": errors,
        "source": config.BMA_BASE + "/MapLetLeaf",
    }


@app.get("/")
def index():
    return render_template("index.html", bma=config.BMA_BASE, static_site=False)


@app.get("/api/prawet")
def api_prawet():
    return jsonify(build_data(force=request.args.get("force") == "1"))


@app.get("/img/<int:wid>.png")
def cross_section(wid: int):
    try:
        data, ctype = cached(f"img{wid}", lambda: BMAClient().fetch_cross_section(wid),
                             force=request.args.get("force") == "1")
    except Exception:
        abort(502)
    return Response(data, mimetype=ctype, headers={"Cache-Control": f"max-age={config.CACHE_SECONDS}"})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=config.HOST)
    ap.add_argument("--port", type=int, default=config.PORT)
    a = ap.parse_args()
    print(f"\n  ระดับน้ำคลองประเวศ  ->  http://{a.host}:{a.port}\n")
    app.run(host=a.host, port=a.port, debug=False, threaded=True)
