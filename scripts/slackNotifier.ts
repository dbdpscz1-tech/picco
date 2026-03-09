/**
 * 슬랙 KPI 요약 자동 전송 스크립트 (영업일 기준)
 * 영업일 기준으로 전날 성과, 당월 현황, 월별 요약, 몰별 통계를 슬랙으로 전송
 * 
 * 사용법:
 *   npm run slack-report
 * 
 * 환경 변수:
 *   SLACK_WEBHOOK_URL: 슬랙 웹훅 URL (필수)
 */

import { CONFIG, getSheetExportUrl } from "../src/lib/config";

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

// 날짜 문자열 정규화
function normalizeDateString(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return dateStr;
}

// 날짜에서 연도-월 추출 (YYYY-MM)
function extractYearMonth(dateStr: string): string | null {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return null;
  const match = normalized.match(/(\d{4})-(\d{2})-\d{2}/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return null;
}

// 한국 시간 기준 현재 날짜/시간 가져오기
function getKoreaTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

// 영업일 기준 집계 기간 계산
// 월요일: 지난 금요일 11:01 ~ 오늘(월) 11:00
// 화~금: 전날 11:01 ~ 오늘 11:00
function getBusinessDateRange(): { startDate: string; endDate: string; periodLabel: string } {
  const koreaTime = getKoreaTime();
  const dayOfWeek = koreaTime.getDay(); // 0=일, 1=월, ..., 6=토
  const today11am = new Date(
    koreaTime.getFullYear(),
    koreaTime.getMonth(),
    koreaTime.getDate(),
    11,
    0,
    0,
    0
  );

  let startDate: Date;
  let endDate: Date = today11am;

  if (dayOfWeek === 1) {
    // 월요일: 지난 금요일 11:01부터
    const friday = new Date(koreaTime);
    friday.setDate(friday.getDate() - 3); // 금요일로 이동
    startDate = new Date(
      friday.getFullYear(),
      friday.getMonth(),
      friday.getDate(),
      11,
      1,
      0,
      0
    );
    const fridayStr = formatDate(friday);
    const mondayStr = formatDate(koreaTime);
    return {
      startDate: fridayStr,
      endDate: mondayStr,
      periodLabel: `${fridayStr} 11:01 ~ ${mondayStr} 11:00 (주말 포함)`,
    };
  } else if (dayOfWeek >= 2 && dayOfWeek <= 5) {
    // 화~금: 전날 11:01부터
    const yesterday = new Date(koreaTime);
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
      11,
      1,
      0,
      0
    );
    const yesterdayStr = formatDate(yesterday);
    const todayStr = formatDate(koreaTime);
    return {
      startDate: yesterdayStr,
      endDate: todayStr,
      periodLabel: `${yesterdayStr} 11:01 ~ ${todayStr} 11:00`,
    };
  } else {
    // 주말/공휴일: 전날 기준으로 처리
    const yesterday = new Date(koreaTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    return {
      startDate: yesterdayStr,
      endDate: yesterdayStr,
      periodLabel: `${yesterdayStr} (주말/공휴일)`,
    };
  }
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 현재 월 (YYYY-MM)
function getCurrentMonth(): string {
  const koreaTime = getKoreaTime();
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// 판매건수 파싱
function parseSalesCount(raw: string): number {
  return parseInt(raw.replace(/[^0-9-]/g, "")) || 0;
}

// 날짜가 범위 내에 있는지 확인 (11시 기준)

// 통합 발주서 시트에서 모든 KPI 데이터 가져오기
interface KPIData {
  // 전날 성과 (영업일 기준)
  previousDay: {
    orderCount: number;
    salesCount: number;
    periodLabel: string;
  };
  // 당월 현황
  currentMonth: {
    totalOrders: number;
    totalSales: number;
    dailyTrend: Array<{ date: string; orders: number; sales: number }>;
    dailyAverage: {
      orders: number;
      sales: number;
    };
    daysCount: number;
  };
  // 월별 요약 (2026년)
  monthlySummary: Array<{
    month: string;
    orderCount: number;
    salesCount: number;
  }>;
  // 몰별 통계 (당월 누적)
  mallStats: Array<{
    mall: string;
    salesCount: number;
    percentage: number;
  }>;
}

async function fetchAllKPIData(): Promise<KPIData> {
  try {
    const url = getSheetExportUrl(CONFIG.ORDER_HISTORY_GID);
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return {
        previousDay: { orderCount: 0, salesCount: 0, periodLabel: "" },
        currentMonth: {
          totalOrders: 0,
          totalSales: 0,
          dailyTrend: [],
          dailyAverage: { orders: 0, sales: 0 },
          daysCount: 0,
        },
        monthlySummary: [],
        mallStats: [],
      };
    }

    const { startDate, endDate, periodLabel } = getBusinessDateRange();
    const currentMonthStr = getCurrentMonth();

    // 전날 성과 (영업일 기준)
    let previousDayOrderCount = 0;
    let previousDaySalesCount = 0;

    // 당월 데이터
    const currentMonthData: Array<{ date: string; orders: number; sales: number }> = [];
    const currentMonthDates = new Set<string>();
    let currentMonthTotalOrders = 0;
    let currentMonthTotalSales = 0;

    // 월별 데이터 (2026년)
    const monthlyData: Record<string, { orders: number; sales: number }> = {};

    // 몰별 통계 (당월 누적)
    const mallData: Record<string, number> = {};

    // 헤더 행 제외하고 데이터 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 27) continue;

      const month = row[2]?.trim() || ""; // Column C (월별)
      const orderDate = normalizeDateString(row[3]?.trim() || ""); // Column D (발주일)
      const salesCountRaw = row[15]?.trim() || ""; // Column P (판매건수)
      const salesMall = row[26]?.trim() || ""; // Column AA (판매몰)

      if (!orderDate) continue;

      const salesCount = parseSalesCount(salesCountRaw);
      const yearMonth = extractYearMonth(orderDate);

      // 1. 전날 성과 (영업일 기준, D/P컬럼)
      // 시작일과 종료일 사이의 모든 날짜 포함
      const orderDateObj = new Date(orderDate);
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (orderDateObj >= startDateObj && orderDateObj <= endDateObj) {
        previousDayOrderCount++;
        previousDaySalesCount += salesCount;
      }

      // 2. 당월 현황 (C/D/P컬럼)
      if (yearMonth === currentMonthStr) {
        currentMonthDates.add(orderDate);
        currentMonthTotalOrders++;
        currentMonthTotalSales += salesCount;

        // 일별 추이
        const existing = currentMonthData.find((d) => d.date === orderDate);
        if (existing) {
          existing.orders++;
          existing.sales += salesCount;
        } else {
          currentMonthData.push({ date: orderDate, orders: 1, sales: salesCount });
        }

        // 4. 몰별 통계 (당월 누적, AA컬럼)
        if (salesMall && salesMall.toLowerCase() !== "스탠리") {
          const mall = salesMall.trim();
          mallData[mall] = (mallData[mall] || 0) + salesCount;
        }
      }

      // 3. 월별 요약 (2026년)
      if (yearMonth && yearMonth.startsWith("2026-")) {
        if (!monthlyData[yearMonth]) {
          monthlyData[yearMonth] = { orders: 0, sales: 0 };
        }
        monthlyData[yearMonth].orders++;
        monthlyData[yearMonth].sales += salesCount;
      }
    }

    // 당월 일별 평균 계산
    const daysCount = currentMonthDates.size;
    const dailyAverageOrders = daysCount > 0 ? currentMonthTotalOrders / daysCount : 0;
    const dailyAverageSales = daysCount > 0 ? currentMonthTotalSales / daysCount : 0;

    // 일별 추이 정렬
    currentMonthData.sort((a, b) => a.date.localeCompare(b.date));

    // 월별 데이터 정렬
    const monthlySummary = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month: month.replace("2026-", ""),
        orderCount: data.orders,
        salesCount: data.sales,
      }));

    // 몰별 통계 정렬 및 비율 계산
    const totalMallSales = Object.values(mallData).reduce((sum, count) => sum + count, 0);
    const mallStats = Object.entries(mallData)
      .map(([mall, salesCount]) => ({
        mall,
        salesCount,
        percentage: totalMallSales > 0 ? (salesCount / totalMallSales) * 100 : 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount);

    return {
      previousDay: {
        orderCount: previousDayOrderCount,
        salesCount: previousDaySalesCount,
        periodLabel,
      },
      currentMonth: {
        totalOrders: currentMonthTotalOrders,
        totalSales: currentMonthTotalSales,
        dailyTrend: currentMonthData,
        dailyAverage: {
          orders: Math.round(dailyAverageOrders * 10) / 10,
          sales: Math.round(dailyAverageSales * 10) / 10,
        },
        daysCount,
      },
      monthlySummary,
      mallStats,
    };
  } catch (error) {
    console.error("KPI 데이터 조회 실패:", error);
    throw error;
  }
}

