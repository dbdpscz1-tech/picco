"use client";

import { useState } from "react";
import { fetchMenuFromGoogleSheets, fetchKPIData, type KPIData } from "@/lib/api";
import type { MenuDict, ProcessedResults } from "@/lib/types";

interface DashboardProps {
  menuData: MenuDict;
  setMenuData: (data: MenuDict) => void;
  menuLoaded: boolean;
  setMenuLoaded: (loaded: boolean) => void;
  processedResults: ProcessedResults | null;
}

export default function Dashboard({
  menuData,
  setMenuData,
  menuLoaded,
  setMenuLoaded,
  processedResults,
}: DashboardProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loadingKPI, setLoadingKPI] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [showMenuList, setShowMenuList] = useState(false);
  const [showDailySalesDetail, setShowDailySalesDetail] = useState(false);
  const [showSalesCount, setShowSalesCount] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);
  const [showChannels, setShowChannels] = useState(false);

  // 메뉴판 브랜드별 카운트
  const menuBrandCounts: Record<string, number> = {};
  Object.values(menuData).forEach((brand) => {
    menuBrandCounts[brand] = (menuBrandCounts[brand] || 0) + 1;
  });

  // 발주 현황 (분리 작업 결과)
  const processedTotal = processedResults
    ? Object.values(processedResults).reduce((sum, orders) => sum + orders.length, 0)
    : 0;
  const processedQty = processedResults
    ? Object.values(processedResults).reduce(
        (sum, orders) => sum + orders.reduce((s, o) => s + o.qty, 0),
        0
      )
    : 0;

  // 일일판매수에서 오늘/어제 데이터 추출
  const getTodaySales = () => {
    if (!kpiData?.dailySales || kpiData.dailySales.length < 2) return null;
    // 첫 번째 행은 헤더, 두 번째 행이 가장 최근 데이터
    const todayRow = kpiData.dailySales[1];
    if (todayRow && todayRow.length >= 3) {
      return {
        date: todayRow[0] || "오늘",
        count: todayRow[1] || "0",
        amount: todayRow[2] || "0",
      };
    }
    return null;
  };

  const todaySales = getTodaySales();

  const handleRefreshKPI = async () => {
    setLoadingKPI(true);
    try {
      const data = await fetchKPIData();
      setKpiData(data);
    } catch (error) {
      console.error("KPI 데이터 로드 실패:", error);
    } finally {
      setLoadingKPI(false);
    }
  };

  const handleRefreshMenu = async () => {
    setLoadingMenu(true);
    try {
      const menu = await fetchMenuFromGoogleSheets();
      if (Object.keys(menu).length > 0) {
        setMenuData(menu);
        setMenuLoaded(true);
      }
    } catch (error) {
      console.error("메뉴판 로드 실패:", error);
    } finally {
      setLoadingMenu(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* KPI 섹션 */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#c9d1d9]">📈 2026 KPI 현황</h2>
          <button
            onClick={handleRefreshKPI}
            disabled={loadingKPI}
            className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
          >
            {loadingKPI ? "로드 중..." : "🔄 KPI 데이터 불러오기"}
          </button>
        </div>

        {kpiData ? (
          <div className="space-y-6">
            {/* 일일판매수 - 카드 + 상세 테이블 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 오늘 판매 카드 */}
              <div className="lg:col-span-1">
                <div className="grid grid-cols-2 gap-3">
                  {todaySales && (
                    <>
                      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                        <p className="text-xs text-[#8b949e]">📅 {todaySales.date}</p>
                        <p className="mt-1 text-2xl font-bold text-[#58a6ff]">{todaySales.count}</p>
                        <p className="text-xs text-[#8b949e]">판매 건수</p>
                      </div>
                      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                        <p className="text-xs text-[#8b949e]">💰 매출</p>
                        <p className="mt-1 text-2xl font-bold text-[#3fb950]">{todaySales.amount}</p>
                        <p className="text-xs text-[#8b949e]">원</p>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowDailySalesDetail(!showDailySalesDetail)}
                  className="mt-3 text-xs text-[#58a6ff] hover:underline"
                >
                  {showDailySalesDetail ? "▼ 일일판매수 상세 닫기" : "▶ 일일판매수 상세 보기"}
                </button>
              </div>

              {/* 일일판매수 상세 테이블 (참고용) */}
              {showDailySalesDetail && (
                <div className="lg:col-span-2 rounded-xl border border-[#30363d] bg-[#161b22] p-4 overflow-x-auto max-h-[300px] overflow-y-auto">
                  <h4 className="text-sm font-medium text-[#8b949e] mb-3">📊 일일판매수 상세</h4>
                  <table className="w-full text-xs">
                    <tbody>
                      {kpiData.dailySales.map((row, idx) => (
                        <tr key={idx} className={idx > 0 ? "border-t border-[#21262d]" : ""}>
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-2 py-1.5 ${
                                idx === 0
                                  ? "font-semibold text-[#58a6ff] bg-[#21262d]"
                                  : "text-[#c9d1d9]"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 1. 판매 수 (B4:P10) */}
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
              <button
                onClick={() => setShowSalesCount(!showSalesCount)}
                className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
              >
                <h3 className="text-base font-semibold text-[#f0f6fc]">📦 판매 수</h3>
                <span className="text-[#8b949e]">{showSalesCount ? "▼" : "▶"}</span>
              </button>
              {showSalesCount && kpiData.salesCount.length > 0 && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {kpiData.salesCount.map((row, idx) => (
                        <tr key={idx} className={idx > 0 ? "border-t border-[#21262d]" : ""}>
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-3 py-2 whitespace-nowrap ${
                                idx === 0
                                  ? "font-semibold text-[#58a6ff] bg-[#21262d]"
                                  : cellIdx === 0
                                  ? "font-medium text-[#c9d1d9]"
                                  : "text-[#f0f6fc]"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. 매출 (B13:P17) */}
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
              <button
                onClick={() => setShowRevenue(!showRevenue)}
                className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
              >
                <h3 className="text-base font-semibold text-[#f0f6fc]">💰 매출</h3>
                <span className="text-[#8b949e]">{showRevenue ? "▼" : "▶"}</span>
              </button>
              {showRevenue && kpiData.revenue.length > 0 && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {kpiData.revenue.map((row, idx) => (
                        <tr key={idx} className={idx > 0 ? "border-t border-[#21262d]" : ""}>
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-3 py-2 whitespace-nowrap ${
                                idx === 0
                                  ? "font-semibold text-[#3fb950] bg-[#21262d]"
                                  : cellIdx === 0
                                  ? "font-medium text-[#c9d1d9]"
                                  : "text-[#f0f6fc]"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. 채널별 (B45:P83) */}
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
              >
                <h3 className="text-base font-semibold text-[#f0f6fc]">📱 채널별</h3>
                <span className="text-[#8b949e]">{showChannels ? "▼" : "▶"}</span>
              </button>
              {showChannels && kpiData.channels.length > 0 && (
                <div className="p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {kpiData.channels.map((row, idx) => {
                        if (row.every((cell) => !cell || cell.trim() === "")) return null;
                        return (
                          <tr key={idx} className={idx > 0 ? "border-t border-[#21262d]" : ""}>
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                className={`px-3 py-2 whitespace-nowrap ${
                                  idx === 0
                                    ? "font-semibold text-[#a371f7] bg-[#21262d]"
                                    : cellIdx === 0
                                    ? "font-medium text-[#c9d1d9]"
                                    : "text-[#f0f6fc]"
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-8 text-center">
            <p className="text-[#8b949e]">
              &apos;KPI 데이터 불러오기&apos; 버튼을 눌러 2026KPI 시트에서 데이터를 불러오세요
            </p>
          </div>
        )}
      </section>

      <div className="border-t border-[#21262d]" />

      {/* 메뉴판 관리 섹션 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">📋 메뉴판 관리</h2>
        <div className="flex items-center justify-between">
          <div>
            {menuLoaded && Object.keys(menuData).length > 0 ? (
              <p className="text-sm text-[#3fb950]">
                ✅ 메뉴판 로드됨: {Object.keys(menuData).length}개 상품
              </p>
            ) : (
              <p className="text-sm text-[#f0883e]">⚠️ 메뉴판을 로드해주세요</p>
            )}
          </div>
          <button
            onClick={handleRefreshMenu}
            disabled={loadingMenu}
            className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm font-medium text-[#c9d1d9] transition-colors hover:border-[#8b949e] disabled:opacity-50"
          >
            {loadingMenu ? "로드 중..." : "메뉴판 새로고침"}
          </button>
        </div>

        {Object.keys(menuBrandCounts).length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              {Object.entries(menuBrandCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([brand, count]) => (
                  <div
                    key={brand}
                    className="rounded-lg border border-[#30363d] bg-[#161b22] p-3"
                  >
                    <p className="text-xs text-[#8b949e]">{brand}</p>
                    <p className="text-lg font-bold text-[#f0f6fc]">{count}개 상품</p>
                  </div>
                ))}
            </div>

            <div className="mt-4">
              <button
                onClick={() => setShowMenuList(!showMenuList)}
                className="text-sm text-[#58a6ff] hover:underline"
              >
                {showMenuList ? "▼ 전체 상품 목록 닫기" : "▶ 전체 상품 목록 보기"}
              </button>

              {showMenuList && (
                <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-[#30363d] bg-[#161b22]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#21262d]">
                      <tr>
                        <th className="px-4 py-2 text-left text-[#8b949e]">옵션명</th>
                        <th className="px-4 py-2 text-left text-[#8b949e]">브랜드</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(menuData).map(([option, brand], idx) => (
                        <tr
                          key={idx}
                          className="border-t border-[#21262d] hover:bg-[#21262d]"
                        >
                          <td className="px-4 py-2 text-[#f0f6fc]">{option}</td>
                          <td className="px-4 py-2 text-[#8b949e]">{brand}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 오늘 발주 현황 (분리 작업 결과) */}
      {processedResults && Object.keys(processedResults).length > 0 && (
        <>
          <div className="border-t border-[#21262d]" />
          <section>
            <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">
              📦 오늘 발주 현황 (분리 작업 결과)
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="총 주문" value={`${processedTotal}건`} />
              <StatCard label="총 수량" value={`${processedQty}개`} />
              <StatCard label="발주처" value={`${Object.keys(processedResults).length}곳`} />
              <StatCard
                label={processedResults["미분류"]?.length ? "미분류" : "상태"}
                value={
                  processedResults["미분류"]?.length
                    ? `${processedResults["미분류"].length}건`
                    : "분류완료"
                }
                highlight={!!processedResults["미분류"]?.length}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-all hover:border-[#58a6ff]/50 ${
        highlight
          ? "border-[#f0883e] bg-[#f0883e]/10"
          : "border-[#30363d] bg-[#161b22]"
      }`}
    >
      <p className="text-sm text-[#8b949e]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? "text-[#f0883e]" : "text-[#f0f6fc]"}`}>
        {value}
      </p>
    </div>
  );
}
