// 메뉴 아이템 타입
export interface MenuItem {
  option: string;
  brand: string;
}

// 메뉴 딕셔너리 타입
export type MenuDict = Record<string, string>;

// 주문 데이터 타입
export interface OrderData {
  data: (string | number | null)[];
  qty: number;
  opt: string;
}

// 브랜드별 주문 결과
export type ProcessedResults = Record<string, OrderData[]>;

// 주문 이력 타입
export interface OrderHistory {
  발주일?: string;
  월?: string;
  수량?: number;
  브랜드?: string;
  [key: string]: string | number | undefined;
}

// 개별 주문 타입
export interface IndividualOrder {
  recipient_name: string;
  recipient_phone: string;
  address: string;
  product_name: string;
  option: string;
  quantity: number;
  supply_price: number;
  shipping_fee: number;
}

// KPI 통계 타입
export interface KPIStats {
  todayCount: number;
  todayQty: number;
  monthCount: number;
  monthQty: number;
}

// 브랜드 통계 타입
export interface BrandStats {
  brand: string;
  orderCount: number;
  totalQty: number;
}

// 카카오 주소 검색 결과
export interface AddressResult {
  address: string;
  placeName?: string;
}

// 메뉴 풀 데이터 (전체 컬럼)
export interface MenuFullItem {
  no: number;
  productName: string;
  option: string;
  brand: string;
  supplyPrice: number;
  shippingFee: number;
}