// 날짜 포맷팅 (MM/DD)
function formatDateMMDD(dateStr: string): string {
  const normalized = normalizeDateString(dateStr);
  if (!normalized) return dateStr;
  const match = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[2]}/${match[3]}`;
  }
  return dateStr;
}

// 날짜 포맷팅 (YYYY/MM)
function formatDateYYYYMM(yearMonth: string): string {
  const match = yearMonth.match(/(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return yearMonth;
}

// 슬랙 메시지 포맷팅 (Slack Block Kit - 표 형식)
function formatSlackMessage(data: KPIData, isManualSend: boolean = false, dashboardUrl?: string): any {
  const currentMonth = getCurrentMonth();
  const monthName = new Date(`${currentMonth}-01`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 피코 커머스 KPI 리포트",
        emoji: true,
      },
    },
    {
      type: "divider",
    },
    // 1. 전날 성과
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*1️⃣ 전날 성과*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📅 집계 기간*\n${data.previousDay.periodLabel}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`📦 주문      | 💰 판매\n${String(data.previousDay.orderCount.toLocaleString()).padEnd(10)} | ${String(data.previousDay.salesCount.toLocaleString()).padEnd(10)}\`\`\``,
      },
    },
    {
      type: "divider",
    },
    // 2. 당월 현황
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*2️⃣ 당월 현황 (${monthName})*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📊 월간 총합*\n\`\`\`주문      | 판매\n${String(data.currentMonth.totalOrders.toLocaleString()).padEnd(10)} | ${String(data.currentMonth.totalSales.toLocaleString()).padEnd(10)}\`\`\``,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📈 일평균*\n\`\`\`주문      | 판매\n${String(data.currentMonth.dailyAverage.orders.toLocaleString()).padEnd(10)} | ${String(data.currentMonth.dailyAverage.sales.toLocaleString()).padEnd(10)}\`\`\``,
      },
    },
  ];

  // 일별 추이 표 형식 (최근 7일)
  if (data.currentMonth.dailyTrend.length > 0) {
    const recentTrend = data.currentMonth.dailyTrend.slice(-7);
    
    // 표 헤더 (건 제거)
    const tableHeader = "날짜      | 주문      | 판매";
    const tableSeparator = "----------|-----------|-----------";
    const tableRows = recentTrend
      .map(({ date, orders, sales }) => {
        const dateStr = formatDateMMDD(date);
        return `${dateStr.padEnd(10)} | ${String(orders.toLocaleString()).padStart(9)} | ${String(sales.toLocaleString()).padStart(9)}`;
      })
      .join("\n");

    const tableText = `${tableHeader}\n${tableSeparator}\n${tableRows}`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📈 일별 추이 (최근 7일)*`,
      },
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${tableText}\`\`\``,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📅 집계 일수: ${data.currentMonth.daysCount}일`,
      },
    ],
  });

  blocks.push({
    type: "divider",
  });

  // 3. 월별 요약 표 형식 (2026년)
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*3️⃣ 월별 요약 (2026년)*",
    },
  });

  if (data.monthlySummary.length > 0) {
    const tableHeader = "월       | 주문 합계      | 판매 합계";
    const tableSeparator = "---------|----------------|----------------";
    const tableRows = data.monthlySummary
      .map(({ month, orderCount, salesCount }) => {
        const monthStr = formatDateYYYYMM(`2026-${month}`);
        return `${monthStr.padEnd(9)} | ${String(orderCount.toLocaleString()).padStart(14)} | ${String(salesCount.toLocaleString()).padStart(14)}`;
      })
      .join("\n");

    const tableText = `${tableHeader}\n${tableSeparator}\n${tableRows}`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${tableText}\`\`\``,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "데이터 없음",
      },
    });
  }

  blocks.push({
    type: "divider",
  });

  // 4. 몰별 통계 표 형식 (당월 누적)
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*4️⃣ 몰별 통계 (${monthName} 누적)*`,
    },
  });

  if (data.mallStats.length > 0) {
    const tableHeader = "판매몰        | 판매        | 비중";
    const tableSeparator = "--------------|-------------|--------";
    const tableRows = data.mallStats
      .map(({ mall, salesCount, percentage }) => {
        const mallPadded = mall.padEnd(14);
        const salesPadded = String(salesCount.toLocaleString()).padStart(11);
        const percentagePadded = percentage.toFixed(1).padStart(6) + "%";
        return `${mallPadded} | ${salesPadded} | ${percentagePadded}`;
      })
      .join("\n");

    const tableText = `${tableHeader}\n${tableSeparator}\n${tableRows}`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${tableText}\`\`\``,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "데이터 없음",
      },
    });
  }

  // 수동 전송 구분 문구
  if (isManualSend) {
    blocks.push({
      type: "divider",
    });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "※ 이 메시지는 수동 전송 버튼을 통해 발송되었습니다.",
        },
      ],
    });
  }

  // 대시보드 버튼 추가
  if (dashboardUrl) {
    blocks.push({
      type: "divider",
    });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 대시보드 확인하기",
            emoji: true,
          },
          url: dashboardUrl,
          style: "primary",
        },
      ],
    });
  }

  return {
    text: `📊 피코 커머스 KPI 리포트`,
    blocks,
  };
}

// 슬랙으로 메시지 전송
async function sendSlackMessage(message: any): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL 환경 변수가 설정되지 않았습니다.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`슬랙 전송 실패: ${response.status} ${errorText}`);
  }
}

// 메인 실행 함수
async function main() {
  try {
    console.log("📊 KPI 데이터 조회 시작...");
    const data = await fetchAllKPIData();

    console.log("✅ 데이터 조회 완료:");
    console.log(`  - 전날 성과: 주문 ${data.previousDay.orderCount}건, 판매 ${data.previousDay.salesCount}건`);
    console.log(`  - 당월: 주문 ${data.currentMonth.totalOrders}건, 판매 ${data.currentMonth.totalSales}건`);
    console.log(`  - 월별 요약: ${data.monthlySummary.length}개월`);
    console.log(`  - 몰별 통계: ${data.mallStats.length}개 몰`);

    const dashboardUrl = process.env.DASHBOARD_URL;
    const message = formatSlackMessage(data, false, dashboardUrl);
    await sendSlackMessage(message);

    console.log("✅ 슬랙 메시지 전송 완료");
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (typeof require !== "undefined" && require.main === module) {
  main();
}

export { main, fetchAllKPIData, formatSlackMessage, sendSlackMessage };
