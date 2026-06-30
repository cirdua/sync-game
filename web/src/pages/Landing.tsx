import { Link } from "react-router-dom";
import { GuildBadge } from "../components/GuildBadge";

export function Landing() {
  return (
    <div className="center-screen">
      <GuildBadge fixed />
      <div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <h1 style={{ color: "var(--ing-orange)", marginBottom: 4 }}>Guild Live</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Real-time audience game
        </p>
        <div className="stack" style={{ marginTop: 24 }}>
          <Link to="/host" className="btn btn-primary btn-lg btn-block">
            Host a session
          </Link>
          <Link to="/join" className="btn btn-ghost btn-lg btn-block">
            Join a session
          </Link>
        </div>
      </div>
    </div>
  );
}
