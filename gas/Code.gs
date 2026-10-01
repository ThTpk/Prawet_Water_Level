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
