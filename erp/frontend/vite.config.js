import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Nombres estables sin hash — evita que clientes con index.html viejo rompan al navegar
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    // Proxy para desarrollo local (no se usa en build de producción)
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    // Servidor de producción: accesible por LAN e internet
    host: "0.0.0.0",
    port: 9980,
    strictPort: true,
  },
});
