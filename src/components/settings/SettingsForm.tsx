"use client";

import { MessageSquareText, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { renderSms, SettingsForm as Schema, SMS_FIELDS, SMS_SAMPLE, smsParts, type SettingsValues } from "@/lib/sms";
import { QrPreview } from "./QrPreview";

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const sample = renderSms(values.smsTemplate, SMS_SAMPLE);
  const set = (k: keyof SettingsValues) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  async function save() {
    setStatus("");
    const parsed = Schema.safeParse(values);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setPending(true);
    const r = await apiSend("PATCH", "/api/admin/settings", values);
    setPending(false);
    setStatus(r.ok ? "Đã lưu cấu hình." : r.message);
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mẫu SMS voucher" icon={<MessageSquareText size={17} aria-hidden />}>
          <div className="flex flex-col gap-3">
            <label htmlFor="sms-template" className="text-[13px] text-text-2">
              Nội dung, không dấu
            </label>
            <textarea
              id="sms-template"
              rows={4}
              value={values.smsTemplate}
              onChange={(e) => set("smsTemplate")(e.target.value)}
              aria-invalid={errors.smsTemplate ? true : undefined}
              aria-describedby="sms-count"
              className={`${inputClass} font-mono text-[13px] leading-6`}
            />
            {errors.smsTemplate && <span className="text-[13px] text-danger">{errors.smsTemplate}</span>}
            <div className="flex flex-wrap gap-1.5">
              {SMS_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set("smsTemplate")(`${values.smsTemplate}{${f}}`)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs hover:border-accent"
                  aria-label={`Thêm ${f} vào mẫu`}
                >
                  {`{${f}}`}
                </button>
              ))}
            </div>
            <p className="rounded-[10px] bg-panel p-3 text-[13px] leading-5">{sample}</p>
            <span id="sms-count" className="text-[13px] text-text-2">
              {sample.length}/160 ký tự, {smsParts(sample)} tin
            </span>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="QR kết bạn Zalo" icon={<QrCode size={17} aria-hidden />}>
            <div className="flex items-start gap-4">
              <QrPreview value={values.zaloUrl} label="QR kết bạn Zalo" />
              <div className="flex-1">
                <TextField label="Link Zalo" value={values.zaloUrl} onChange={(e) => set("zaloUrl")(e.target.value)} error={errors.zaloUrl} placeholder="https://zalo.me/…" />
              </div>
            </div>
          </Card>
          <Card title="QR tới app PVI" icon={<QrCode size={17} aria-hidden />}>
            <div className="flex items-start gap-4">
              <QrPreview value={values.pviAppUrl} label="QR tới app PVI" />
              <div className="flex-1">
                <TextField label="Link app PVI" value={values.pviAppUrl} onChange={(e) => set("pviAppUrl")(e.target.value)} error={errors.pviAppUrl} />
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        {status && (
          <span role="status" className="text-sm text-text-2">
            {status}
          </span>
        )}
        <Button onClick={save} disabled={pending}>
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}
