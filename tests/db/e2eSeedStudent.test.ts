import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, banks } from "../../src/server/db/schema";
import { BANK } from "../../scripts/e2e-data-student";
import { TEST_NAME, cleanTestUsers } from "./helpers";

afterAll(cleanTestUsers);

describe("scripts/e2e-seed-student.ts", () => {
  test("slot-add không nhận id khung ngoài dữ liệu HSB: khung thật giữ tên và vẫn ở trạng thái đã bỏ", async () => {
    const tag = randomUUID().slice(0, 8);
    const [bank] = await db.insert(banks).values({ code: `ZT${tag}`, name: `${TEST_NAME}Khung thật ${tag}` }).returning({ id: banks.id });
    const removedAt = new Date("2026-11-01T00:00:00Z");
    const [slot] = await db.insert(bankPhotoSlots).values({ bankId: bank.id, name: "Ảnh thật", removedAt }).returning({ id: bankPhotoSlots.id });
    const run = Bun.spawnSync(["bun", "scripts/e2e-seed-student.ts", "slot-add", BANK.stale, slot.id, "Ảnh e2e"], { env: process.env, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).not.toBe(0);
    const [row] = await db.select({ name: bankPhotoSlots.name, removedAt: bankPhotoSlots.removedAt }).from(bankPhotoSlots).where(eq(bankPhotoSlots.id, slot.id));
    expect(row).toEqual({ name: "Ảnh thật", removedAt });
  });
});
