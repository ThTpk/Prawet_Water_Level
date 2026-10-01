"""สร้างเว็บแบบ static สำหรับ GitHub Pages

    python build_static.py            # -> โฟลเดอร์ site/ (index.html, app.js, style.css, data.json)

ถ้าดึงข้อมูลจาก สนน. ไม่ได้เลย จะจบด้วย exit code 1 เพื่อไม่ให้ GitHub Actions
เอาหน้าว่างไปทับหน้าเดิม
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

import config
from app import app, build_data

OUT = Path(__file__).resolve().parent / "site"


def main() -> int:
    data = build_data(force=True)
    gha = bool(os.environ.get("GITHUB_ACTIONS"))
    for e in data["errors"]:
        # ::warning:: แสดงเป็น annotation ในหน้า Actions
        print(f"::warning::{e}" if gha else f"WARN: {e}")
    if not data["stations"]:
        msg = "ไม่ได้ข้อมูลแผนภาพคลองประเวศ — ไม่สร้างเว็บ: " + " | ".join(data["errors"])
        print(f"::error::{msg}" if gha else f"ERROR: {msg}")
        return 1

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    with app.test_request_context("/"):
        from flask import render_template
        html = render_template("index.html", bma=config.BMA_BASE, static_site=True)
    (OUT / "index.html").write_text(html, encoding="utf-8")
    for f in ("app.js", "style.css"):
        shutil.copy(Path(app.static_folder) / f, OUT / f)
    (OUT / "data.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    print(f"OK {len(data['stations'])} สถานี, ดึงเมื่อ {data['fetched_at']} -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
