"""ค่าตั้งค่า: หน้าตรวจสอบระดับน้ำคลองประเวศบุรีรมย์ (ข้อมูลปัจจุบันจาก สนน. กทม.)"""

BMA_BASE = "https://weather.bangkok.go.th/water"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36 LKB-Flood-Monitor/2.0"
)
REQUEST_TIMEOUT = 60

# ค่าใน dropdown "ระดับน้ำ" ของหน้า /water/MapLetLeaf  (30_1 = คลองประเวศบุรีรมย์)
PROFILE_RIVER_VALUE = "30_1"

# ประตูระบายน้ำ/สถานีสูบน้ำ: ด้าน "ใน" อยู่ฝั่งไหนของคลอง (ใช้วาดขั้นระดับน้ำให้ถูกทิศ)
GATE_INNER_SIDE = {43: "east", 40: "west", 39: "west"}

# สถานีอื่นที่อยากดูเพิ่มในหน้าเดียวกัน (รหัสจาก StationDetail?id=...) เช่น [29, 57]
EXTRA_STATION_IDS: list[int] = []

# เก็บผลไว้ชั่วคราว (วินาที) เพื่อไม่ให้ยิงเว็บ กทม. ถี่เกินไป
CACHE_SECONDS = 120

HOST = "127.0.0.1"
PORT = 8050
