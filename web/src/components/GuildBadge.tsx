// Persistent "Cloud Engineering Guild" badge — required on every screen.

export function GuildBadge({ fixed = false }: { fixed?: boolean }) {
  const style: React.CSSProperties = fixed
    ? { position: "fixed", top: 16, left: 16, zIndex: 50 }
    : {};
  return (
    <div className="guild-badge" style={style}>
      <span className="dot" />
      Cloud Engineering Guild
    </div>
  );
}
