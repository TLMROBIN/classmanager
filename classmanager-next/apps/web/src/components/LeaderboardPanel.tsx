import type { LeaderboardItem } from "../types";

type LeaderboardPanelProps = {
  leaderboard: LeaderboardItem[];
};

export function LeaderboardPanel({ leaderboard }: LeaderboardPanelProps) {
  return (
    <article className="panel leaderboard-panel">
      <div className="panel-header">
        <h2>积分排行榜</h2>
        <span>Top {leaderboard.length}</span>
      </div>
      <div className="leaderboard-list">
        {leaderboard.map((item) => (
          <div key={item.id} className="leaderboard-row">
            <span className="rank-tag">{item.rank}</span>
            <div>
              <strong>{item.name}</strong>
              <span>
                {item.primaryGroup?.name || "未分组"} · {item.primaryDorm?.name || "未分宿舍"}
              </span>
            </div>
            <b>{item.account?.balancePoints ?? "0"}</b>
          </div>
        ))}
      </div>
    </article>
  );
}
