import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@modules": path.resolve(__dirname, "./src/modules"),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
