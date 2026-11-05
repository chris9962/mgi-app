import { inArray } from "drizzle-orm";
import { db } from "./db/client";
import { settings } from "./db/schema";
import { writeAudit } from "./audit";
import { can } from "@/lib/permissions";
import { DEFAULT_PVI_APP_URL, DEFAULT_SMS_TEMPLATE, type SettingsValues } from "@/lib/sms";
import type { SessionUser } from "@/lib/types";

const KEY = { smsTemplate: "sms_template", zaloUrl: "zalo_url", pviAppUrl: "pvi_app_url" } as const;
const DEFAULTS: SettingsValues = { smsTemplate: DEFAULT_SMS_TEMPLATE, zaloUrl: "", pviAppUrl: DEFAULT_PVI_APP_URL };

export async function getSettings(): Promise<SettingsValues> {
  const rows = await db.select().from(settings).where(inArray(settings.key, Object.values(KEY)));
  const value = (k: keyof SettingsValues) => {
    const v = rows.find((r) => r.key === KEY[k])?.value;
    return typeof v === "string" ? v : DEFAULTS[k];
  };
  return { smsTemplate: value("smsTemplate"), zaloUrl: value("zaloUrl"), pviAppUrl: value("pviAppUrl") };
}

export async function saveSettings(actor: SessionUser, values: SettingsValues, ip?: string | null): Promise<{ ok: true } | { ok: false; message: string; status: 403 }> {
  if (!can(actor, "system")) return { ok: false, message: "Chỉ Quản trị sửa được cài đặt.", status: 403 };
  const before = await getSettings();
  await db.transaction(async (tx) => {
    for (const k of Object.keys(KEY) as (keyof SettingsValues)[]) {
      await tx
        .insert(settings)
        .values({ key: KEY[k], value: values[k], updatedBy: actor.id, updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value: values[k], updatedBy: actor.id, updatedAt: new Date() } });
    }
    await writeAudit(tx, { userId: actor.id, action: "save_settings", targetType: "settings", targetId: "system", detail: { before, after: values }, ip });
  });
  return { ok: true };
}
