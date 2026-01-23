export default function Workspace() {
  const workspaces = [
    {
      id: 1,
      name: "프론트엔드 개발",
      description: "React, Next.js 기반 웹 애플리케이션 개발",
      members: 4,
      color: "#58a6ff",
    },
    {
      id: 2,
      name: "백엔드 API",
      description: "Node.js Express 서버 및 REST API 개발",
      members: 3,
      color: "#a371f7",
    },
    {
      id: 3,
      name: "디자인 시스템",
      description: "UI/UX 디자인 및 컴포넌트 라이브러리",
      members: 2,
      color: "#f78166",
    },
    {
      id: 4,
      name: "데브옵스",
      description: "CI/CD 파이프라인 및 인프라 관리",
      members: 2,
      color: "#3fb950",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#c9d1d9]">워크스페이스</h2>
          <p className="mt-1 text-sm text-[#8b949e]">팀별 작업 공간을 관리하세요</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          새 워크스페이스
        </button>
      </div>

      {/* Workspace Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className="group cursor-pointer rounded-xl border border-[#30363d] bg-[#161b22] p-5 transition-all hover:border-[#58a6ff]/50 hover:bg-[#1c2128]"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ backgroundColor: workspace.color + "30", color: workspace.color }}
              >
                {workspace.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold text-[#f0f6fc] group-hover:text-[#58a6ff]">
                  {workspace.name}
                </h3>
                <p className="mt-1 truncate text-sm text-[#8b949e]">
                  {workspace.description}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    {workspace.members}명
                  </div>
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(workspace.members, 3))].map((_, i) => (
                      <div
                        key={i}
                        className="h-6 w-6 rounded-full border-2 border-[#161b22] bg-[#30363d]"
                      />
                    ))}
                    {workspace.members > 3 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#161b22] bg-[#30363d] text-[10px] text-[#8b949e]">
                        +{workspace.members - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button className="rounded p-1.5 text-[#8b949e] opacity-0 transition-all hover:bg-[#30363d] hover:text-[#f0f6fc] group-hover:opacity-100">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State for more workspaces */}
      <div className="rounded-xl border-2 border-dashed border-[#30363d] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#21262d]">
          <svg
            className="h-6 w-6 text-[#8b949e]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </div>
        <p className="text-sm text-[#8b949e]">새로운 워크스페이스를 추가하여</p>
        <p className="text-sm text-[#8b949e]">팀의 협업을 시작하세요</p>
      </div>
    </div>
  );
}
