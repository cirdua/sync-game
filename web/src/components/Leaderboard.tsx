import { LeaderboardEntry } from "../api/types";

// Shared leaderboard / final-ranking renderer. `final` enlarges the podium.
export function Leaderboard({
  entries,
  final = false,
  highlightPlayerId,
  limit = 10,
}: {
  entries: LeaderboardEntry[];
  final?: boolean;
  highlightPlayerId?: string;
  limit?: number;
}) {
  const shown = entries.slice(0, limit);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className={`leaderboard ${final ? "leaderboard-final" : ""}`}>
      {final && <h1 className="lb-title">🏆 Final Ranking</h1>}
      {shown.length === 0 && <p className="muted">No scores yet.</p>}
      <ol className="lb-list">
        {shown.map((e) => (
          <li
            key={e.playerId}
            className={`lb-row ${
              highlightPlayerId === e.playerId ? "lb-me" : ""
            }`}
          >
            <span className="lb-rank">
              {e.rank <= 3 ? medals[e.rank - 1] : e.rank}
            </span>
            <span className="lb-name">{e.displayName}</span>
            <span className="lb-score">{e.totalScore}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
