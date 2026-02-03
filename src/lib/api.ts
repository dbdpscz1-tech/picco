import { CONFIG, getSheetExportUrl } from "./config";
import type { MenuDict, OrderHistory, MenuFullItem, AddressResult } from "./types";

// CSV 파싱 헬퍼
function parseCSV(csvText: string): string[][] {
  const lines = csvText.split("\n");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// Google Sheets에서 메뉴판 가져오기
export async function fetchMenuFromGoogleSheets(): Promise<MenuDict> {
  try {
    const url = getSheetExportUrl(CONFIG.MENU_SHEET_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const menuDict: MenuDict = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 4) {
        const option = row[2]?.trim() || "";
        const brand = row[3]?.trim() || "";
        if (option && brand && option !== "nan" && brand !== "nan") {
          menuDict[option] = brand;
        }
      }
    }

    return menuDict;
  } catch (error) {
    console.error("메뉴판 로드 실패:", error);
    return {};
  }
}

// Google Sheets에서 주문 이력 가져오기
export async function fetchOrderHistory(): Promise<OrderHistory[]> {
  try {
    const url = getSheetExportUrl(CONFIG.ORDER_HISTORY_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) return [];

    const headers = rows[0];
    const data: OrderHistory[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const item: OrderHistory = {};
      headers.forEach((header, idx) => {
        const value = row[idx] || "";
        if (header === "수량") {
          item[header] = parseInt(value) || 0;
        } else {
          item[header] = value;
        }
      });
      data.push(item);
    }

    return data;
  } catch (error) {
    console.error("주문 이력 로드 실패:", error);
    return [];
  }
}

// Google Sheets에서 전체 메뉴판 가져오기
export async function fetchMenuFull(): Promise<MenuFullItem[]> {
  try {
    const url = getSheetExportUrl(CONFIG.MENU_SHEET_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const items: MenuFullItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 6) {
        items.push({
          no: parseInt(row[0]) || i,
          productName: row[1]?.trim() || "",
          option: row[2]?.trim() || "",
          brand: row[3]?.trim() || "",
          supplyPrice: parseFloat(row[4]?.replace(/[₩,]/g, "")) || 0,
          shippingFee: parseFloat(row[5]?.replace(/[₩,]/g, "")) || 0,
        });
      }
    }

    return items;
  } catch (error) {
    console.error("전체 메뉴판 로드 실패:", error);
    return [];
  }
}

// 카카오 주소 검색
export async function searchAddressKakao(query: string): Promise<string[]> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=5`;
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${CONFIG.KAKAO_API_KEY}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results: string[] = [];

    for (const doc of data.documents || []) {
      const road = doc.road_address;
      const addr = doc.address;

      let fullAddr = "";
      if (road) {
        fullAddr = road.address_name || "";
        if (road.building_name) {
          fullAddr += ` (${road.building_name})`;
        }
      } else if (addr) {
        fullAddr = addr.address_name || "";
      } else {
        fullAddr = doc.address_name || "";
      }

      if (fullAddr) {
        results.push(fullAddr);
      }
    }

    return results;
  } catch (error) {
    console.error("주소 검색 실패:", error);
    return [];
  }
}

// 카카오 키워드 검색
export async function searchKeywordKakao(query: string): Promise<string[]> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`;
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${CONFIG.KAKAO_API_KEY}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results: string[] = [];

    for (const doc of data.documents || []) {
      const placeName = doc.place_name || "";
      const roadAddr = doc.road_address_name || "";
      const addr = doc.address_name || "";
      const displayAddr = roadAddr || addr;

      if (placeName && displayAddr) {
        results.push(`${displayAddr} (${placeName})`);
      } else if (displayAddr) {
        results.push(displayAddr);
      }
    }

    return results;
  } catch (error) {
    console.error("키워드 검색 실패:", error);
    return [];
  }
}

// 텍스트 정규화
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  let normalized = String(text).trim();
  normalized = normalized.replace(/^\[.*?\]\s*/, "");
  return normalized.replace(/\s+/g, " ");
}

