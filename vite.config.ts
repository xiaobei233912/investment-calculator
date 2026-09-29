import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const minitool = mode === "minitool";
  return {
    plugins: [react(), ...(minitool ? [{
      name: "minitool-offline-entry",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "index.html", source: `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>投资计算器</title><link rel="icon" href="./favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="./style.css"></head><body><div id="root"></div>
<script src="./app.js" defer></script></body></html>` });
      },
    } satisfies import("vite").Plugin] : [])],
    ...(minitool ? {
      base: "./",
      define: { "process.env.NODE_ENV": '"production"' },
      build: {
        outDir: "dist-minitool",
        target: ["es2017", "chrome61"],
        cssTarget: ["chrome61", "ios18.4"],
        sourcemap: false,
        modulePreload: false,
        lib: { entry: "src/minitool.ts", name: "InvestmentCalculator", formats: ["iife"] as const, fileName: () => "app.js", cssFileName: "style" },
      },
    } : {}),
  };
});
