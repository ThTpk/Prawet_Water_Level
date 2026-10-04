/**
 * ระดับน้ำคลองประเวศบุรีรมย์ — Google Apps Script Web App
 *
 * หน้าเว็บโหลดข้อมูลสดจาก สนน. กทม. ในเบราว์เซอร์ของผู้ชมโดยตรง
 * (กราฟ MapLetLeaf ใน iframe + ภาพประตูระบายน้ำรายจุด) จึงไม่ต้องใช้ UrlFetchApp
 *
 * Index.html สร้างจาก pages/ ด้วย `python build_gas.py` — อย่าแก้ตรงนี้
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระดับน้ำคลองประเวศ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ระดับน้ำตามแนวคลอง ราย 4 ชม. ย้อนหลัง 24 ชม. — collector.py (รันบนเครื่องในไทยทุกชั่วโมง) ส่งมาเก็บไว้
 * เซิร์ฟเวอร์ Google ดึงจาก สนน. เองไม่ได้ (Cloudflare ตอบ 403) จึงรับข้อมูลที่ดึงมาแล้วแทน
 * รหัสส่งข้อมูลอยู่ใน collector_secret.txt บนเครื่องที่ดึง — ที่นี่เก็บเฉพาะ SHA-256
 */
const INGEST_TOKEN_SHA256 = '2dfd371eab94527447e5539362f58d580254dd0fac406274435165a5145c4f77';
const PROFILE_KEY = 'profile24';

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput('bad json');
  }
  if (sha256Hex_(body.token) !== INGEST_TOKEN_SHA256) return ContentService.createTextOutput('forbidden');
  const json = JSON.stringify(body.data || null);
  if (json.length > 8000) return ContentService.createTextOutput('too large');   // Script Properties จำกัด 9 KB/ค่า
  PropertiesService.getScriptProperties().setProperty(PROFILE_KEY, json);
  return ContentService.createTextOutput('ok');
}

/** หน้าเว็บเรียกผ่าน google.script.run — คืน JSON ที่เก็บไว้ล่าสุด (หรือ null) */
function getProfile24() {
  return PropertiesService.getScriptProperties().getProperty(PROFILE_KEY);
}

function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s || ''), Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}