// 브랜드 찾기
export function findBrand(opt1: string, opt2: string, menu: MenuDict): string {
  if (menu[opt2]) return menu[opt2];
  if (menu[opt1]) return menu[opt1];

  const n1 = normalizeText(opt1);
  const n2 = normalizeText(opt2);

  for (const [k, v] of Object.entries(menu)) {
    const nk = normalizeText(k);
    if (nk && (n1 === nk || n2 === nk)) return v;
    if (nk && nk.length > 5) {
      if (nk.includes(n1) || nk.includes(n2) || n1.includes(nk) || n2.includes(nk)) {
        return v;
      }
    }
  }

  return "미분류";
}

// KPI 데이터 타입
export interface KPIData {
  dailySales: string[][]; // S4:U30 일일판매수
  salesCount: string[][]; // B4:P10 판매 수
  revenue: string[][]; // B13:P17 매출
  channels: string[][]; // B45:P83 채널별
}

// 2026KPI 시트에서 데이터 가져오기
export async function fetchKPIData(): Promise<KPIData | null> {
  try {
    const url = getSheetExportUrl(CONFIG.KPI_SHEET_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // 엑셀 열 인덱스 변환 (A=0, B=1, ..., S=18, U=20)
    const colIndex = (col: string): number => {
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + (col.charCodeAt(i) - 64);
      }
      return index - 1;
    };

    // 범위 추출 함수
    const extractRange = (
      data: string[][],
      startCol: string,
      endCol: string,
      startRow: number,
      endRow: number
    ): string[][] => {
      const result: string[][] = [];
      const sCol = colIndex(startCol);
      const eCol = colIndex(endCol);

      for (let r = startRow - 1; r < endRow && r < data.length; r++) {
        const row = data[r];
        if (row) {
          const extracted = row.slice(sCol, eCol + 1);
          result.push(extracted);
        }
      }
      return result;
    };

    // 각 범위 추출
    const dailySales = extractRange(rows, "S", "U", 4, 30).filter(
      (row) => row.some((cell) => cell && cell.trim() !== "")
    );
    const salesCount = extractRange(rows, "B", "P", 4, 10);
    const revenue = extractRange(rows, "B", "P", 13, 17);
    const channels = extractRange(rows, "B", "P", 45, 83);

    return {
      dailySales,
      salesCount,
      revenue,
      channels,
    };
  } catch (error) {
    console.error("KPI 데이터 로드 실패:", error);
    return null;
  }
}

// 날짜 포맷팅
export function formatDate(format: string = "YYYYMMDD"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  if (format === "YYYYMMDD") {
    return `${year}${month}${day}`;
  }
  if (format === "YYYYMM") {
    return `${year}${month}`;
  }
  return `${year}-${month}-${day}`;
}

// 발주 시간 범위 계산 (전일 11:01 ~ 당일 11:00)
export interface OrderTimeRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

export function getOrderTimeRange(): OrderTimeRange {
  const now = new Date();
  const today11am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);

  let start: Date;
  let end: Date;

  if (now >= today11am) {
    // 현재 시간이 오늘 11시 이후면: 오늘 11:01 ~ 내일 11:00
    start = new Date(today11am.getTime() + 60000); // 11:01
    end = new Date(today11am.getTime() + 24 * 60 * 60 * 1000); // 다음날 11:00
  } else {
    // 현재 시간이 오늘 11시 이전이면: 어제 11:01 ~ 오늘 11:00
    start = new Date(today11am.getTime() - 24 * 60 * 60 * 1000 + 60000); // 어제 11:01
    end = today11am; // 오늘 11:00
  }

  const formatDateTime = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  return {
    start,
    end,
    startStr: formatDateTime(start),
    endStr: formatDateTime(end),
  };
}

// 시간 문자열을 Date로 파싱 (다양한 형식 지원)
export function parseOrderTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  // "2026-02-03 10:30:45" 또는 "2026/02/03 10:30:45" 형식
  const match = timeStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds = "0"] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  }

  return null;
}

