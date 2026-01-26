// 피코 커머스 설정
export const CONFIG = {
  // Google Sheets
  SPREADSHEET_ID: "141RCJ5K5P9CdhpW60ojMFSPV7mR6CPRz",
  MENU_SHEET_GID: "202191104",
  ORDER_HISTORY_GID: "1771639339",

  // Kakao API
  KAKAO_API_KEY: "bd2c82b2e6e073ce3c2268b0c6f87025",
} as const;

// Google Sheets URL 생성
export function getSheetExportUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}
