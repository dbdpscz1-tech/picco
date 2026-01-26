"use client";

import { useState, useRef } from "react";
import { findBrand, formatDate } from "@/lib/api";
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

  // 브랜드별 분리 실행
  const handleSeparate = () => {
    if (!sourceData || Object.keys(menuData).length === 0) return;
    const results = processOrders(sourceData, menuData);
    setProcessedResults(results);
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
      {/* 1. 원본 발주서 업로드 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">1. 원본 발주서 업로드</h2>
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

      {/* 2. 브랜드별 분리 및 다운로드 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">2. 브랜드별 분리 및 다운로드</h2>

        {sourceData && Object.keys(menuData).length > 0 ? (
          <button
            onClick={handleSeparate}
            className="w-full rounded-lg bg-[#238636] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
          >
            브랜드별 분리 실행
          </button>
        ) : (
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-center text-sm text-[#8b949e]">
            {!sourceData
              ? "원본 발주서를 먼저 업로드하세요"
              : "대시보드 탭에서 메뉴판을 먼저 로드하세요"}
          </div>
        )}

        {processedResults && Object.keys(processedResults).length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-[#238636] bg-[#238636]/10 p-4">
              <p className="text-sm text-[#3fb950]">✅ 분리 완료!</p>
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

            {/* 파일 다운로드 버튼들 */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-[#8b949e]">파일 다운로드</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(processedResults)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([brand, orders]) => {
                    const totalQty = orders.reduce((sum, o) => sum + o.qty, 0);
                    const icon = brand === "미분류" ? "⚠️" : "📄";
                    return (
                      <button
                        key={brand}
                        onClick={() => downloadExcel(brand, orders)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                          brand === "미분류"
                            ? "border-[#f0883e] bg-[#f0883e]/10 hover:bg-[#f0883e]/20"
                            : "border-[#30363d] bg-[#21262d] hover:border-[#8b949e]"
                        }`}
                      >
                        <div className="font-medium text-[#f0f6fc]">
                          {icon} {brand}
                        </div>
                        <div className="mt-1 text-xs text-[#8b949e]">
                          ({orders.length}건/{totalQty}개)
                        </div>
                      </button>
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
    </div>
  );
}
