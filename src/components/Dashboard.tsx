export default function Dashboard() {
  const stats = [
    { label: "총 프로젝트", value: "12", change: "+2" },
    { label: "진행 중", value: "5", change: "+1" },
    { label: "완료", value: "7", change: "+1" },
    { label: "팀원", value: "8", change: "0" },
  ];

  const recentProjects = [
    { name: "웹 리디자인", status: "진행 중", progress: 65, date: "2026-01-22" },
    { name: "모바일 앱 개발", status: "진행 중", progress: 40, date: "2026-01-20" },
    { name: "API 서버 구축", status: "완료", progress: 100, date: "2026-01-18" },
    { name: "데이터베이스 마이그레이션", status: "대기", progress: 0, date: "2026-01-15" },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">개요</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 transition-all hover:border-[#58a6ff]/50"
            >
              <p className="text-sm text-[#8b949e]">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-[#f0f6fc]">{stat.value}</p>
              <p
                className={`mt-1 text-xs ${
                  stat.change.startsWith("+") && stat.change !== "+0"
                    ? "text-[#3fb950]"
                    : "text-[#8b949e]"
                }`}
              >
                {stat.change !== "0" ? `${stat.change} 이번 주` : "변동 없음"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Projects */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">최근 프로젝트</h2>
        <div className="overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#30363d] text-left text-sm text-[#8b949e]">
                <th className="px-5 py-3 font-medium">프로젝트</th>
                <th className="px-5 py-3 font-medium">상태</th>
                <th className="px-5 py-3 font-medium">진행률</th>
                <th className="px-5 py-3 font-medium">날짜</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((project, idx) => (
                <tr
                  key={project.name}
                  className={`text-sm transition-colors hover:bg-[#21262d] ${
                    idx !== recentProjects.length - 1 ? "border-b border-[#21262d]" : ""
                  }`}
                >
                  <td className="px-5 py-4 font-medium text-[#f0f6fc]">{project.name}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        project.status === "진행 중"
                          ? "bg-[#388bfd]/20 text-[#58a6ff]"
                          : project.status === "완료"
                          ? "bg-[#238636]/20 text-[#3fb950]"
                          : "bg-[#6e7681]/20 text-[#8b949e]"
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#30363d]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#58a6ff] to-[#a371f7]"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-[#8b949e]">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#8b949e]">{project.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#c9d1d9]">빠른 작업</h2>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]">
            + 새 프로젝트
          </button>
          <button className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2.5 text-sm font-medium text-[#c9d1d9] transition-colors hover:border-[#8b949e]">
            팀원 초대
          </button>
          <button className="rounded-lg border border-[#30363d] bg-[#21262d] px-4 py-2.5 text-sm font-medium text-[#c9d1d9] transition-colors hover:border-[#8b949e]">
            리포트 생성
          </button>
        </div>
      </section>
    </div>
  );
}
