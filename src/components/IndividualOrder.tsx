"use client";

import { useState, useRef } from "react";
import { fetchMenuFull, searchAddressKakao, searchKeywordKakao, formatDate } from "@/lib/api";
import type { MenuFullItem, IndividualOrder as IndividualOrderType } from "@/lib/types";
import * as XLSX from "xlsx";

interface IndividualOrderProps {
  menuFull: MenuFullItem[];
  setMenuFull: (items: MenuFullItem[]) => void;
}

export default function IndividualOrder({ menuFull, setMenuFull }: IndividualOrderProps) {
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [orders, setOrders] = useState<IndividualOrderType[]>([]);
  const [generatedOrderDf, setGeneratedOrderDf] = useState<Record<string, string | number>[] | null>(null);
  const [showMenuPreview, setShowMenuPreview] = useState(false);

  // 주문 폼 상태
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [address, setAddress] = useState("");
  const [currentSupplyPrice, setCurrentSupplyPrice] = useState(0);
  const [currentShippingFee, setCurrentShippingFee] = useState(0);

  const mergeFileRef = useRef<HTMLInputElement>(null);

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

  // 주소 검색
  const handleSearchAddress = async () => {
    if (!addressQuery.trim()) return;

    const addrResults = await searchAddressKakao(addressQuery);
    const keywordResults = await searchKeywordKakao(addressQuery);

    const allResults = [...new Set([...addrResults, ...keywordResults])];
    setAddressResults(allResults);
  };

  // 주소 선택
  const handleSelectAddress = (addr: string) => {
    setSelectedAddress(addr);
    setAddress(addr);
  };

  // 주문 추가
  const handleAddOrder = () => {
    if (!recipientName || !recipientPhone || !address) {
      alert("수취인명, 전화번호, 주소는 필수입니다");
      return;
    }

    const newOrder: IndividualOrderType = {
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      address,
      product_name: selectedCategory || "",
      option: selectedOption || "",
      quantity,
      supply_price: currentSupplyPrice,
      shipping_fee: currentShippingFee,
    };

    setOrders([...orders, newOrder]);

    // 폼 초기화
    setRecipientName("");
    setRecipientPhone("");
    setAddress("");
    setAddressQuery("");
    setAddressResults([]);
    setSelectedAddress("");
    setQuantity(1);
  };

  // 주문 목록 초기화
  const handleClearOrders = () => {
    setOrders([]);
    setGeneratedOrderDf(null);
  };

  // 발주서 생성
  const handleGenerateOrder = () => {
    const today = formatDate("YYYYMMDD");
    const rows = orders.map((order, i) => ({
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
      주문자명: order.recipient_name,
      주문자전화번호1: order.recipient_phone,
      TEMP5: "",
      비고: "",
      "쇼핑몰명(1)": "개별주문",
      수취인전화번호2: "",
    }));

    setGeneratedOrderDf(rows);
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

  // 총 합계 계산
  const totalAmount = orders.reduce(
    (sum, order) => sum + order.supply_price * order.quantity + order.shipping_fee,
    0
  );

  return (
    <div className="space-y-8">
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
              <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-[#30363d] bg-[#161b22]">
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
                    {menuFull.slice(0, 5).map((item, idx) => (
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
          <h4 className="text-sm font-medium text-[#8b949e]">📝 주문 정보 입력</h4>

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
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
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
                  <option key={item.option} value={item.option}>
                    {item.option}
                  </option>
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
            <label className="mb-1 block text-sm text-[#8b949e]">주소 검색</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                placeholder="주소나 장소명 입력 후 검색 버튼 클릭"
                className="flex-1 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
              />
              <button
                onClick={handleSearchAddress}
                className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm text-[#c9d1d9] transition-colors hover:border-[#8b949e]"
              >
                🔍 검색
              </button>
            </div>
          </div>

          {/* 주소 검색 결과 */}
          {addressResults.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-[#8b949e]">검색 결과 선택</label>
              <select
                value={selectedAddress}
                onChange={(e) => handleSelectAddress(e.target.value)}
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
              >
                <option value="">선택하세요</option>
                {addressResults.map((addr, idx) => (
                  <option key={idx} value={addr}>
                    {addr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 배송 주소 */}
          <div>
            <label className="mb-1 block text-sm text-[#8b949e]">배송주소</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="직접 입력 또는 위에서 검색"
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
            />
          </div>

          {/* 주문 추가 버튼 */}
          <button
            onClick={handleAddOrder}
            className="w-full rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
          >
            ✅ 주문 추가
          </button>
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
                    <th className="px-4 py-3 text-left text-[#8b949e]">수량</th>
                    <th className="px-4 py-3 text-left text-[#8b949e]">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => {
                    const orderTotal = order.supply_price * order.quantity + order.shipping_fee;
                    return (
                      <tr key={idx} className="border-t border-[#21262d]">
                        <td className="px-4 py-3 text-[#f0f6fc]">{order.recipient_name}</td>
                        <td className="px-4 py-3 text-[#8b949e]">{order.recipient_phone}</td>
                        <td className="px-4 py-3 text-[#8b949e]">{order.product_name}</td>
                        <td className="px-4 py-3 text-[#8b949e]">{order.option}</td>
                        <td className="px-4 py-3 text-[#8b949e]">{order.quantity}</td>
                        <td className="px-4 py-3 text-[#f0f6fc]">₩{orderTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
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
                  onClick={handleGenerateOrder}
                  className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
                >
                  발주서 생성 (STEP 1 완료)
                </button>
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
    </div>
  );
}
