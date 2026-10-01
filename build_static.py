"""สร้างเว็บ static สำหรับ GitHub Pages -> โฟลเดอร์ site/

    python build_static.py
    python -m http.server 8070 -d site     # ทดลองในเครื่อง

เว็บ สนน. ไม่ยอมให้เซิร์ฟเวอร์ GitHub ดึงข้อมูล (403) หน้า Pages จึงให้เบราว์เซอร์ของผู้ชม
โหลดจาก สนน. โดยตรง: กราฟคลองประเวศฝังด้วย iframe และภาพรูปตัดรายจุดโหลดเป็น <img>
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "site"


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for src in (ROOT / "pages" / "index.html", ROOT / "pages" / "pages.js", ROOT / "static" / "style.css"):
        shutil.copy(src, OUT / src.name)
    (OUT / ".nojekyll").write_text("")
    print(f"OK -> {OUT}")


if __name__ == "__main__":
    main()
