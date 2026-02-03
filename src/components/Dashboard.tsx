"use client";

import { useState } from "react";
import { fetchMenuFromGoogleSheets } from "@/lib/api";
import type { MenuDict, ProcessedResults } from "@/lib/types";
import OrderKPIDashboard from "./OrderKPIDashboard";

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
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [showMenuList, setShowMenuList] = useState(false);

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
      {/* 주문 KPI 대시보드 (메인) */}
      <section>
        <OrderKPIDashboard />
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
      className={`rounded-xl border p-5 transition-all hover:border-[#58a6ff]/50 ${highlight
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
