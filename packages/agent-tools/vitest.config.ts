import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // i test che lanciano tsc vero via spawn sforano i 5s default sui runner condivisi
    testTimeout: 30_000,
  },
});
