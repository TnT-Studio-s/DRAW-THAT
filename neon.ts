import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  preview: {
    functions: {
      backend: {
        name: "Draw That backend",
        source: "./apps/server/src/neon-function.ts",
        env: {
          DRAW_DUO_FUNCTION: "1",
          NODE_ENV: "production",
        },
      },
    },
    buckets: {
      uploads: { access: "private" },
    },
  },
});
