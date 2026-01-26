"use client";

import { useState, useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import OrderSeparator from "@/components/OrderSeparator";
import IndividualOrder from "@/components/IndividualOrder";
import { fetchMenuFromGoogleSheets } from "@/lib/api";
import type { MenuDict, ProcessedResults, MenuFullItem } from "@/lib/types";

type TabType = "dashboard" | "separator" | "individual";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [menuData, setMenuData] = useState<MenuDict>({});
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [processedResults, setProcessedResults] = useState<ProcessedResults | null>(null);
  const [menuFull, setMenuFull] = useState<MenuFullItem[]>([]);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "dashboard", label: "대시보드", icon: "📊" },
    { id: "separator", label: "공급처별 발주서 분리하기", icon: "📦" },
    { id: "individual", label: "개별 주문 입력", icon: "✏️" },
  ];

  // 메뉴판 자동 로드
  useEffect(() => {
    if (!menuLoaded) {
      fetchMenuFromGoogleSheets().then((menu) => {
        if (Object.keys(menu).length > 0) {
          setMenuData(menu);
          setMenuLoaded(true);
        }
      });
    }
  }, [menuLoaded]);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-[#21262d] bg-[#161b22]">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#f0f6fc]">
            <span className="mr-2">📦</span>
            <span className="bg-gradient-to-r from-[#58a6ff] to-[#a371f7] bg-clip-text text-transparent">
              피코 커머스
            </span>
          </h1>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-[#f0f6fc]"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#f78166]" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === "dashboard" && (
          <Dashboard
            menuData={menuData}
            setMenuData={setMenuData}
            menuLoaded={menuLoaded}
            setMenuLoaded={setMenuLoaded}
            processedResults={processedResults}
          />
        )}
        {activeTab === "separator" && (
          <OrderSeparator
            menuData={menuData}
            processedResults={processedResults}
            setProcessedResults={setProcessedResults}
          />
        )}
        {activeTab === "individual" && (
          <IndividualOrder
            menuFull={menuFull}
            setMenuFull={setMenuFull}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#21262d] py-4 text-center">
        <p className="text-sm text-[#8b949e]">피코 커머스 발주서 자동화 시스템</p>
      </footer>
    </div>
  );
}
