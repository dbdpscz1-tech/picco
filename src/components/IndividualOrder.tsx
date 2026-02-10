"use client";

import { useState, useRef, useEffect } from "react";
import { fetchMenuFull, formatDate, saveIndividualOrders, fetchSavedOrders, getOrderTimeRange, isOrderInTimeRange, type SavedOrder } from "@/lib/api";
import type { MenuFullItem, IndividualOrder as IndividualOrderType } from "@/lib/types";
import * as XLSX from "xlsx";

// 다음 우편번호 타입 선언
declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
        width?: string | number;
        height?: string | number;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  address: string;
  addressType: string;
  bname: string;
  buildingName: string;
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  autoRoadAddress: string;
  autoJibunAddress: string;
}

interface IndividualOrderProps {
  menuFull: MenuFullItem[];
  setMenuFull: (items: MenuFullItem[]) => void;
}

export default function IndividualOrder({ menuFull, setMenuFull }: IndividualOrderProps) {
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [orders, setOrders] = useState<IndividualOrderType[]>([]);
  const [generatedOrderDf, setGeneratedOrderDf] = useState<Record<string, string | number>[] | null>(null);
  const [showMenuPreview, setShowMenuPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // 오늘 발주 대상 주문 요약 (전일 11:01 ~ 당일 11:00)
  const [todayOrderSummary, setTodayOrderSummary] = useState<{
    count: number;
    totalAmount: number;
    orders: SavedOrder[];
    timeRange: ReturnType<typeof getOrderTimeRange> | null;
  }>({ count: 0, totalAmount: 0, orders: [], timeRange: null });
  const [loadingTodaySummary, setLoadingTodaySummary] = useState(false);

  // 검색 상태
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  // 주문 폼 상태
  const [inputMode, setInputMode] = useState<"single" | "multiple">("single"); // 단일 주소 / 다중 주소 모드
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [ordererName, setOrdererName] = useState("");  // 주문자명
  const [ordererPhone, setOrdererPhone] = useState(""); // 주문자 전화번호
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [zonecode, setZonecode] = useState("");
  const [currentSupplyPrice, setCurrentSupplyPrice] = useState(0);
  const [currentShippingFee, setCurrentShippingFee] = useState(0);
  const [isPostcodeLoaded, setIsPostcodeLoaded] = useState(false);

  // 단일 주소 모드용 상품 행 배열
  interface ProductRow {
    id: number;
    category: string;
    option: string;
    quantity: number;
    supplyPrice: number;
    shippingFee: number;
    brand: string;
  }
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { id: 1, category: "", option: "", quantity: 1, supplyPrice: 0, shippingFee: 0, brand: "" }
  ]);

  const mergeFileRef = useRef<HTMLInputElement>(null);

  // 다음 우편번호 스크립트 로드 확인
  useEffect(() => {
    const checkPostcode = () => {
      if (window.daum && window.daum.Postcode) {
        setIsPostcodeLoaded(true);
      } else {
        setTimeout(checkPostcode, 100);
      }
    };
    checkPostcode();
  }, []);

  // 오늘 발주 대상 주문 요약 조회 (전일 11:01 ~ 당일 11:00)
  const fetchTodayOrderSummary = async () => {
    setLoadingTodaySummary(true);
    try {
      const result = await fetchSavedOrders(); // 전체 주문 조회
      if (result.success && result.orders) {
        const timeRange = getOrderTimeRange();

        // 시간 범위 내 주문만 필터링
        const filteredOrders = result.orders.filter(order =>
          isOrderInTimeRange(order.saved_time, timeRange)
        );

        // 총 금액 계산 (배송비 그룹화 적용)
        const processedGroups = new Set<string>();
        let totalAmount = 0;

        // 브랜드 정보가 없을 수 있으므로 주소로만 그룹화하거나 product_name 사용
        for (const order of filteredOrders) {
          const groupKey = `${order.address}::${order.product_name}`;
          const isFirstInGroup = !processedGroups.has(groupKey);
          const appliedShippingFee = isFirstInGroup ? order.shipping_fee : 0;
          processedGroups.add(groupKey);

          totalAmount += (order.supply_price * order.quantity) + appliedShippingFee;
        }

        setTodayOrderSummary({
          count: filteredOrders.length,
          totalAmount,
          orders: filteredOrders,
          timeRange,
        });
      }
    } catch (error) {
      console.error("오늘 발주 요약 조회 실패:", error);
    } finally {
      setLoadingTodaySummary(false);
    }
  };

  // 컴포넌트 마운트 시 오늘 발주 요약 자동 조회
  useEffect(() => {
    fetchTodayOrderSummary();
  }, []);

  // 메뉴판 로드
  const handleLoadMenu = async () => {
    setLoadingMenu(true);
    try {
      const items = await fetchMenuFull();
      setMenuFull(items);
    } catch (error) {
      console.error("메뉴판 로드 실패:", error);
    } finally {
      setLoadingMenu(false);
    }
  };

  // 상품명 (카테고리) 목록
  const categories = [...new Set(menuFull.map((item) => item.productName).filter(Boolean))];

  // 선택된 카테고리의 옵션 목록
  const filteredOptions = menuFull.filter(
    (item) => item.productName === selectedCategory && item.option
  );

  // 옵션 선택 시 가격 업데이트
  const handleOptionChange = (option: string) => {
    setSelectedOption(option);
    const item = menuFull.find(
      (m) => m.productName === selectedCategory && m.option === option
    );
    if (item) {
      setCurrentSupplyPrice(item.supplyPrice);
      setCurrentShippingFee(item.shippingFee);
    }
  };

  // 다음 우편번호 팝업 열기
  const openAddressPopup = () => {
    if (!isPostcodeLoaded) {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        // 도로명 주소 우선, 없으면 지번 주소
        let fullAddress = data.roadAddress || data.jibunAddress || data.address;

        // 건물명이 있으면 추가
        if (data.buildingName) {
          fullAddress += ` (${data.buildingName})`;
        }

        setAddress(fullAddress);
        setZonecode(data.zonecode);
        setAddressDetail(""); // 상세주소 초기화
      },
    }).open();
  };

  // 주문 추가 (다중 주소 모드)
  const handleAddOrder = () => {
    if (!recipientName || !recipientPhone || !address) {
      alert("수취인명, 전화번호, 주소는 필수입니다");
      return;
    }

    // 전체 주소 (기본주소 + 상세주소)
    const fullAddress = addressDetail ? `${address} ${addressDetail}` : address;

    // 선택된 상품의 브랜드 정보 조회
    const selectedItem = menuFull.find(
      (m) => m.productName === selectedCategory && m.option === selectedOption
    );
    const brand = selectedItem?.brand || "";

    const newOrder: IndividualOrderType = {
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      address: fullAddress,
      product_name: selectedCategory || "",
      option: selectedOption || "",
      quantity,
      supply_price: currentSupplyPrice,
      shipping_fee: currentShippingFee,
      brand,
      orderer_name: ordererName || recipientName,  // 주문자명 (없으면 수취인명)
      orderer_phone: ordererPhone || recipientPhone, // 주문자 전화번호 (없으면 수취인 전화번호)
    };

    setOrders([...orders, newOrder]);

    // 폼 초기화
    setRecipientName("");
    setRecipientPhone("");
    setOrdererName("");
    setOrdererPhone("");
    setAddress("");
    setAddressDetail("");
    setZonecode("");
    setQuantity(1);
  };

  // ==== 단일 주소 모드 핸들러들 ====

  // 상품 행 업데이트
  const updateProductRow = (id: number, field: keyof ProductRow, value: string | number) => {
    setProductRows(rows =>
      rows.map(row => {
        if (row.id !== id) return row;

        const updated = { ...row, [field]: value };

        // 카테고리나 옵션 변경 시 가격 정보 업데이트
        if (field === "category") {
          updated.option = "";
          updated.supplyPrice = 0;
          updated.shippingFee = 0;
          updated.brand = "";
        } else if (field === "option") {
          const item = menuFull.find(
            (m) => m.productName === row.category && m.option === value
          );
          if (item) {
            updated.supplyPrice = item.supplyPrice;
            updated.shippingFee = item.shippingFee;
            updated.brand = item.brand;
          }
        }

        return updated;
      })
    );
  };

  // 상품 행 추가
  const addProductRow = () => {
    const newId = Math.max(...productRows.map(r => r.id)) + 1;
    setProductRows([...productRows, {
      id: newId,
      category: "",
      option: "",
      quantity: 1,
      supplyPrice: 0,
      shippingFee: 0,
      brand: ""
    }]);
  };

  // 상품 행 삭제
  const removeProductRow = (id: number) => {
    if (productRows.length <= 1) return; // 최소 1개 유지
    setProductRows(rows => rows.filter(row => row.id !== id));
  };

  // 카테고리별 옵션 목록 가져오기
  const getOptionsForCategory = (category: string) => {
    return menuFull.filter((item) => item.productName === category && item.option);
  };

  // 단일 주소 모드: 모든 상품 행 일괄 주문 추가
  const handleAddAllOrders = () => {
    if (!recipientName || !recipientPhone || !address) {
      alert("수취인명, 전화번호, 주소는 필수입니다");
      return;
    }

    // 유효한 상품 행만 필터링
    const validRows = productRows.filter(row => row.category && row.option);
    if (validRows.length === 0) {
      alert("최소 1개 이상의 상품을 선택해주세요");
      return;
    }

    const fullAddress = addressDetail ? `${address} ${addressDetail}` : address;

    const newOrders: IndividualOrderType[] = validRows.map(row => ({
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      address: fullAddress,
      product_name: row.category,
      option: row.option,
      quantity: row.quantity,
      supply_price: row.supplyPrice,
      shipping_fee: row.shippingFee,
      brand: row.brand,
      orderer_name: ordererName || recipientName,  // 주문자명 (없으면 수취인명)
      orderer_phone: ordererPhone || recipientPhone, // 주문자 전화번호 (없으면 수취인 전화번호)
    }));

    setOrders([...orders, ...newOrders]);

    // 폼 초기화
    setRecipientName("");
    setRecipientPhone("");
    setOrdererName("");
    setOrdererPhone("");
    setAddress("");
    setAddressDetail("");
    setZonecode("");
    setProductRows([{ id: 1, category: "", option: "", quantity: 1, supplyPrice: 0, shippingFee: 0, brand: "" }]);
  };

  // 주문 목록 초기화
  const handleClearOrders = () => {
    setOrders([]);
    setGeneratedOrderDf(null);
  };

  // 발주서 생성 - 모드별 배송비 적용
  // 단일 주소 모드: 그룹(주소+브랜드)별 MAX 배송비만 첫 항목에 부과
  // 다중 주소 모드: 각 주문의 배송비 그대로 적용
  const handleGenerateOrder = () => {
    const today = formatDate("YYYYMMDD");

    let rows: Record<string, string | number>[];

    if (inputMode === "multiple") {
      // 다중 주소 모드: 모든 배송비 독립 적용
      rows = orders.map((order, i) => ({
        "No.": i + 1,
        "수집일자(YYYYMMDD)": today,
        "주문번호(사방넷)": `IND${today}${String(i + 1).padStart(4, "0")}`,
        "주문번호(쇼핑몰)": `개별${String(i + 1).padStart(4, "0")}`,
        "상품코드(쇼핑몰)": "",
        수취인명: order.recipient_name,
        수취인전화번호1: order.recipient_phone,
        "수취인우편번호(1)": "",
        "수취인주소(1)": order.address,
        배송메세지: "",
        "상품명(수집)": order.product_name,
        "옵션(수집)": order.option,
        "옵션(확정)": order.option,
        수량: order.quantity,
        단가: order.supply_price,
        추가비용: "",
        특이사항: "",
        택배사: "",
        송장번호: "",
        택배비: order.shipping_fee, // 다중 모드: 각각 배송비 그대로 적용
        주문자명: order.orderer_name || order.recipient_name,  // K 컬럼
        주문자전화번호1: order.orderer_phone || order.recipient_phone, // L 컬럼
        TEMP5: "",
        비고: "",
        "쇼핑몰명(1)": "개별주문",
        수취인전화번호2: "",
      }));
    } else {
      // 단일 주소 모드: 그룹별 MAX 배송비 계산
      const groupMaxShipping = new Map<string, number>();
      orders.forEach(order => {
        const groupKey = `${order.address}::${order.brand}`;
        const currentMax = groupMaxShipping.get(groupKey) || 0;
        groupMaxShipping.set(groupKey, Math.max(currentMax, order.shipping_fee));
      });

      // 그룹별로 MAX 배송비를 적용받을 첫 항목만 추적
      const processedGroups = new Set<string>();

      rows = orders.map((order, i) => {
        const groupKey = `${order.address}::${order.brand}`;
        const isFirstInGroup = !processedGroups.has(groupKey);
        const maxShippingForGroup = groupMaxShipping.get(groupKey) || 0;
        const appliedShippingFee = isFirstInGroup ? maxShippingForGroup : 0;
        processedGroups.add(groupKey);

        return {
          "No.": i + 1,
          "수집일자(YYYYMMDD)": today,
          "주문번호(사방넷)": `IND${today}${String(i + 1).padStart(4, "0")}`,
          "주문번호(쇼핑몰)": `개별${String(i + 1).padStart(4, "0")}`,
          "상품코드(쇼핑몰)": "",
          수취인명: order.recipient_name,
          수취인전화번호1: order.recipient_phone,
          "수취인우편번호(1)": "",
          "수취인주소(1)": order.address,
          배송메세지: "",
          "상품명(수집)": order.product_name,
          "옵션(수집)": order.option,
          "옵션(확정)": order.option,
          수량: order.quantity,
          단가: order.supply_price,
          추가비용: "",
          특이사항: "",
          택배사: "",
          송장번호: "",
          택배비: appliedShippingFee, // 그룹별 MAX 배송비, 첫 항목에만 적용
          주문자명: order.orderer_name || order.recipient_name,  // K 컬럼
          주문자전화번호1: order.orderer_phone || order.recipient_phone, // L 컬럼
          TEMP5: "",
          비고: isFirstInGroup ? "" : "(동일그룹 배송비 차감)",
          "쇼핑몰명(1)": "개별주문",
          수취인전화번호2: "",
        };
      });
    }

    setGeneratedOrderDf(rows);
  };

  // 서버에 개별주문 저장 (주문확정) - 모드별 배송비 적용
  const handleSaveToServer = async () => {
    if (orders.length === 0) {
      alert("확정할 주문이 없습니다");
      return;
    }

    setSaving(true);
    try {
      let ordersWithAppliedShipping;

      if (inputMode === "multiple") {
        // 다중 주소 모드: 모든 배송비 독립 적용 (중복 제거 없음)
        ordersWithAppliedShipping = orders.map(order => ({
          ...order,
          original_shipping_fee: order.shipping_fee,
          is_shipping_grouped: false,
        }));
      } else {
        // 단일 주소 모드: 그룹별 MAX 배송비 계산 후 첫 항목에만 적용
        const groupMaxShipping = new Map<string, number>();
        orders.forEach(order => {
          const groupKey = `${order.address}::${order.brand}`;
          const currentMax = groupMaxShipping.get(groupKey) || 0;
          groupMaxShipping.set(groupKey, Math.max(currentMax, order.shipping_fee));
        });

        const processedGroups = new Set<string>();
        ordersWithAppliedShipping = orders.map(order => {
          const groupKey = `${order.address}::${order.brand}`;
          const isFirstInGroup = !processedGroups.has(groupKey);
          const maxShippingForGroup = groupMaxShipping.get(groupKey) || 0;
          const appliedShippingFee = isFirstInGroup ? maxShippingForGroup : 0;
          processedGroups.add(groupKey);

          return {
            ...order,
            shipping_fee: appliedShippingFee,
            original_shipping_fee: order.shipping_fee,
            is_shipping_grouped: !isFirstInGroup,
          };
        });
      }

      const result = await saveIndividualOrders(ordersWithAppliedShipping);
      if (result.success) {
        // 저장된 금액 계산
        const totalSaved = ordersWithAppliedShipping.reduce(
          (sum, order) => sum + (order.supply_price * order.quantity) + order.shipping_fee,
          0
        );

        const modeText = inputMode === "multiple" ? "다중 주소" : "단일 주소";
        alert(`✅ ${result.count}건의 주문이 확정되었습니다! (${modeText} 모드)\n\n💰 총 결제 금액: ₩${totalSaved.toLocaleString()}\n\n📌 입금 안내\n하나은행 219-910038-71104 (피코)\n\n❗ 수령인 = 입금자명 일치 필요\n입금 완료 후 발주가 진행됩니다.`);
        setOrders([]); // 저장 후 목록 초기화
        setGeneratedOrderDf(null);
      } else {
        alert(`주문 확정 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`주문 확정 중 오류 발생: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  // 주문 검색 (주문자명, 전화번호로)
  const handleSearchOrders = async () => {
    if (!searchName && !searchPhone) {
      alert("주문자명 또는 전화번호를 입력해주세요");
      return;
    }

    setLoadingSaved(true);
    try {
      const result = await fetchSavedOrders(searchName, searchPhone);
      if (result.success && result.orders) {
        setSavedOrders(result.orders);
        if (result.orders.length === 0) {
          alert("검색 결과가 없습니다");
        }
      } else {
        alert(`검색 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`검색 중 오류 발생: ${error}`);
    } finally {
      setLoadingSaved(false);
    }
  };

  // 개별 주문만 다운로드
  const downloadIndividualOrder = () => {
    if (!generatedOrderDf) return;

    const ws = XLSX.utils.json_to_sheet(generatedOrderDf);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "개별주문");

    const today = formatDate("YYYYMMDD");
    XLSX.writeFile(wb, `${today}_개별주문.xlsx`);
  };

  // 기존 발주서와 합치기
  const handleMergeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !generatedOrderDf) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];

      // 헤더 분리
      const headerRow = existingData[0];
      const dataRows = existingData.slice(1);

      // 개별 주문 데이터를 배열로 변환
      const individualRows = generatedOrderDf.map((row) => Object.values(row));

      // 합치기
      const mergedData = [headerRow, ...dataRows, ...individualRows];

      // 다운로드
      const ws = XLSX.utils.aoa_to_sheet(mergedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "발주서");

      const today = formatDate("YYYYMMDD");
      XLSX.writeFile(wb, `${today}_일반발주서123_합본.xlsx`);
    };
    reader.readAsBinaryString(file);
  };

  // 총 합계 계산 - 모드별 배송비 계산 로직
  // 단일 주소 모드: 그룹(주소+브랜드)별 MAX 배송비 1회만 부과
  // 다중 주소 모드: 각 주문의 배송비 모두 합산 (중복 제거 없음)
  const calculateTotalWithGroupedShipping = () => {
    // 공급가 총합
    const supplyTotal = orders.reduce(
      (sum, order) => sum + (order.supply_price * order.quantity),
      0
    );

    // inputMode에 따라 배송비 계산 방식 결정
    if (inputMode === "multiple") {
      // 다중 주소 모드: 모든 배송비 합산 (중복 제거 없음)
      const shippingTotal = orders.reduce(
        (sum, order) => sum + order.shipping_fee,
        0
      );
      return supplyTotal + shippingTotal;
    } else {
      // 단일 주소 모드: 그룹(주소+브랜드)별 MAX 배송비 1회만 부과
      const groupMaxShipping = new Map<string, number>();

      orders.forEach(order => {
        const groupKey = `${order.address}::${order.brand}`;
        const currentMax = groupMaxShipping.get(groupKey) || 0;
        groupMaxShipping.set(groupKey, Math.max(currentMax, order.shipping_fee));
      });

      // 각 그룹의 MAX 배송비만 합산
      const shippingTotal = Array.from(groupMaxShipping.values()).reduce(
        (sum, fee) => sum + fee,
        0
      );

      return supplyTotal + shippingTotal;
    }
  };

  // 단일 주소 모드: 실시간 예상 배송비 계산 (productRows 기준)
  const calculateSingleModePreview = () => {
    const validRows = productRows.filter(row => row.category && row.option);

    // 공급가 총합
    const supplyTotal = validRows.reduce(
      (sum, row) => sum + (row.supplyPrice * row.quantity),
      0
    );

    // 브랜드별 MAX 배송비 계산
    const brandMaxShipping = new Map<string, number>();
    validRows.forEach(row => {
      if (row.brand) {
        const currentMax = brandMaxShipping.get(row.brand) || 0;
        brandMaxShipping.set(row.brand, Math.max(currentMax, row.shippingFee));
      }
    });

    const shippingTotal = Array.from(brandMaxShipping.values()).reduce(
      (sum, fee) => sum + fee,
      0
    );

    return {
      supplyTotal,
      shippingTotal,
      total: supplyTotal + shippingTotal,
      itemCount: validRows.length,
      totalQuantity: validRows.reduce((sum, row) => sum + row.quantity, 0)
    };
  };

  const totalAmount = calculateTotalWithGroupedShipping();
  const singleModePreview = calculateSingleModePreview();

  return (
    <div className="space-y-8">
      {/* 🔔 오늘 발주 대상 주문 요약 (전일 11:01 ~ 당일 11:00) */}
      <section className="rounded-xl border-2 border-[#58a6ff] bg-gradient-to-r from-[#0d1117] to-[#161b22] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#58a6ff] flex items-center gap-2">
            📊 오늘 발주 대상 주문
          </h2>
          <button
            onClick={fetchTodayOrderSummary}
            disabled={loadingTodaySummary}
            className="rounded-lg bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#8b949e] transition-colors hover:bg-[#30363d] hover:text-[#f0f6fc] disabled:opacity-50"
          >
            {loadingTodaySummary ? "갱신 중..." : "🔄 새로고침"}
          </button>
        </div>

        {todayOrderSummary.timeRange && (
          <p className="text-xs text-[#8b949e] mb-4">
            ⏰ 집계 기간: <span className="text-[#f0f6fc]">{todayOrderSummary.timeRange.startStr}</span> ~ <span className="text-[#f0f6fc]">{todayOrderSummary.timeRange.endStr}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#238636]/10 border border-[#238636]/30 p-4 text-center">
            <p className="text-3xl font-bold text-[#3fb950] mb-1">
              {loadingTodaySummary ? "..." : todayOrderSummary.count}
            </p>
            <p className="text-xs text-[#8b949e]">주문 건수</p>
          </div>
          <div className="rounded-lg bg-[#58a6ff]/10 border border-[#58a6ff]/30 p-4 text-center">
            <p className="text-2xl font-bold text-[#58a6ff] mb-1">
              {loadingTodaySummary ? "..." : `₩${todayOrderSummary.totalAmount.toLocaleString()}`}
            </p>
            <p className="text-xs text-[#8b949e]">예상 결제 금액</p>
          </div>
        </div>

        {todayOrderSummary.count > 0 && (
          <div className="mt-4 pt-4 border-t border-[#30363d]">
            <p className="text-xs text-[#f0883e]">
              ⚠️ 위 주문 건이 오늘 11시 발주에 포함됩니다. 반드시 입금 확인을 완료해주세요.
            </p>
          </div>
        )}
      </section>

      {/* 메뉴판 로드 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">개별 주문 입력</h2>
        <p className="mb-4 text-sm text-[#8b949e]">개별 주문을 직접 입력하여 발주서를 생성합니다</p>

        <div className="flex items-center gap-4">
          <button
            onClick={handleLoadMenu}
            disabled={loadingMenu}
            className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
          >
            {loadingMenu ? "로드 중..." : "메뉴판 데이터 로드"}
          </button>
          {menuFull.length > 0 ? (
            <span className="text-sm text-[#3fb950]">✅ 메뉴판 로드됨: {menuFull.length}개 상품</span>
          ) : (
            <span className="text-sm text-[#f0883e]">⚠️ 오전 11시전까지 꼭 해주셔야합니다</span>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
          <h4 className="mb-2 text-sm font-semibold text-[#c9d1d9]">💡 사용 순서</h4>
          <ol className="list-decimal list-inside text-sm text-[#8b949e] space-y-1">
            <li><span className="text-[#f0f6fc]">메뉴판 데이터 로드</span> 버튼 클릭</li>
            <li>STEP 1에서 <span className="text-[#f0f6fc]">주문 정보 입력</span> (상품명, 수취인 등)</li>
            <li><span className="text-[#f0f6fc]">✅ 주문 추가</span> 버튼 클릭 (여러 건 입력 가능)</li>
            <li>입력이 끝나면 하단의 <span className="text-[#f0f6fc]">✅ 주문확정하기</span> 버튼 클릭 후 금액 입금</li>
          </ol>
        </div>
      </section>

      <div className="border-t border-[#21262d]" />

      {/* STEP 1: 주문 정보 입력 */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-[#c9d1d9]">STEP 1. 주문 정보 입력</h3>

        {/* 메뉴판 미리보기 */}
        {menuFull.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowMenuPreview(!showMenuPreview)}
              className="text-sm text-[#58a6ff] hover:underline"
            >
              {showMenuPreview ? "▼ 메뉴판 미리보기 닫기" : "▶ 📋 메뉴판 미리보기"}
            </button>

            {showMenuPreview && (
              <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-[#30363d] bg-[#161b22]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#21262d]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[#8b949e]">No</th>
                      <th className="px-3 py-2 text-left text-[#8b949e]">상품명</th>
                      <th className="px-3 py-2 text-left text-[#8b949e]">옵션</th>
                      <th className="px-3 py-2 text-left text-[#8b949e]">브랜드</th>
                      <th className="px-3 py-2 text-left text-[#8b949e]">공급가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuFull.map((item, idx) => (
                      <tr key={idx} className="border-t border-[#21262d]">
                        <td className="px-3 py-2 text-[#f0f6fc]">{item.no}</td>
                        <td className="px-3 py-2 text-[#f0f6fc]">{item.productName}</td>
                        <td className="px-3 py-2 text-[#8b949e]">{item.option}</td>
                        <td className="px-3 py-2 text-[#8b949e]">{item.brand}</td>
                        <td className="px-3 py-2 text-[#8b949e]">₩{item.supplyPrice.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-[#6e7681]">전체 {menuFull.length}개 상품</p>
              </div>
            )}
          </div>
        )}

        {/* 주문 정보 입력 폼 */}
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6 space-y-4">

          {/* 입력 모드 선택 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-[#8b949e] mb-3">📦 주문 방식 선택</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setInputMode("single")}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${inputMode === "single"
                  ? "bg-[#238636] text-white ring-2 ring-[#238636] ring-offset-2 ring-offset-[#161b22]"
                  : "bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff] hover:text-[#f0f6fc]"
                  }`}
              >
                <span className="block text-lg mb-1">📍</span>
                <span className="block font-bold">한 곳으로 여러 개</span>
                <span className="block text-xs mt-1 opacity-75">(단일 주소)</span>
              </button>
              <button
                onClick={() => setInputMode("multiple")}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${inputMode === "multiple"
                  ? "bg-[#238636] text-white ring-2 ring-[#238636] ring-offset-2 ring-offset-[#161b22]"
                  : "bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:border-[#58a6ff] hover:text-[#f0f6fc]"
                  }`}
              >
                <span className="block text-lg mb-1">🗺️</span>
                <span className="block font-bold">여러 곳으로 각각</span>
                <span className="block text-xs mt-1 opacity-75">(다중 주소)</span>
              </button>
            </div>
          </div>

          <div className="border-t border-[#30363d] pt-4" />

          {/* ========== 단일 주소 모드 ========== */}
          {inputMode === "single" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[#58a6ff]">📍 배송지 정보 (한 번만 입력)</h4>

              {/* 주문자 정보 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">주문자명</label>
                  <input
                    type="text"
                    value={ordererName}
                    onChange={(e) => setOrdererName(e.target.value)}
                    placeholder="수취인과 동일 시 생략 가능"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">주문자 전화번호</label>
                  <input
                    type="text"
                    value={ordererPhone}
                    onChange={(e) => setOrdererPhone(e.target.value)}
                    placeholder="010-0000-0000 (수취인과 동일 시 생략 가능)"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-[#30363d] pt-4" />

              {/* 수취인 정보 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">수취인명</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">수취인전화번호</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* 주소 검색 */}
              <div>
                <label className="mb-1 block text-sm text-[#8b949e]">배송 주소</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zonecode}
                    readOnly
                    placeholder="우편번호"
                    className="w-28 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:outline-none"
                  />
                  <button
                    onClick={openAddressPopup}
                    className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
                  >
                    🔍 주소 검색
                  </button>
                </div>
              </div>

              {address && (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-[#8b949e]">기본 주소</label>
                    <input
                      type="text"
                      value={address}
                      readOnly
                      className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#f0f6fc] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[#8b949e]">상세 주소</label>
                    <input
                      type="text"
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      placeholder="동/호수 등 상세주소 입력"
                      className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="border-t border-[#30363d] pt-4" />

              {/* 상품 목록 입력 */}
              <h4 className="text-sm font-medium text-[#58a6ff]">🛒 상품 추가 (여러 개 가능)</h4>

              <div className="space-y-3">
                {productRows.map((row, index) => (
                  <div key={row.id} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-[#8b949e]">상품 #{index + 1}</span>
                      {productRows.length > 1 && (
                        <button
                          onClick={() => removeProductRow(row.id)}
                          className="text-[#f85149] hover:text-[#ff7b72] text-sm"
                        >
                          ✕ 삭제
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs text-[#8b949e]">상품명</label>
                        <select
                          value={row.category}
                          onChange={(e) => updateProductRow(row.id, "category", e.target.value)}
                          disabled={menuFull.length === 0}
                          className="w-full rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
                        >
                          <option value="">{menuFull.length > 0 ? "선택" : "메뉴판 로드 필요"}</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-[#8b949e]">옵션</label>
                        <select
                          value={row.option}
                          onChange={(e) => updateProductRow(row.id, "option", e.target.value)}
                          disabled={!row.category}
                          className="w-full rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
                        >
                          <option value="">{row.category ? "선택" : "-"}</option>
                          {getOptionsForCategory(row.category).map((item) => (
                            <option key={item.option} value={item.option}>{item.option}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-[#8b949e]">수량</label>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateProductRow(row.id, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-[#8b949e]">소계</label>
                        <div className="rounded-lg bg-[#388bfd]/10 px-3 py-2 text-sm text-[#58a6ff]">
                          {row.supplyPrice > 0
                            ? `₩${(row.supplyPrice * row.quantity).toLocaleString()}`
                            : "-"}
                        </div>
                      </div>
                    </div>

                    {row.supplyPrice > 0 && (
                      <div className="mt-2 text-xs text-[#8b949e]">
                        공급가 ₩{row.supplyPrice.toLocaleString()} × {row.quantity}개
                        {row.brand && <span className="ml-2 text-[#6e7681]">({row.brand})</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 상품 추가 버튼 */}
              <button
                onClick={addProductRow}
                className="w-full rounded-lg border-2 border-dashed border-[#30363d] py-3 text-sm font-medium text-[#8b949e] transition-colors hover:border-[#58a6ff] hover:text-[#58a6ff]"
              >
                + 상품 추가
              </button>

              {/* 합계 표시 */}
              {/* 🔔 실시간 예상 금액 표시 */}
              {productRows.some(r => r.supplyPrice > 0) && (
                <div className="rounded-xl border-2 border-[#58a6ff] bg-gradient-to-r from-[#58a6ff]/5 to-[#238636]/5 p-5">
                  <h4 className="text-sm font-bold text-[#58a6ff] mb-4 flex items-center gap-2">
                    💰 실시간 예상 결제 금액
                  </h4>

                  <div className="space-y-3">
                    {/* 공급가 합계 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#8b949e]">상품 공급가 합계</span>
                      <span className="text-sm font-medium text-[#f0f6fc]">
                        ₩{singleModePreview.supplyTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* 배송비 그룹화 정보 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#8b949e]">배송비 (브랜드별 MAX 1회)</span>
                        {singleModePreview.itemCount > 1 && (
                          <span className="text-xs text-[#3fb950] bg-[#238636]/20 px-2 py-0.5 rounded-full">
                            {singleModePreview.itemCount - 1}건 차감
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-[#f0883e]">
                        +₩{singleModePreview.shippingTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* 총 결제 예상 금액 */}
                    <div className="border-t border-[#30363d] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-[#f0f6fc]">예상 결제 금액</span>
                        <span className="text-xl font-bold text-[#3fb950]">
                          ₩{singleModePreview.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#6e7681] mt-4">
                    * 동일 주소 + 브랜드 그룹 내 상품의 배송비가 다를 경우, 가장 높은 배송비(MAX)만 1회 적용됩니다.
                  </p>
                </div>
              )}

              {/* 주문 추가 버튼 */}
              <button
                onClick={handleAddAllOrders}
                className="w-full rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                ✅ 주문 목록에 추가
              </button>
            </div>
          )}

          {/* ========== 다중 주소 모드 ========== */}
          {inputMode === "multiple" && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[#f0883e]">🗺️ 각 주문마다 다른 주소 입력</h4>

              {/* 상품 선택 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">상품명</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedOption("");
                    }}
                    disabled={menuFull.length === 0}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{menuFull.length > 0 ? "선택하세요" : "메뉴판 로드 필요"}</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">옵션</label>
                  <select
                    value={selectedOption}
                    onChange={(e) => handleOptionChange(e.target.value)}
                    disabled={!selectedCategory}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{selectedCategory ? "선택하세요" : "상품명 먼저 선택"}</option>
                    {filteredOptions.map((item) => (
                      <option key={item.option} value={item.option}>{item.option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">수량</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* 가격 정보 */}
              {currentSupplyPrice > 0 && (
                <div className="rounded-lg bg-[#388bfd]/10 p-3">
                  <p className="text-sm text-[#58a6ff]">
                    💰 공급가 ₩{currentSupplyPrice.toLocaleString()} × {quantity}개 + 택배비 ₩
                    {currentShippingFee.toLocaleString()} ={" "}
                    <strong>
                      ₩{(currentSupplyPrice * quantity + currentShippingFee).toLocaleString()}
                    </strong>
                  </p>
                </div>
              )}

              {/* 주문자 정보 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">주문자명</label>
                  <input
                    type="text"
                    value={ordererName}
                    onChange={(e) => setOrdererName(e.target.value)}
                    placeholder="수취인과 동일 시 생략 가능"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">주문자 전화번호</label>
                  <input
                    type="text"
                    value={ordererPhone}
                    onChange={(e) => setOrdererPhone(e.target.value)}
                    placeholder="010-0000-0000 (수취인과 동일 시 생략 가능)"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-[#30363d] pt-4" />

              {/* 수취인 정보 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">수취인명</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">수취인전화번호</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* 주소 검색 */}
              <div>
                <label className="mb-1 block text-sm text-[#8b949e]">배송 주소</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zonecode}
                    readOnly
                    placeholder="우편번호"
                    className="w-28 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:outline-none"
                  />
                  <button
                    onClick={openAddressPopup}
                    className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
                  >
                    🔍 주소 검색
                  </button>
                </div>
              </div>

              {/* 기본 주소 */}
              {address && (
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">기본 주소</label>
                  <input
                    type="text"
                    value={address}
                    readOnly
                    className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#f0f6fc] focus:outline-none"
                  />
                </div>
              )}

              {/* 상세 주소 */}
              {address && (
                <div>
                  <label className="mb-1 block text-sm text-[#8b949e]">상세 주소</label>
                  <input
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="동/호수 등 상세주소 입력"
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                  />
                </div>
              )}

              {/* 주문 추가 버튼 */}
              <button
                onClick={handleAddOrder}
                className="w-full rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                ✅ 주문 추가
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 추가된 주문 목록 */}
      {orders.length > 0 && (
        <>
          <div className="border-t border-[#21262d]" />

          <section>
            <h4 className="mb-4 text-sm font-medium text-[#8b949e]">📋 추가된 주문 목록</h4>

            <div className="overflow-auto rounded-xl border border-[#30363d] bg-[#161b22]">
              <table className="w-full text-sm">
                <thead className="bg-[#21262d]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#8b949e]">수취인명</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">전화번호</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">상품명</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">옵션</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">브랜드</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">수량</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">배송비</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // 동일 주소+브랜드 그룹의 첫 번째 주문만 배송비 적용
                    const processedGroups = new Set<string>();

                    return orders.map((order, idx) => {
                      const groupKey = `${order.address}::${order.brand}`;
                      const isFirstInGroup = !processedGroups.has(groupKey);
                      const appliedShippingFee = isFirstInGroup ? order.shipping_fee : 0;
                      processedGroups.add(groupKey);

                      const orderTotal = order.supply_price * order.quantity + appliedShippingFee;

                      return (
                        <tr key={idx} className="border-t border-[#21262d]">
                          <td className="px-4 py-3 text-[#f0f6fc]">{order.recipient_name}</td>
                          <td className="px-4 py-3 text-[#8b949e]">{order.recipient_phone}</td>
                          <td className="px-4 py-3 text-[#8b949e]">{order.product_name}</td>
                          <td className="px-4 py-3 text-[#8b949e]">{order.option}</td>
                          <td className="px-4 py-3 text-[#8b949e]">{order.brand}</td>
                          <td className="px-4 py-3 text-[#8b949e]">{order.quantity}</td>
                          <td className="px-4 py-3">
                            {isFirstInGroup ? (
                              <span className="text-[#f0f6fc]">₩{order.shipping_fee.toLocaleString()}</span>
                            ) : (
                              <span className="text-[#3fb950]">₩0 (차감)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#f0f6fc]">₩{orderTotal.toLocaleString()}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3">
                <span className="text-sm text-[#8b949e]">총 합계:</span>
                <span className="ml-2 text-xl font-bold text-[#f0f6fc]">
                  ₩{totalAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClearOrders}
                  className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm text-[#c9d1d9] transition-colors hover:border-[#8b949e]"
                >
                  목록 초기화
                </button>
                <button
                  onClick={handleSaveToServer}
                  disabled={saving}
                  className="rounded-lg bg-[#238636] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
                >
                  {saving ? "처리 중..." : "✅ 주문확정하기"}
                </button>
              </div>
            </div>

            {/* 입금 안내 */}
            <div className="mt-4 rounded-xl border-2 border-[#f78166] bg-[#f78166]/10 p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏦</span>
                <div>
                  <p className="font-bold text-[#f78166] text-base mb-2">
                    ⚠️ 주문 후 입금해야 발주됩니다!
                  </p>
                  <div className="bg-[#21262d] rounded-lg p-3 mb-3">
                    <p className="text-[#f0f6fc] font-mono text-lg font-bold">
                      하나은행 219-910038-71104
                    </p>
                    <p className="text-[#8b949e] text-sm mt-1">예금주: 피코</p>
                  </div>
                  <p className="text-[#f0883e] text-sm font-medium">
                    ❗ 수령인 = 입금자명 일치 필요
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* STEP 2: 기존 발주서와 합치기 */}
      {generatedOrderDf && (
        <>
          <div className="border-t border-[#21262d]" />

          <section>
            <h3 className="mb-4 text-base font-semibold text-[#c9d1d9]">STEP 2. 기존 발주서와 합치기</h3>

            <div className="rounded-lg bg-[#388bfd]/10 p-4 mb-4">
              <p className="text-sm text-[#58a6ff]">
                ✅ 개별 주문 {generatedOrderDf.length}건이 생성되었습니다
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={downloadIndividualOrder}
                className="rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                개별 주문만 다운로드
              </button>
              <div />
            </div>

            <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6">
              <h4 className="mb-4 text-sm font-medium text-[#8b949e]">
                기존 일반발주서123과 합치기
              </h4>
              <div
                onClick={() => mergeFileRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-[#30363d] p-6 text-center transition-colors hover:border-[#58a6ff]/50"
              >
                <input
                  ref={mergeFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleMergeFile}
                  className="hidden"
                />
                <p className="text-sm text-[#8b949e]">기존 일반발주서123 업로드</p>
                <p className="mt-1 text-xs text-[#6e7681]">
                  업로드하면 자동으로 합쳐진 파일이 다운로드됩니다
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* 관리자용: 저장된 개별주문 검색 */}
      <div className="border-t border-[#21262d]" />

      <section>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[#c9d1d9]">🔍 저장된 개별주문 검색</h3>
          <p className="text-sm text-[#8b949e] mt-1">
            주문자명과 전화번호를 입력하여 과거 주문 내역을 검색합니다
          </p>
        </div>

        {/* 검색 폼 */}
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 mb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-[#8b949e]">주문자명</label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="홍길동"
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#8b949e]">전화번호</label>
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSearchOrders}
                disabled={loadingSaved || (!searchName && !searchPhone)}
                className="w-full rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4493f8] disabled:opacity-50"
              >
                {loadingSaved ? "검색 중..." : "🔍 검색"}
              </button>
            </div>
          </div>
        </div>

        {savedOrders.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#238636]/10 border border-[#238636]/30 p-4">
              <p className="text-sm text-[#3fb950]">
                ✅ {savedOrders.length}건의 주문을 찾았습니다
              </p>
            </div>

            <div className="overflow-auto rounded-xl border border-[#30363d] bg-[#161b22]">
              <table className="w-full text-sm">
                <thead className="bg-[#21262d]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#8b949e]">저장시간</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">수취인명</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">전화번호</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">상품명</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">옵션</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">수량</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {savedOrders.map((order, idx) => (
                    <tr key={idx} className="border-t border-[#21262d]">
                      <td className="px-4 py-3 text-[#8b949e] text-xs">{order.saved_time}</td>
                      <td className="px-4 py-3 text-[#f0f6fc]">{order.recipient_name}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.recipient_phone}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.product_name}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.option}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.quantity}</td>
                      <td className="px-4 py-3 text-[#f0f6fc]">₩{order.total?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // 저장된 주문을 발주서 형식으로 변환 후 다운로드
                  const today = formatDate("YYYYMMDD");
                  const rows = savedOrders.map((order, i) => ({
                    "No.": i + 1,
                    "수집일자(YYYYMMDD)": today,
                    "주문번호(사방넷)": `IND${today}${String(i + 1).padStart(4, "0")}`,
                    "주문번호(쇼핑몰)": `개별${String(i + 1).padStart(4, "0")}`,
                    "상품코드(쇼핑몰)": "",
                    수취인명: order.recipient_name,
                    수취인전화번호1: order.recipient_phone,
                    "수취인우편번호(1)": "",
                    "수취인주소(1)": order.address,
                    배송메세지: "",
                    "상품명(수집)": order.product_name,
                    "옵션(수집)": order.option,
                    "옵션(확정)": order.option,
                    수량: order.quantity,
                    단가: order.supply_price,
                    추가비용: "",
                    특이사항: "",
                    택배사: "",
                    송장번호: "",
                    택배비: order.shipping_fee,
                    주문자명: order.orderer_name || order.recipient_name,  // K 컬럼
                    주문자전화번호1: order.orderer_phone || order.recipient_phone, // L 컬럼
                    TEMP5: "",
                    비고: "",
                    "쇼핑몰명(1)": "개별주문",
                    수취인전화번호2: "",
                  }));

                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "개별주문");
                  XLSX.writeFile(wb, `${today}_저장된_개별주문.xlsx`);
                }}
                className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                📥 검색결과 다운로드
              </button>
              <button
                onClick={() => setSavedOrders([])}
                className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm text-[#c9d1d9] transition-colors hover:border-[#8b949e]"
              >
                검색결과 초기화
              </button>
            </div>
          </div>
        )}

        {savedOrders.length === 0 && (
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
            <p className="text-[#8b949e]">
              주문자명과 전화번호를 입력 후 &apos;검색&apos; 버튼을 눌러주세요
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
