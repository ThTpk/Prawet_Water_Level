"""สร้าง gas/Index.html สำหรับ Google Apps Script จากหน้าเว็บใน pages/

    python build_gas.py
    clasp push && clasp deploy -i <deploymentId>     # อัปเดตเว็บเดิม (ลิงก์ไม่เปลี่ยน)

HtmlService ให้ส่งไฟล์ HTML ได้ไฟล์เดียว จึงฝัง style.css และ pages.js ไว้ในหน้าเลย
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def check_no_slashes_in_strings(js: str) -> None:
    """หยุด build ถ้ายังมี // อยู่ในสตริง JS (Apps Script จะตัดส่วนที่เหลือของบรรทัดทิ้ง)"""
    for n, line in enumerate(js.splitlines(), 1):
        quote, i = None, 0
        while i < len(line):
            c = line[i]
            if quote:
                if c == "\\":
                    i += 1
                elif c == quote:
                    quote = None
                elif line.startswith("//", i):
                    raise SystemExit(f"pages.js:{n}: มี // อยู่ในสตริง → {line.strip()[:80]}")
            elif c in "\"'`":
                quote = c
            elif line.startswith("//", i):
                break  # ที่เหลือเป็นคอมเมนต์
            i += 1


def main() -> None:
    html = (ROOT / "pages" / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
    js = (ROOT / "pages" / "pages.js").read_text(encoding="utf-8")
    # Apps Script ลบคอมเมนต์ออกจากหน้าแบบหยาบ ๆ: เจอ // ที่ไหนถือเป็นคอมเมนต์ แม้อยู่ในสตริง
    # ("http://..." ถูกตัดเหลือ "http: → สคริปต์พังทั้งหน้า) จึงเขียน :// เป็น :\/\/ ซึ่ง JS อ่านได้ค่าเดิม
    js = js.replace("://", r":\/\/")
    check_no_slashes_in_strings(js)
    for old, new in (
        ('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>"),
        ('<script src="pages.js"></script>', f"<script>\n{js}\n</script>"),
        # HtmlService ใส่ viewport/title ให้เองใน Code.gs
        ('<meta name="viewport" content="width=device-width, initial-scale=1">\n', ""),
    ):
        if old not in html:
            raise SystemExit(f"ไม่พบ {old!r} ใน pages/index.html")
        html = html.replace(old, new)
    out = ROOT / "gas" / "Index.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK -> {out} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
