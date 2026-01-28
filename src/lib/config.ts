// 피코 커머스 설정
export const CONFIG = {
  // Google Sheets - 메뉴판/주문이력 (기존 스프레드시트)
  SPREADSHEET_ID: "141RCJ5K5P9CdhpW60ojMFSPV7mR6CPRz",
  MENU_SHEET_GID: "202191104",
  ORDER_HISTORY_GID: "1771639339",
  KPI_SHEET_GID: "2042026306",

  // Google Sheets - 개별주문 (피코작업몰 스프레드시트)
  INDIVIDUAL_ORDER_SPREADSHEET_ID: "1aN2RI_hF0Nq6sfPm5yH3_thYmFKuY3CAgnMIaCEB6yk",
  INDIVIDUAL_ORDER_GID: "809784246", // 피코 개별주문 시트

  // Kakao API
  KAKAO_API_KEY: "bd2c82b2e6e073ce3c2268b0c6f87025",

  // Google Apps Script (개별주문 저장)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyhrxDtxqBBV3jVLWC9knCPXxDxHPKrQXgv8P9tcIWi8VkB0_XfMe7l2tibSH45b4Lh/exec",
} as const;

// Google Sheets URL 생성
export function getSheetExportUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}
