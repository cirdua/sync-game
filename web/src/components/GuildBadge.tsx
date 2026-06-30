// Persistent "Cloud Engineering Guild" badge — required on every screen.
//
// `fixed` renders it as a full-width top bar pinned to the top of the viewport
// (so it never overlaps page content). Layouts reserve --topbar-h of space at the
// top. Non-fixed renders just the inline pill (used inside other layouts).
//
// The cloud mark is served from web/public/cloud-logo.svg. To use your exact PNG
// instead, drop it in web/public/ and change the src below (and the favicon in
// index.html) to match.

export function GuildBadge({ fixed = false }: { fixed?: boolean }) {
  const pill = (
    <div className="guild-badge">
      <img
        className="guild-logo"
        src="/cloud-logo.svg"
        alt=""
        width={24}
        height={18}
      />
      Cloud Engineering Guild
    </div>
  );

  if (!fixed) return pill;

  return <div className="guild-topbar">{pill}</div>;
}
