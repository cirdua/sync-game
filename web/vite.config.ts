import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local dev we proxy /api -> the local Functions host (func start on 7071)
// so the frontend can call relative /api/* exactly as it will in production
// (SWA serves the app and the Function App is reached by absolute URL there;
//  see VITE_API_BASE_URL handling in src/api/client.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
  },
});
