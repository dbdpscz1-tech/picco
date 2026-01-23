"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import Workspace from "@/components/Workspace";

type TabType = "dashboard" | "workspace";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const tabs: { id: TabType; label: string }[] = [
    { id: "dashboard", label: "대시보드" },
    { id: "workspace", label: "워크스페이스" },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-[#21262d] bg-[#161b22]">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#f0f6fc]">
            <span className="bg-gradient-to-r from-[#58a6ff] to-[#a371f7] bg-clip-text text-transparent">
              picco
            </span>
            <span className="ml-2 font-light text-[#8b949e]">project</span>
          </h1>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-[#f0f6fc]"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "workspace" && <Workspace />}
      </main>
    </div>
  );
}
