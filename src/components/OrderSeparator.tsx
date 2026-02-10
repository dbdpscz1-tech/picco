"use client";

import { useState, useRef, useEffect } from "react";
import { findBrand, formatDate, fetchSavedOrders, updateOrderStatus, type SavedOrder } from "@/lib/api";
import type { MenuDict, ProcessedResults, OrderData } from "@/lib/types";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface OrderSeparatorProps {
  menuData: MenuDict;
  processedResults: ProcessedResults | null;
  setProcessedResults: (results: ProcessedResults | null) => void;
}

export default function OrderSeparator({
  menuData,
  processedResults,
  setProcessedResults,
}: OrderSeparatorProps) {
  const [sourceData, setSourceData] = useState<(string | number | null)[][] | null>(null);
  const [sourceFilename, setSourceFilename] = useState("");
  const [orderDate, setOrderDate] = useState(formatDate("YYYYMMDD"));
  const [invoiceResult, setInvoiceResult] = useState<(string | number | null)[][] | null>(null);
  const [invoiceMatched, setInvoiceMatched] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewBrand, setPreviewBrand] = useState<string>("");
  const [previewOrders, setPreviewOrders] = useState<OrderData[]>([]);

  // 미발주 주문 상태
  const [individualOrders, setIndividualOrders] = useState<SavedOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // 🔀 데이터 병합 상태
  const [mergedData, setMergedData] = useState<(string | number | null)[][] | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // 미발주 주문 선택 상태
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [completingOrders, setCompletingOrders] = useState(false);

  // 미리보기 열기
  const openPreview = (brand: string, orders: OrderData[]) => {
    setPreviewBrand(brand);
    setPreviewOrders(orders);
    setShowPreviewModal(true);
  };

  // 미리보기 닫기
  const closePreview = () => {
    setShowPreviewModal(false);
    setPreviewBrand("");
    setPreviewOrders([]);
  };

  // 📋 미발주 주문 데이터 조회 (M 칼럼이 비어있거나 '발주완료'가 아닌 항목만)
  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    try {
      const result = await fetchSavedOrders();
      if (result.success && result.orders) {
        // M 칼럼 상태 필터링만 적용: '발주완료'가 아닌 항목만 (비어있는 항목 포함)
        // 시간/날짜 필터 완전 제거 - saved_time 체크도 제거
        const filtered = result.orders.filter(order => {
          // 상태가 '발주완료'가 아닌 항목만 (비어있거나 다른 값 모두 포함)
          const status = order.status || "";
          return status !== "발주완료";
        });
        setIndividualOrders(filtered);
        // 선택 상태 초기화
        setSelectedOrderIds(new Set());
      }
    } catch (error) {
      console.error("미발주 주문 조회 실패:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // 발주서 처리 함수
  const processOrders = (
    data: (string | number | null)[][],
    menu: MenuDict
  ): ProcessedResults => {
    const results: ProcessedResults = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || String(row[0]).trim() === "") continue;

      const opt1 = row[11] ? String(row[11]) : "";
      const opt2 = row[12] ? String(row[12]) : "";
      let qty = 1;
      try {
        qty = row[13] ? parseInt(String(row[13])) || 1 : 1;
      } catch {
        qty = 1;
      }

      const brand = findBrand(opt1, opt2, menu);
      const rowData = row.slice(1, 21);

      // 연락처 보정
      if (!rowData[5] || String(rowData[5]).trim() === "") {
        if (row[21]) rowData[5] = String(row[21]).trim();
        else if (row[25]) rowData[5] = String(row[25]).trim();
      }

      if (!results[brand]) results[brand] = [];
      results[brand].push({
        data: rowData,
        qty,
        opt: opt2.slice(0, 40),
      });
    }

    return results;
  };

  // 파일 업로드 처리
  const handleSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];

      setSourceData(jsonData);
      setSourceFilename(file.name);

      // 파일명에서 날짜 추출
      const dateMatch = file.name.match(/(\d{8})/);
      if (dateMatch) {
        setOrderDate(dateMatch[1]);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 체크박스 선택/해제 핸들러
  const handleToggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  // 전체 선택/해제 핸들러
  const handleToggleAll = () => {
    if (selectedOrderIds.size === individualOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(individualOrders.map(o => o.saved_time)));
    }
  };

  // 발주 완료 처리
  const handleCompleteOrders = async () => {
    if (selectedOrderIds.size === 0) {
      alert("발주 완료할 주문을 선택해주세요");
      return;
    }

    if (!confirm(`선택한 ${selectedOrderIds.size}건의 주문을 발주 완료 처리하시겠습니까?`)) {
      return;
    }

    setCompletingOrders(true);
    try {
      const orderIds = Array.from(selectedOrderIds);
      const result = await updateOrderStatus(orderIds, "발주완료");
      
      if (result.success) {
        // 즉시 화면에서 제거 (필터링)
        setIndividualOrders(prevOrders => 
          prevOrders.filter(order => !selectedOrderIds.has(order.saved_time))
        );
        // 선택 상태 초기화
        setSelectedOrderIds(new Set());
        alert(`✅ ${result.count || orderIds.length}건의 주문이 발주 완료 처리되었습니다.`);
      } else {
        alert(`발주 완료 처리 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`발주 완료 처리 중 오류 발생: ${error}`);
    } finally {
      setCompletingOrders(false);
    }
  };

  // 🔀 Step 2: 데이터 병합 (원본 발주서 + 선택된 개별주문)
  // 개별 주문은 fetchOrdersByDate에서 11시 기준으로 필터링된 주문들입니다.
  // 각 주문의 생성 시각(createdAt)이 11시 이전이면 당일, 11시 이후면 다음날 발주에 포함됩니다.
  const handleMergeData = () => {
    if (!sourceData) {
      alert("먼저 원본 발주서를 업로드하세요");
      return;
    }

    // 선택된 주문이 없으면 전체 사용, 있으면 선택된 것만 사용
    const ordersToMerge = selectedOrderIds.size > 0
      ? individualOrders.filter(o => selectedOrderIds.has(o.saved_time))
      : individualOrders;

    if (ordersToMerge.length === 0) {
      alert("병합할 개별 주문이 없습니다");
      return;
    }

    // 헤더 분리
    const header = sourceData[0];
    const originalRows = sourceData.slice(1);

    // 개별주문을 원본 발주서 형식에 맞게 변환
    // 배송비 중복 제거 로직 적용 (동일 주소+브랜드 그룹에서 MAX 배송비만)
    // 참고: ordersToMerge는 선택된 주문 또는 전체 주문입니다.
    const brandMaxShipping = new Map<string, number>();
    ordersToMerge.forEach(order => {
      // 브랜드 찾기 - 상품명에서 추출 또는 메뉴 데이터 활용
      const brand = findBrand(order.product_name, order.option, menuData);
      const groupKey = `${order.address}::${brand}`;
      const currentMax = brandMaxShipping.get(groupKey) || 0;
      brandMaxShipping.set(groupKey, Math.max(currentMax, order.shipping_fee));
    });

    const processedGroups = new Set<string>();
    const individualRows: (string | number | null)[][] = ordersToMerge.map((order, idx) => {
      const brand = findBrand(order.product_name, order.option, menuData);
      const groupKey = `${order.address}::${brand}`;
      const isFirstInGroup = !processedGroups.has(groupKey);
      const maxShippingForGroup = brandMaxShipping.get(groupKey) || 0;
      const appliedShippingFee = isFirstInGroup ? maxShippingForGroup : 0;
      processedGroups.add(groupKey);

        // 원본 발주서 형식에 맞게 데이터 생성 (20개 컬럼 기준)
        const today = formatDate("YYYYMMDD");
        return [
          originalRows.length + idx + 1,         // No.
          today,                                  // 발주일
          `IND${today}${String(idx + 1).padStart(4, "0")}`, // 주문번호
          `개별${String(idx + 1).padStart(4, "0")}`, // 주문번호(쇼핑)
          "",                                     // 상품코드
          order.recipient_name,                   // 이름
          order.recipient_phone,                  // 수취인전화번호1
          "",                                     // 우편번호
          order.address,                          // 주소
          "",                                     // 배송메세지
          order.product_name,                     // 상품명
          order.option,                           // 옵션1
          order.option,                           // 옵션2
          order.quantity,                         // 수량
          order.supply_price,                     // 단가
          "",                                     // 추가비용
          "",                                     // 특이사항
          "",                                     // 택배사
          "",                                     // 운송장
          appliedShippingFee,                     // 택배비 (그룹별 MAX)
          order.orderer_name || order.recipient_name,  // 보내는사람 (주문자명 또는 수취인명)
        ];
    });

    // 원본 + 개별주문 병합
    const merged: (string | number | null)[][] = [header, ...originalRows, ...individualRows];
    setMergedData(merged);
    setCurrentStep(2);

    alert(`✅ 데이터 병합 완료!\n\n📊 원본 발주서: ${originalRows.length}건\n📝 개별 주문: ${ordersToMerge.length}건\n📦 총 병합: ${originalRows.length + ordersToMerge.length}건`);
  };

  // 🏷️ Step 3: 브랜드별 분리 실행 (병합 데이터 기준)
  const handleSeparate = () => {
    const dataToProcess = mergedData || sourceData;
    if (!dataToProcess || Object.keys(menuData).length === 0) {
      alert("처리할 데이터가 없습니다. 원본 발주서를 먼저 업로드하세요.");
      return;
    }
    const results = processOrders(dataToProcess, menuData);
    setProcessedResults(results);
    setCurrentStep(3);
  };

  // 엑셀 다운로드 (스타일링 포함 - ExcelJS 사용)
  const downloadExcel = async (brand: string, orders: OrderData[]) => {
    const header = [
      "순번", "발주일", "주문번호", "주문번호(쇼핑)", "상품코드", "이름",
      "수취인전화번호1", "우편번호", "주소", "배송메세지", "상품명",
      "옵션1", "옵션2", "수량", "단가", "추가비용", "특이사항",
      "택배사", "운송장", "택배비", "보내는사람"
    ];

    const rows = orders.map((order, idx) => {
      const row: (string | number | null)[] = [idx + 1, ...order.data];
      return row;
    });

    const useHeader = header.slice(0, rows[0]?.length || header.length);

    // 이름 열(6번째)에서 중복 찾기
    const names = rows.map((row) => row[5]);
    const nameCounts: Record<string, number> = {};
    names.forEach((name) => {
      const n = String(name || "");
      nameCounts[n] = (nameCounts[n] || 0) + 1;
    });
    const duplicateNames = new Set(
      Object.entries(nameCounts)
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    );

    // ExcelJS 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("발주서");

    // 헤더 추가
    worksheet.addRow(useHeader);

    // 데이터 행 추가
    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    // 스타일 정의
    const headerFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3C72" },
    };

    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };

    const duplicateFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB9C" },
    };

    // 헤더 스타일 적용
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // 데이터 행 스타일 적용
    for (let i = 2; i <= rows.length + 1; i++) {
      const row = worksheet.getRow(i);
      const rowName = String(rows[i - 2]?.[5] || "");
      const isDuplicate = duplicateNames.has(rowName);

      row.eachCell((cell) => {
        cell.border = thinBorder;
        if (isDuplicate) {
          cell.fill = duplicateFill;
        }
      });
    }

    // 열 너비 설정
    worksheet.columns = useHeader.map((_, idx) => {
      if (idx === 8) return { width: 40 }; // 주소
      if (idx === 10 || idx === 11 || idx === 12) return { width: 25 }; // 상품명, 옵션
      return { width: 12 };
    });

    // 파일 저장
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const filename = `${orderDate}_주문서확인처리_${brand.replace(/\//g, "_")}.xlsx`;
    saveAs(blob, filename);
  };

  // 송장 입력 처리
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !sourceData) return;

    const invoiceDict: Record<string, string> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = (event) => {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];

          for (let j = 1; j < jsonData.length; j++) {
            const row = jsonData[j];
            const orderNum = row[2] ? String(row[2]).trim() : "";
            const invoice = row[18] ? String(row[18]).trim() : "";
            if (orderNum && invoice && orderNum !== "nan" && invoice !== "nan") {
              invoiceDict[orderNum] = invoice;
            }
          }
          resolve();
        };
        reader.readAsBinaryString(file);
      });
    }

    if (Object.keys(invoiceDict).length > 0) {
      const resultData = sourceData.map((row, idx) => {
        if (idx === 0) return [...row];
        const newRow = [...row];
        const orderNum = row[2] ? String(row[2]).trim() : "";
        if (invoiceDict[orderNum]) {
          newRow[18] = invoiceDict[orderNum];
        }
        return newRow;
      });

      const matched = Object.keys(invoiceDict).length;
      setInvoiceResult(resultData);
      setInvoiceMatched(matched);
    }
  };

  // 송장 입력된 파일 다운로드 (스타일링 포함)
  const downloadInvoiceResult = async () => {
    if (!invoiceResult) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("발주서");

    // 데이터 추가
    invoiceResult.forEach((row) => {
      worksheet.addRow(row);
    });

    // 스타일 정의
    const headerFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3C72" },
    };

    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    const invoiceOkFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6EFCE" },
    };

    // 헤더 스타일 적용
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    // 송장번호 입력된 행 하이라이트
    for (let i = 2; i <= invoiceResult.length; i++) {
      const row = worksheet.getRow(i);
      const invoiceCell = row.getCell(19); // 송장번호 열 (19번째)
      const invoiceValue = invoiceCell.value;
      if (invoiceValue && String(invoiceValue).trim() && String(invoiceValue) !== "nan") {
        invoiceCell.fill = invoiceOkFill;
      }
    }

    // 파일 저장
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const baseName = sourceFilename.replace(/\.xlsx?$/i, "");
    const filename = baseName.includes("송장입력완료")
      ? `${baseName}.xlsx`
      : `${baseName}_송장입력완료.xlsx`;
    saveAs(blob, filename);
  };

  return (
    <div className="space-y-8">
      {/* 📋 발주 대상 주문 조회 */}
      <section className="rounded-xl border-2 border-[#58a6ff] bg-gradient-to-r from-[#0d1117] to-[#161b22] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#58a6ff] flex items-center gap-2">
            📋 발주 대상 주문 조회
          </h2>
          <button
            onClick={fetchPendingOrders}
            disabled={loadingOrders}
            className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
          >
            {loadingOrders ? "조회 중..." : "🔄 미발주 주문 조회"}
          </button>
        </div>

        {/* 대기 건수 노출 - 리스트 개수 명시 */}
        {individualOrders.length > 0 ? (
          <div className="mb-4 rounded-lg bg-[#21262d] p-4">
            <p className="text-base font-semibold text-[#f0f6fc]">
              현재 발주 대기 중인 주문은 총 <span className="text-[#3fb950] text-xl font-bold">{individualOrders.length}</span>건입니다
            </p>
            <p className="text-xs text-[#8b949e] mt-2">
              💡 M 칼럼이 비어있거나 '발주완료'가 아닌 주문만 표시됩니다. (시간/날짜 필터 없음)
            </p>
            <p className="text-xs text-[#58a6ff] mt-1 font-mono">
              📊 리스트 개수: {individualOrders.length}개
            </p>
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-[#21262d] p-4 text-center">
            <p className="text-base font-semibold text-[#8b949e]">
              현재 발주 대기 중인 주문 건이 없습니다.
            </p>
            <p className="text-xs text-[#6e7681] mt-2">
              💡 모든 주문이 발주 완료되었거나, 미발주 주문 조회 버튼을 눌러주세요.
            </p>
            <p className="text-xs text-[#58a6ff] mt-1 font-mono">
              📊 리스트 개수: 0개
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#238636]/10 border border-[#238636]/30 p-4 text-center">
            <p className="text-3xl font-bold text-[#3fb950] mb-1">
              {loadingOrders ? "..." : individualOrders.length}
            </p>
            <p className="text-xs text-[#8b949e]">미발주 주문 건수</p>
          </div>
          <div className="rounded-lg bg-[#58a6ff]/10 border border-[#58a6ff]/30 p-4 text-center">
            <p className="text-2xl font-bold text-[#58a6ff] mb-1">
              {loadingOrders ? "..." : `₩${individualOrders.reduce((sum, o) => sum + (o.supply_price * o.quantity) + o.shipping_fee, 0).toLocaleString()}`}
            </p>
            <p className="text-xs text-[#8b949e]">예상 결제 금액</p>
          </div>
        </div>

        {/* 미발주 주문 목록 */}
        {individualOrders.length > 0 ? (
          <div className="mt-6 rounded-xl border border-[#30363d] bg-[#161b22]">
            <div className="border-b border-[#30363d] bg-[#21262d] px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#c9d1d9]">📋 미발주 주문 목록</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleAll}
                  className="text-xs text-[#58a6ff] hover:underline"
                >
                  {selectedOrderIds.size === individualOrders.length ? "전체 해제" : "전체 선택"}
                </button>
                {selectedOrderIds.size > 0 && (
                  <button
                    onClick={handleCompleteOrders}
                    disabled={completingOrders}
                    className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
                  >
                    {completingOrders ? "처리 중..." : `✅ 발주완료 처리 (${selectedOrderIds.size}건)`}
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#21262d]">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.size === individualOrders.length && individualOrders.length > 0}
                        onChange={handleToggleAll}
                        className="rounded border-[#30363d] bg-[#0d1117] text-[#238636] focus:ring-[#238636]"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-[#8b949e]">수취인명</th>
                    <th className="px-4 py-2 text-left text-[#8b949e]">전화번호</th>
                    <th className="px-4 py-2 text-left text-[#8b949e]">상품명</th>
                    <th className="px-4 py-2 text-left text-[#8b949e]">옵션</th>
                    <th className="px-4 py-2 text-left text-[#8b949e]">수량</th>
                    <th className="px-4 py-2 text-right text-[#8b949e]">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {individualOrders.map((order, idx) => (
                    <tr
                      key={order.saved_time}
                      className={`border-t border-[#21262d] hover:bg-[#21262d] ${
                        selectedOrderIds.has(order.saved_time) ? "bg-[#238636]/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.saved_time)}
                          onChange={() => handleToggleOrder(order.saved_time)}
                          className="rounded border-[#30363d] bg-[#0d1117] text-[#238636] focus:ring-[#238636]"
                        />
                      </td>
                      <td className="px-4 py-3 text-[#f0f6fc]">{order.recipient_name}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.recipient_phone}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.product_name}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.option}</td>
                      <td className="px-4 py-3 text-[#8b949e]">{order.quantity}</td>
                      <td className="px-4 py-3 text-right text-[#f0f6fc]">
                        ₩{((order.supply_price * order.quantity) + order.shipping_fee).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* 3단계 진행 표시 */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${currentStep >= 1 ? 'bg-[#238636]/20 text-[#3fb950]' : 'bg-[#21262d] text-[#8b949e]'}`}>
          <span className="font-bold">1</span>
          <span className="text-sm">업로드</span>
        </div>
        <div className="text-[#30363d]">→</div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${currentStep >= 2 ? 'bg-[#238636]/20 text-[#3fb950]' : 'bg-[#21262d] text-[#8b949e]'}`}>
          <span className="font-bold">2</span>
          <span className="text-sm">병합</span>
        </div>
        <div className="text-[#30363d]">→</div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${currentStep >= 3 ? 'bg-[#238636]/20 text-[#3fb950]' : 'bg-[#21262d] text-[#8b949e]'}`}>
          <span className="font-bold">3</span>
          <span className="text-sm">분리/다운로드</span>
        </div>
      </div>

      <div className="border-t border-[#21262d]" />

      {/* Step 1: 원본 발주서 업로드 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9] flex items-center gap-2">
          <span className="bg-[#238636] text-white text-xs px-2 py-1 rounded">Step 1</span>
          원본 발주서 업로드
        </h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-[#30363d] bg-[#161b22] p-8 text-center transition-colors hover:border-[#58a6ff]/50"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleSourceUpload}
            className="hidden"
          />
          <div className="mb-3 text-4xl">📁</div>
          <p className="text-[#8b949e]">일반 발주서123 파일을 업로드하세요</p>
          <p className="mt-1 text-xs text-[#6e7681]">.xlsx, .xls 파일 지원</p>
        </div>

        {sourceData && (
          <div className="mt-4 rounded-lg border border-[#238636] bg-[#238636]/10 p-4">
            <p className="text-sm text-[#3fb950]">
              ✅ 원본 발주서 로드됨: {sourceData.length - 1}건
            </p>
          </div>
        )}
      </section>

      <div className="border-t border-[#21262d]" />

      {/* Step 2: 데이터 병합 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9] flex items-center gap-2">
          <span className={`text-white text-xs px-2 py-1 rounded ${sourceData ? 'bg-[#238636]' : 'bg-[#6e7681]'}`}>Step 2</span>
          데이터 병합 (원본 + 개별주문)
        </h2>

        <p className="mb-4 text-sm text-[#8b949e]">
          원본 발주서 데이터와 선택한 개별 주문을 병합합니다.
          {selectedOrderIds.size > 0 ? (
            <span className="text-[#3fb950] font-medium"> 선택된 {selectedOrderIds.size}건</span>
          ) : (
            <span className="text-[#f0883e]"> ⚠️ 주문을 선택해주세요</span>
          )}
          <br />
          <span className="text-[#f0883e]">* 동일 주소+브랜드 그룹에서 MAX 배송비 1회만 적용됩니다.</span>
          <br />
          <span className="text-[#6e7681] text-xs">* 미발주 주문 조회 버튼을 눌러 주문 목록을 불러온 후, 체크박스로 선택한 주문만 병합됩니다.</span>
        </p>

        {sourceData && individualOrders.length > 0 && selectedOrderIds.size > 0 ? (
          <button
            onClick={handleMergeData}
            className="w-full rounded-lg bg-[#58a6ff] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#388bfd]"
          >
            🔀 데이터 병합 실행 (원본 {sourceData.length - 1}건 + 개별 {selectedOrderIds.size}건)
          </button>
        ) : (
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-center text-sm text-[#8b949e]">
            {!sourceData
              ? "Step 1에서 원본 발주서를 먼저 업로드하세요"
              : individualOrders.length === 0
                ? "미발주 주문 조회 버튼을 눌러 주문을 불러오세요"
                : selectedOrderIds.size === 0
                  ? "위 목록에서 병합할 주문을 선택해주세요"
                  : "병합 준비 완료"}
          </div>
        )}

        {mergedData && (
          <div className="mt-4 rounded-lg border border-[#58a6ff] bg-[#58a6ff]/10 p-4">
            <p className="text-sm text-[#58a6ff]">
              ✅ 병합 완료: 총 {mergedData.length - 1}건
            </p>
          </div>
        )}
      </section>

      <div className="border-t border-[#21262d]" />

      {/* Step 3: 브랜드별 분리 및 다운로드 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9] flex items-center gap-2">
          <span className={`text-white text-xs px-2 py-1 rounded ${mergedData || sourceData ? 'bg-[#238636]' : 'bg-[#6e7681]'}`}>Step 3</span>
          브랜드별 분리 및 다운로드
        </h2>

        {(mergedData || sourceData) && Object.keys(menuData).length > 0 ? (
          <button
            onClick={handleSeparate}
            className="w-full rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
          >
            🏷️ 브랜드별 분리 실행 ({mergedData ? '병합 데이터' : '원본 데이터'} 기준)
          </button>
        ) : (
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-center text-sm text-[#8b949e]">
            {!(mergedData || sourceData)
              ? "먼저 데이터를 업로드하거나 병합하세요"
              : "대시보드 탭에서 메뉴판을 먼저 로드하세요"}
          </div>
        )}

        {processedResults && Object.keys(processedResults).length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-[#238636] bg-[#238636]/10 p-4 flex items-center justify-between">
              <p className="text-sm text-[#3fb950]">✅ 분리 완료!</p>
              {selectedOrderIds.size > 0 && (
                <button
                  onClick={handleCompleteOrders}
                  disabled={completingOrders}
                  className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
                >
                  {completingOrders ? "처리 중..." : `✅ 발주완료 처리 (${selectedOrderIds.size}건)`}
                </button>
              )}
            </div>

            {/* 공급처별 발주 현황 테이블 */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-[#8b949e]">
                공급처별 발주 현황 (2중 체크용)
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]">
                <table className="w-full text-sm">
                  <thead className="bg-[#21262d]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[#8b949e]">공급처</th>
                      <th className="px-4 py-3 text-left text-[#8b949e]">주문건수</th>
                      <th className="px-4 py-3 text-left text-[#8b949e]">총수량</th>
                      <th className="px-4 py-3 text-left text-[#8b949e]">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(processedResults)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([brand, orders]) => {
                        const totalQty = orders.reduce((sum, o) => sum + o.qty, 0);
                        return (
                          <tr key={brand} className="border-t border-[#21262d]">
                            <td className="px-4 py-3 text-[#f0f6fc]">{brand}</td>
                            <td className="px-4 py-3 text-[#8b949e]">{orders.length}건</td>
                            <td className="px-4 py-3 text-[#8b949e]">{totalQty}개</td>
                            <td className="px-4 py-3">
                              {brand === "미분류" ? (
                                <span className="text-[#f0883e]">⚠️ 확인필요</span>
                              ) : (
                                <span className="text-[#3fb950]">✅</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 파일 다운로드 및 미리보기 버튼들 */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-[#8b949e]">파일 미리보기 / 다운로드</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(processedResults)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([brand, orders]) => {
                    const totalQty = orders.reduce((sum, o) => sum + o.qty, 0);
                    const icon = brand === "미분류" ? "⚠️" : "📄";
                    return (
                      <div
                        key={brand}
                        className={`rounded-lg border p-4 ${brand === "미분류"
                          ? "border-[#f0883e] bg-[#f0883e]/10"
                          : "border-[#30363d] bg-[#21262d]"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium text-[#f0f6fc]">
                              {icon} {brand}
                            </div>
                            <div className="mt-1 text-xs text-[#8b949e]">
                              ({orders.length}건 / {totalQty}개)
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openPreview(brand, orders)}
                            className="flex-1 rounded-lg border border-[#58a6ff] bg-[#58a6ff]/10 px-3 py-2 text-xs font-medium text-[#58a6ff] transition-colors hover:bg-[#58a6ff]/20"
                          >
                            👁️ 미리보기
                          </button>
                          <button
                            onClick={() => downloadExcel(brand, orders)}
                            className="flex-1 rounded-lg bg-[#238636] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2ea043]"
                          >
                            📥 다운로드
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-[#21262d]" />

      {/* 3. 송장 입력 */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-[#c9d1d9]">3. 송장 입력</h2>
        <p className="mb-4 text-sm text-[#8b949e]">
          업체에서 받은 발주서(송장 입력됨)를 업로드하면 원본에 자동으로 합칩니다
        </p>

        <div
          onClick={() => invoiceInputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-[#30363d] bg-[#161b22] p-8 text-center transition-colors hover:border-[#58a6ff]/50"
        >
          <input
            ref={invoiceInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={handleInvoiceUpload}
            className="hidden"
          />
          <div className="mb-3 text-4xl">📋</div>
          <p className="text-[#8b949e]">송장이 입력된 발주서 파일들을 업로드하세요</p>
          <p className="mt-1 text-xs text-[#6e7681]">여러 파일 선택 가능</p>
        </div>

        {!sourceData && (
          <div className="mt-4 rounded-lg border border-[#f0883e] bg-[#f0883e]/10 p-4">
            <p className="text-sm text-[#f0883e]">⚠️ 먼저 위에서 원본 발주서를 업로드하세요</p>
          </div>
        )}

        {invoiceResult && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-[#238636] bg-[#238636]/10 p-4">
              <p className="text-sm text-[#3fb950]">✅ 송장 입력 완료: {invoiceMatched}건 매칭됨</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadInvoiceResult}
                className="rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                Excel 다운로드
              </button>
              <button
                onClick={() => {
                  if (!invoiceResult) return;
                  const csvContent = invoiceResult
                    .map((row) => row.map((cell) => `"${cell || ""}"`).join(","))
                    .join("\n");
                  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${sourceFilename.replace(/\.xlsx?$/i, "")}_송장입력완료.csv`;
                  a.click();
                }}
                className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-3 text-sm font-medium text-[#c9d1d9] transition-colors hover:border-[#8b949e]"
              >
                CSV 다운로드
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 미리보기 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#21262d] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#f0f6fc]">
                  📋 엑셀 미리보기: {previewBrand}
                </h3>
                <p className="mt-1 text-sm text-[#8b949e]">
                  {previewOrders.length}건 / 총 {previewOrders.reduce((sum, o) => sum + o.qty, 0)}개
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    downloadExcel(previewBrand, previewOrders);
                    closePreview();
                  }}
                  className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
                >
                  📥 다운로드
                </button>
                <button
                  onClick={closePreview}
                  className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm font-medium text-[#8b949e] transition-colors hover:border-[#8b949e] hover:text-[#f0f6fc]"
                >
                  ✕ 닫기
                </button>
              </div>
            </div>

            {/* 모달 바디 - 테이블 */}
            <div className="max-h-[70vh] overflow-auto p-6">
              <div className="overflow-hidden rounded-lg border border-[#30363d]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#1e3c72] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">순번</th>
                      <th className="px-4 py-3 text-left font-semibold">이름</th>
                      <th className="px-4 py-3 text-left font-semibold">주소</th>
                      <th className="px-4 py-3 text-left font-semibold">상품명</th>
                      <th className="px-4 py-3 text-left font-semibold">옵션</th>
                      <th className="px-4 py-3 text-center font-semibold">수량</th>
                      <th className="px-4 py-3 text-right font-semibold">단가</th>
                      <th className="px-4 py-3 text-right font-semibold">소계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewOrders.map((order, idx) => {
                      const name = order.data[4] || "";
                      const address = order.data[7] || "";
                      const productName = order.data[9] || "";
                      const option = order.opt || "";
                      const price = Number(order.data[13]) || 0;
                      const subtotal = price * order.qty;

                      return (
                        <tr
                          key={idx}
                          className={`border-t border-[#21262d] ${idx % 2 === 0 ? 'bg-[#0d1117]' : 'bg-[#161b22]'}`}
                        >
                          <td className="px-4 py-3 text-[#8b949e]">{idx + 1}</td>
                          <td className="px-4 py-3 text-[#f0f6fc] font-medium">{String(name)}</td>
                          <td className="px-4 py-3 text-[#8b949e] max-w-xs truncate" title={String(address)}>{String(address).slice(0, 30)}...</td>
                          <td className="px-4 py-3 text-[#c9d1d9] max-w-xs truncate" title={String(productName)}>{String(productName)}</td>
                          <td className="px-4 py-3 text-[#8b949e] max-w-xs truncate" title={option}>{option.slice(0, 25)}...</td>
                          <td className="px-4 py-3 text-center text-[#f0f6fc] font-medium">{order.qty}</td>
                          <td className="px-4 py-3 text-right text-[#8b949e]">₩{price.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-[#3fb950] font-medium">₩{subtotal.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#21262d]">
                    <tr className="border-t-2 border-[#58a6ff]">
                      <td colSpan={5} className="px-4 py-4 text-right font-bold text-[#f0f6fc]">
                        합계
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-[#58a6ff]">
                        {previewOrders.reduce((sum, o) => sum + o.qty, 0)}개
                      </td>
                      <td className="px-4 py-4 text-right text-[#8b949e]">-</td>
                      <td className="px-4 py-4 text-right font-bold text-[#3fb950]">
                        ₩{previewOrders.reduce((sum, o) => {
                          const price = Number(o.data[13]) || 0;
                          return sum + (price * o.qty);
                        }, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
