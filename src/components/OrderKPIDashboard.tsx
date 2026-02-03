"use client";

import { useState, useMemo } from "react";
import { fetchOrderKPIData, normalizeDateString, getTodayString, getCurrentMonthString, type OrderKPIData, type OrderKPIRow } from "@/lib/api";

type SearchMode = "daily" | "monthly";

interface DateFilter {
    startDate: string;
    endDate: string;
}

interface MonthFilter {
    month: string; // YYYY-MM format
}

export default function OrderKPIDashboard() {
    const [kpiData, setKpiData] = useState<OrderKPIData | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [searchMode, setSearchMode] = useState<SearchMode>("daily");
    const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
    const [monthFilter, setMonthFilter] = useState<MonthFilter | null>(null);
    const [showDailyChart, setShowDailyChart] = useState(true);
    const [showMonthlyChart, setShowMonthlyChart] = useState(true);
    const [showMallTable, setShowMallTable] = useState(true);
    const [selectedMall, setSelectedMall] = useState<string | null>(null);

    const handleLoadKPI = async () => {
        setLoading(true);
        try {
            const data = await fetchOrderKPIData();
            setKpiData(data);
            if (data && data.years.length > 0 && !selectedYear) {
                setSelectedYear(data.years[0]);
            }
        } catch (error) {
            console.error("KPI 데이터 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    };

    // 필터 초기화
    const handleResetFilter = () => {
        setDateFilter(null);
        setMonthFilter(null);
    };

    // 연도 및 필터 적용된 데이터
    const filteredRows = useMemo(() => {
        if (!kpiData) return [];

        let rows = kpiData.rows;

        // 연도 필터
        if (selectedYear) {
            rows = rows.filter(row => {
                const normalized = normalizeDateString(row.orderDate);
                return normalized.startsWith(String(selectedYear));
            });
        }

        // 일별 날짜 범위 필터
        if (searchMode === "daily" && dateFilter) {
            rows = rows.filter(row => {
                const normalized = normalizeDateString(row.orderDate);
                return normalized >= dateFilter.startDate && normalized <= dateFilter.endDate;
            });
        }

        // 월별 필터
        if (searchMode === "monthly" && monthFilter) {
            rows = rows.filter(row => {
                const normalized = normalizeDateString(row.orderDate);
                return normalized.startsWith(monthFilter.month);
            });
        }

        return rows;
    }, [kpiData, selectedYear, searchMode, dateFilter, monthFilter]);

    // 필터 적용 여부에 따른 통계
    const periodStats = useMemo(() => {
        return {
            orderCount: filteredRows.length,
            salesCount: filteredRows.reduce((sum, row) => sum + row.salesCount, 0),
        };
    }, [filteredRows]);

    // 오늘의 KPI (필터 미적용 시에만 사용)
    const todayStats = useMemo(() => {
        if (dateFilter || monthFilter) return null;
        const today = getTodayString();
        const todayRows = filteredRows.filter(row =>
            normalizeDateString(row.orderDate) === today
        );
        return {
            orderCount: todayRows.length,
            salesCount: todayRows.reduce((sum, row) => sum + row.salesCount, 0),
        };
    }, [filteredRows, dateFilter, monthFilter]);

    // 이번 달 KPI (필터 미적용 시에만 사용)
    const monthStats = useMemo(() => {
        if (dateFilter || monthFilter) return null;
        const currentMonth = getCurrentMonthString();
        const monthRows = filteredRows.filter(row => {
            const normalized = normalizeDateString(row.orderDate);
            return normalized.startsWith(currentMonth);
        });
        return {
            orderCount: monthRows.length,
            salesCount: monthRows.reduce((sum, row) => sum + row.salesCount, 0),
        };
    }, [filteredRows, dateFilter, monthFilter]);

    // 일별 통계
    const dailyStats = useMemo(() => {
        const statsMap = new Map<string, { orderCount: number; salesCount: number }>();

        filteredRows.forEach(row => {
            const date = normalizeDateString(row.orderDate);
            if (!date) return;

            const existing = statsMap.get(date) || { orderCount: 0, salesCount: 0 };
            statsMap.set(date, {
                orderCount: existing.orderCount + 1,
                salesCount: existing.salesCount + row.salesCount,
            });
        });

        return Array.from(statsMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 30)
            .reverse();
    }, [filteredRows]);

    // 월별 통계
    const monthlyStats = useMemo(() => {
        const statsMap = new Map<string, { orderCount: number; salesCount: number }>();

        filteredRows.forEach(row => {
            const date = normalizeDateString(row.orderDate);
            if (!date) return;

            const month = date.substring(0, 7);
            const existing = statsMap.get(month) || { orderCount: 0, salesCount: 0 };
            statsMap.set(month, {
                orderCount: existing.orderCount + 1,
                salesCount: existing.salesCount + row.salesCount,
            });
        });

        return Array.from(statsMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredRows]);

    // 판매몰별 통계
    const mallStats = useMemo(() => {
        const statsMap = new Map<string, { orderCount: number; salesCount: number }>();

        filteredRows.forEach(row => {
            const mall = row.salesMall || "미분류";
            const existing = statsMap.get(mall) || { orderCount: 0, salesCount: 0 };
            statsMap.set(mall, {
                orderCount: existing.orderCount + 1,
                salesCount: existing.salesCount + row.salesCount,
            });
        });

        return Array.from(statsMap.entries())
            .sort((a, b) => b[1].salesCount - a[1].salesCount);
    }, [filteredRows]);

    // 선택된 판매몰의 일별 통계 (드릴다운용)
    const selectedMallDailyStats = useMemo(() => {
        if (!selectedMall) return [];

        const mallRows = filteredRows.filter(row =>
            (row.salesMall || "미분류") === selectedMall
        );

        const statsMap = new Map<string, { orderCount: number; salesCount: number }>();

        mallRows.forEach(row => {
            const date = normalizeDateString(row.orderDate);
            if (!date) return;

            const existing = statsMap.get(date) || { orderCount: 0, salesCount: 0 };
            statsMap.set(date, {
                orderCount: existing.orderCount + 1,
                salesCount: existing.salesCount + row.salesCount,
            });
        });

        return Array.from(statsMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredRows, selectedMall]);

    // 차트용 최대값 계산
    const maxDailySales = useMemo(() =>
        Math.max(...dailyStats.map(([, s]) => s.salesCount), 1), [dailyStats]);
    const maxMonthlySales = useMemo(() =>
        Math.max(...monthlyStats.map(([, s]) => s.salesCount), 1), [monthlyStats]);

    // 필터 활성화 여부
    const isFilterActive = dateFilter !== null || monthFilter !== null;

    // 필터 라벨 표시
    const getFilterLabel = () => {
        if (monthFilter) {
            const [y, m] = monthFilter.month.split("-");
            return `${y}년 ${parseInt(m)}월`;
        }
        if (dateFilter) {
            return `${dateFilter.startDate} ~ ${dateFilter.endDate}`;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* 헤더 & 연도 선택 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-[#c9d1d9]">
                        📊 주문 KPI 대시보드
                    </h2>

                    {kpiData && kpiData.years.length > 0 && (
                        <select
                            value={selectedYear || ""}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value) || null)}
                            className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-sm text-[#f0f6fc] focus:border-[#58a6ff] focus:outline-none"
                        >
                            <option value="">전체 연도</option>
                            {kpiData.years.map(year => (
                                <option key={year} value={year}>{year}년</option>
                            ))}
                        </select>
                    )}
                </div>

                <button
                    onClick={handleLoadKPI}
                    disabled={loading}
                    className="rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
                >
                    {loading ? "로드 중..." : "🔄 주문 KPI 불러오기"}
                </button>
            </div>

            {/* 날짜 검색 필터 */}
            {kpiData && (
                <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[#8b949e]">📅 기간 검색</h4>
                        {/* 검색 모드 토글 */}
                        <div className="flex rounded-lg overflow-hidden border border-[#30363d]">
                            <button
                                onClick={() => { setSearchMode("daily"); setMonthFilter(null); }}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${searchMode === "daily"
                                    ? "bg-[#238636] text-white"
                                    : "bg-[#21262d] text-[#8b949e] hover:text-[#f0f6fc]"
                                    }`}
                            >
                                일별
                            </button>
                            <button
                                onClick={() => { setSearchMode("monthly"); setDateFilter(null); }}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${searchMode === "monthly"
                                    ? "bg-[#238636] text-white"
                                    : "bg-[#21262d] text-[#8b949e] hover:text-[#f0f6fc]"
                                    }`}
                            >
                                월별
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {searchMode === "daily" ? (
                            <>
                                <input
                                    type="date"
                                    value={dateFilter?.startDate || ""}
                                    onChange={(e) => setDateFilter(prev => ({
                                        startDate: e.target.value,
                                        endDate: prev?.endDate || e.target.value,
                                    }))}
                                    className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#f0f6fc]"
                                />
                                <span className="text-[#8b949e]">~</span>
                                <input
                                    type="date"
                                    value={dateFilter?.endDate || ""}
                                    onChange={(e) => setDateFilter(prev => ({
                                        startDate: prev?.startDate || e.target.value,
                                        endDate: e.target.value,
                                    }))}
                                    className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#f0f6fc]"
                                />
                            </>
                        ) : (
                            <input
                                type="month"
                                value={monthFilter?.month || ""}
                                onChange={(e) => setMonthFilter({ month: e.target.value })}
                                className="rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#f0f6fc]"
                            />
                        )}

                        {isFilterActive && (
                            <button
                                onClick={handleResetFilter}
                                className="rounded-lg border border-[#f85149] bg-transparent px-3 py-2 text-sm text-[#f85149] hover:bg-[#f85149]/10"
                            >
                                초기화
                            </button>
                        )}
                    </div>
                </div>
            )}

            {kpiData ? (
                <>
                    {/* 필터 적용 시 기간별 통계 표시 */}
                    {isFilterActive ? (
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard
                                label={`${getFilterLabel()} 주문건수`}
                                value={`${periodStats.orderCount}건`}
                                icon="📦"
                                color="blue"
                            />
                            <StatCard
                                label={`${getFilterLabel()} 판매건수`}
                                value={`${periodStats.salesCount.toLocaleString()}개`}
                                icon="🛒"
                                color="green"
                            />
                        </div>
                    ) : (
                        /* 기본 요약 카드 */
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <StatCard
                                label="오늘의 주문건수"
                                value={`${todayStats?.orderCount || 0}건`}
                                icon="📦"
                                color="blue"
                            />
                            <StatCard
                                label="오늘의 총 판매건수"
                                value={`${(todayStats?.salesCount || 0).toLocaleString()}개`}
                                icon="🛒"
                                color="green"
                            />
                            <StatCard
                                label="이번 달 주문건수"
                                value={`${monthStats?.orderCount || 0}건`}
                                icon="📋"
                                color="purple"
                            />
                            <StatCard
                                label="이번 달 누적 판매건수"
                                value={`${(monthStats?.salesCount || 0).toLocaleString()}개`}
                                icon="📈"
                                color="orange"
                            />
                        </div>
                    )}

                    {/* 일별 추이 차트 */}
                    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
                        <button
                            onClick={() => setShowDailyChart(!showDailyChart)}
                            className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
                        >
                            <h3 className="text-base font-semibold text-[#f0f6fc]">📊 일별 판매 추이 (최근 30일)</h3>
                            <span className="text-[#8b949e]">{showDailyChart ? "▼" : "▶"}</span>
                        </button>
                        {showDailyChart && dailyStats.length > 0 && (
                            <div className="p-4 overflow-x-auto">
                                <div className="flex items-end gap-1 h-48 min-w-[600px]">
                                    {dailyStats.map(([date, stats]) => (
                                        <div key={date} className="flex-1 flex flex-col items-center group">
                                            <div className="relative w-full flex justify-center">
                                                <div
                                                    className="w-4 bg-gradient-to-t from-[#238636] to-[#3fb950] rounded-t transition-all hover:from-[#2ea043] hover:to-[#56d364]"
                                                    style={{ height: `${(stats.salesCount / maxDailySales) * 160}px` }}
                                                    title={`${date}: ${stats.salesCount}개`}
                                                />
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-xs text-[#f0f6fc] whitespace-nowrap z-10">
                                                    {stats.salesCount.toLocaleString()}개
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-[#8b949e] mt-1 rotate-[-45deg] origin-center">
                                                {date.slice(5)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 월별 추이 차트 */}
                    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
                        <button
                            onClick={() => setShowMonthlyChart(!showMonthlyChart)}
                            className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
                        >
                            <h3 className="text-base font-semibold text-[#f0f6fc]">📈 월별 판매 추이</h3>
                            <span className="text-[#8b949e]">{showMonthlyChart ? "▼" : "▶"}</span>
                        </button>
                        {showMonthlyChart && monthlyStats.length > 0 && (
                            <div className="p-4 overflow-x-auto">
                                <div className="flex items-end gap-2 h-48 min-w-[400px]">
                                    {monthlyStats.map(([month, stats]) => (
                                        <div key={month} className="flex-1 flex flex-col items-center group min-w-[40px]">
                                            <div className="relative w-full flex justify-center">
                                                <div
                                                    className="w-8 bg-gradient-to-t from-[#1f6feb] to-[#58a6ff] rounded-t transition-all hover:from-[#388bfd] hover:to-[#79c0ff]"
                                                    style={{ height: `${(stats.salesCount / maxMonthlySales) * 160}px` }}
                                                    title={`${month}: ${stats.salesCount}개`}
                                                />
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-xs text-[#f0f6fc] whitespace-nowrap z-10">
                                                    {stats.salesCount.toLocaleString()}개
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-[#8b949e] mt-2">{month.slice(5)}월</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 판매몰별 통계 테이블 */}
                    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
                        <button
                            onClick={() => setShowMallTable(!showMallTable)}
                            className="w-full px-5 py-4 flex items-center justify-between bg-[#21262d] hover:bg-[#30363d] transition-colors"
                        >
                            <h3 className="text-base font-semibold text-[#f0f6fc]">🏪 판매몰별 통계 <span className="text-xs text-[#8b949e] font-normal ml-2">(클릭하여 상세 보기)</span></h3>
                            <span className="text-[#8b949e]">{showMallTable ? "▼" : "▶"}</span>
                        </button>
                        {showMallTable && mallStats.length > 0 && (
                            <div className="p-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#21262d]">
                                            <th className="px-4 py-3 text-left text-[#8b949e] font-medium">판매몰</th>
                                            <th className="px-4 py-3 text-right text-[#8b949e] font-medium">주문건수</th>
                                            <th className="px-4 py-3 text-right text-[#8b949e] font-medium">판매건수</th>
                                            <th className="px-4 py-3 text-right text-[#8b949e] font-medium">비중</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mallStats.map(([mall, stats]) => {
                                            const totalSales = mallStats.reduce((sum, [, s]) => sum + s.salesCount, 0);
                                            const percentage = totalSales > 0 ? (stats.salesCount / totalSales * 100).toFixed(1) : 0;
                                            return (
                                                <tr
                                                    key={mall}
                                                    onClick={() => setSelectedMall(mall)}
                                                    className="border-t border-[#21262d] hover:bg-[#238636]/10 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-[#f0f6fc] flex items-center gap-2">
                                                        <span className="text-[#58a6ff]">🔍</span>
                                                        {mall}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-[#f0f6fc]">{stats.orderCount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right text-[#3fb950] font-medium">{stats.salesCount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right text-[#8b949e]">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 h-2 bg-[#21262d] rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-[#58a6ff] rounded-full"
                                                                    style={{ width: `${percentage}%` }}
                                                                />
                                                            </div>
                                                            <span className="w-12 text-right">{percentage}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-[#30363d] bg-[#21262d]/50">
                                            <td className="px-4 py-3 text-[#f0f6fc] font-semibold">합계</td>
                                            <td className="px-4 py-3 text-right text-[#f0f6fc] font-semibold">
                                                {mallStats.reduce((sum, [, s]) => sum + s.orderCount, 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-[#3fb950] font-semibold">
                                                {mallStats.reduce((sum, [, s]) => sum + s.salesCount, 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-[#8b949e] font-semibold">100%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* 데이터 정보 */}
                    <div className="text-center text-xs text-[#6e7681]">
                        총 {filteredRows.length.toLocaleString()}개 데이터
                        {selectedYear && ` (${selectedYear}년)`}
                        {getFilterLabel() && ` | ${getFilterLabel()}`}
                    </div>
                </>
            ) : (
                <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-8 text-center">
                    <p className="text-[#8b949e]">
                        &apos;주문 KPI 불러오기&apos; 버튼을 눌러 통합 발주서 데이터를 불러오세요
                    </p>
                </div>
            )}

            {/* 판매몰 상세 모달 */}
            {selectedMall && (
                <MallDetailModal
                    mall={selectedMall}
                    dailyStats={selectedMallDailyStats}
                    onClose={() => setSelectedMall(null)}
                />
            )}
        </div>
    );
}

// 통계 카드 컴포넌트
function StatCard({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: string;
    icon: string;
    color: "blue" | "green" | "purple" | "orange";
}) {
    const colorClasses = {
        blue: "border-[#1f6feb]/30 bg-[#1f6feb]/10 text-[#58a6ff]",
        green: "border-[#238636]/30 bg-[#238636]/10 text-[#3fb950]",
        purple: "border-[#8957e5]/30 bg-[#8957e5]/10 text-[#a371f7]",
        orange: "border-[#d29922]/30 bg-[#d29922]/10 text-[#f0883e]",
    };

    return (
        <div className={`rounded-xl border p-5 transition-all hover:scale-[1.02] ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <p className="text-xs text-[#8b949e]">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );
}

// 판매몰 상세 모달 컴포넌트
function MallDetailModal({
    mall,
    dailyStats,
    onClose,
}: {
    mall: string;
    dailyStats: [string, { orderCount: number; salesCount: number }][];
    onClose: () => void;
}) {
    const maxSales = Math.max(...dailyStats.map(([, s]) => s.salesCount), 1);
    const totalOrders = dailyStats.reduce((sum, [, s]) => sum + s.orderCount, 0);
    const totalSales = dailyStats.reduce((sum, [, s]) => sum + s.salesCount, 0);

    // ESC 키로 닫기
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-auto m-4 rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#21262d]">
                    <div>
                        <h3 className="text-lg font-semibold text-[#f0f6fc]">
                            🏪 {mall} - 일별 판매 추이
                        </h3>
                        <p className="text-xs text-[#8b949e] mt-1">
                            총 {totalOrders.toLocaleString()}건 주문 · {totalSales.toLocaleString()}개 판매
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-[#8b949e] hover:bg-[#30363d] hover:text-[#f0f6fc] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 차트 */}
                <div className="p-6">
                    {dailyStats.length > 0 ? (
                        <>
                            {/* 요약 카드 */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="rounded-lg border border-[#1f6feb]/30 bg-[#1f6feb]/10 p-4">
                                    <p className="text-xs text-[#8b949e]">총 주문건수</p>
                                    <p className="text-2xl font-bold text-[#58a6ff]">{totalOrders.toLocaleString()}건</p>
                                </div>
                                <div className="rounded-lg border border-[#238636]/30 bg-[#238636]/10 p-4">
                                    <p className="text-xs text-[#8b949e]">총 판매건수</p>
                                    <p className="text-2xl font-bold text-[#3fb950]">{totalSales.toLocaleString()}개</p>
                                </div>
                            </div>

                            {/* 막대 차트 */}
                            <div className="overflow-x-auto">
                                <div className="flex items-end gap-1 h-64 min-w-[600px]">
                                    {dailyStats.map(([date, stats]) => (
                                        <div key={date} className="flex-1 flex flex-col items-center group min-w-[20px]">
                                            <div className="relative w-full flex justify-center">
                                                <div
                                                    className="w-5 bg-gradient-to-t from-[#a371f7] to-[#c297ff] rounded-t transition-all hover:from-[#8957e5] hover:to-[#a371f7]"
                                                    style={{ height: `${(stats.salesCount / maxSales) * 220}px` }}
                                                    title={`${date}: 주문 ${stats.orderCount}건, 판매 ${stats.salesCount}개`}
                                                />
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#f0f6fc] whitespace-nowrap z-10">
                                                    <div>📦 {stats.orderCount}건</div>
                                                    <div>🛒 {stats.salesCount}개</div>
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-[#8b949e] mt-1 rotate-[-45deg] origin-center whitespace-nowrap">
                                                {date.slice(5)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 상세 테이블 */}
                            <div className="mt-6 max-h-60 overflow-y-auto rounded-lg border border-[#30363d]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-[#21262d]">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[#8b949e]">날짜</th>
                                            <th className="px-4 py-2 text-right text-[#8b949e]">주문건수</th>
                                            <th className="px-4 py-2 text-right text-[#8b949e]">판매건수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyStats.slice().reverse().map(([date, stats]) => (
                                            <tr key={date} className="border-t border-[#21262d]">
                                                <td className="px-4 py-2 text-[#f0f6fc]">{date}</td>
                                                <td className="px-4 py-2 text-right text-[#f0f6fc]">{stats.orderCount}</td>
                                                <td className="px-4 py-2 text-right text-[#3fb950]">{stats.salesCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-[#8b949e]">해당 기간에 데이터가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
