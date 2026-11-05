import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Postgres local chỉ mở cổng trên 127.0.0.1", () => {
  const compose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");
  expect(compose).toContain('"127.0.0.1:5434:5432"');
});
