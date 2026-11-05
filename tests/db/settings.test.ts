import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { auditLog, settings } from "../../src/server/db/schema";
import { getSettings, saveSettings } from "../../src/server/settings";
import { DEFAULT_SMS_TEMPLATE } from "../../src/lib/sms";
import type { SessionUser } from "../../src/lib/types";

const KEYS = ["sms_template", "zalo_url", "pvi_app_url"];
let admin: SessionUser;
let manager: SessionUser;
let saved: { key: string; value: unknown }[] = [];

beforeAll(async () => {
  await cleanTestUsers();
  // Giữ cài đặt thật của DB local, trả lại sau khi test.
  saved = await db.select({ key: settings.key, value: settings.value }).from(settings).where(inArray(settings.key, KEYS));
  await db.delete(settings).where(inArray(settings.key, KEYS));
  admin = await makeActor("settings_admin", "admin");
  manager = await makeActor("settings_manager", "manager");
});
afterAll(async () => {
  await db.delete(settings).where(inArray(settings.key, KEYS));
  if (saved.length) await db.insert(settings).values(saved);
  await cleanTestUsers();
});

describe("cài đặt", () => {
  test("chưa lưu thì trả mặc định", async () => {
    expect(await getSettings()).toEqual({ smsTemplate: DEFAULT_SMS_TEMPLATE, zaloUrl: "", pviAppUrl: "https://www.pvi.com.vn" });
  });

  test("Quản trị lưu rồi đọc lại được, ghi audit_log", async () => {
    const values = { smsTemplate: "{HO_TEN} da mo {NGAN_HANG}. Ma: {MA_VOUCHER}", zaloUrl: "https://zalo.me/0900000000", pviAppUrl: "https://pvi.example/app" };
    expect((await saveSettings(admin, values)).ok).toBe(true);
    expect(await getSettings()).toEqual(values);
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.userId, admin.id), eq(auditLog.action, "save_settings")));
    expect(rows).toHaveLength(1);
  });

  test("Quản lý không lưu được", async () => {
    expect((await saveSettings(manager, { smsTemplate: "x", zaloUrl: "", pviAppUrl: "" })).ok).toBe(false);
  });
});