// 주문이 시간 범위 내에 있는지 확인
export function isOrderInTimeRange(savedTimeStr: string, range: OrderTimeRange): boolean {
  const orderTime = parseOrderTime(savedTimeStr);
  if (!orderTime) return false;
  return orderTime >= range.start && orderTime < range.end;
}

// 개별주문 저장 타입
export interface SavedOrder {
  saved_time: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  product_name: string;
  option: string;
  quantity: number;
  supply_price: number;
  shipping_fee: number;
  total: number;
}

// 개별주문 저장 (Google Apps Script로 전송)
export async function saveIndividualOrders(orders: {
  recipient_name: string;
  recipient_phone: string;
  address: string;
  product_name: string;
  option: string;
  quantity: number;
  supply_price: number;
  shipping_fee: number;
  brand?: string;
  original_shipping_fee?: number;  // 원본 배송비 (그룹화 전)
  is_shipping_grouped?: boolean;   // 배송비 그룹화로 0원 처리 여부
}[]): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // CORS 우회
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orders,
        sheet_gid: CONFIG.INDIVIDUAL_ORDER_GID
      }),
    });

    // no-cors 모드에서는 응답을 읽을 수 없으므로 성공으로 간주
    return { success: true, count: orders.length };
  } catch (error) {
    console.error("개별주문 저장 실패:", error);
    return { success: false, error: String(error) };
  }
}

// 개별주문 불러오기 (검색 지원: name, phone 파라미터)
export async function fetchSavedOrders(name?: string, phone?: string): Promise<{ success: boolean; orders?: SavedOrder[]; count?: number; searchMode?: boolean; error?: string }> {
  try {
    // 검색 파라미터가 있으면 쿼리스트링 추가
    let url = CONFIG.APPS_SCRIPT_URL;
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (phone) params.append('phone', phone);

    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("서버 응답 오류");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("개별주문 불러오기 실패:", error);
    return { success: false, error: String(error) };
  }
}

// =====================================
// 주문 KPI 데이터 (통합 발주서 시트 기반)
// =====================================

export interface OrderKPIRow {
  month: string;       // Column C (월별)
  orderDate: string;   // Column D (발주일)
  salesCount: number;  // Column P (판매건수)
  salesMall: string;   // Column AA (판매몰)
}

export interface OrderKPIData {
  rows: OrderKPIRow[];
  years: number[];
}

// 통합 발주서 시트에서 KPI 데이터 가져오기
export async function fetchOrderKPIData(): Promise<OrderKPIData | null> {
  try {
    const url = getSheetExportUrl(CONFIG.ORDER_HISTORY_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) return null;

    const kpiRows: OrderKPIRow[] = [];
    const yearsSet = new Set<number>();

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 27) continue; // Need at least up to column AA (index 26)

      const month = row[2]?.trim() || "";          // Column C (index 2)
      const orderDate = row[3]?.trim() || "";      // Column D (index 3)
      const salesCountRaw = row[15]?.trim() || ""; // Column P (index 15)
      const salesMall = row[26]?.trim() || "";     // Column AA (index 26)

      // 발주일에서 연도 추출
      const dateMatch = orderDate.match(/(\d{4})[-/]?\d{1,2}[-/]?\d{1,2}/);
      if (dateMatch) {
        yearsSet.add(parseInt(dateMatch[1]));
      }

      // 판매건수 파싱 (숫자만 추출)
      const salesCount = parseInt(salesCountRaw.replace(/[^0-9-]/g, "")) || 0;

      // 유효한 데이터만 추가
      if (orderDate || month) {
        kpiRows.push({
          month,
          orderDate,
          salesCount,
          salesMall,
        });
      }
    }

    return {
      rows: kpiRows,
      years: Array.from(yearsSet).sort((a, b) => b - a), // 최신 연도 먼저
    };
  } catch (error) {
    console.error("주문 KPI 데이터 로드 실패:", error);
    return null;
  }
}

// 날짜 문자열 정규화 (YYYY-MM-DD 형식으로)
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return "";

  // YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD 형식 지원
  const match = dateStr.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateStr;
}

// 오늘 날짜 문자열 (YYYY-MM-DD)
export function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// 현재 월 문자열 (YYYY-MM)
export function getCurrentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
