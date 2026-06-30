Brand logo
==========

The badge + favicon currently use cloud-logo.svg (a stand-in cloud that matches
the ING-orange brand). To use the exact orange cloud PNG you shared:

1. Save your PNG into this folder as `cloud-logo.png` (square-ish, transparent
   background, ~64px+ recommended).
2. Update two references:
   - web/src/components/GuildBadge.tsx  -> src="/cloud-logo.png"
   - web/index.html                     -> <link rel="icon" type="image/png" href="/cloud-logo.png" />
3. Rebuild: `cd web && npm run build`.

Files in web/public/ are served at the site root as-is (no bundling).
