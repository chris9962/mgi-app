"use client";

import { HeartHandshake, MessageSquareText, QrCode, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { INSURANCE_PRODUCTS, type InsuranceKey } from "@/lib/insurance";
import { renderSms, SettingsForm as Schema, SMS_FIELDS, SMS_SAMPLE, smsParts, type SettingsValues } from "@/lib/sms";
import { QrPreview } from "./QrPreview";

// Khoá cài đặt của từng sản phẩm bảo hiểm: link và hướng dẫn mua.
const INSURANCE_FIELDS: Record<InsuranceKey, { url: keyof SettingsValues; guide: keyof SettingsValues }> = {
  student: { url: "insuranceStudentUrl", guide: "insuranceStudentGuide" },
  moto: { url: "insuranceMotoUrl", guide: "insuranceMotoGuide" },
  electric: { url: "insuranceElectricUrl", guide: "insuranceElectricGuide" },
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const id = useId();
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

  const textarea = (k: keyof SettingsValues, label: string, rows: number, hint?: string) => {
    const fieldId = `${id}-${k}`;
    return (
      <Field id={fieldId} label={label} error={errors[k]} hint={hint}>
        <textarea id={fieldId} rows={rows} value={values[k]} onChange={(e) => set(k)(e.target.value)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${fieldId}-error` : undefined} className={`${inputClass} leading-6`} />
      </Field>
    );
  };

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
              aria-describedby={errors.smsTemplate ? "sms-count sms-template-error" : "sms-count"}
              className={`${inputClass} font-mono text-[13px] leading-6`}
            />
            {errors.smsTemplate && (
              <span id="sms-template-error" className="text-[13px] text-danger">
                {errors.smsTemplate}
              </span>
            )}
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
        <Card title="Bảo hiểm ở màn Kết quả" icon={<ShieldCheck size={17} aria-hidden />} meta="Sản phẩm chưa có link thì web học sinh không hiện">
          <div className="flex flex-col gap-5">
            {INSURANCE_PRODUCTS.map((p) => (
              <fieldset key={p.key} className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">{p.name}</legend>
                <TextField label="Link MyPVI" value={values[INSURANCE_FIELDS[p.key].url]} onChange={(e) => set(INSURANCE_FIELDS[p.key].url)(e.target.value)} error={errors[INSURANCE_FIELDS[p.key].url]} placeholder="https://" />
                {textarea(INSURANCE_FIELDS[p.key].guide, "Hướng dẫn mua", 3)}
              </fieldset>
            ))}
          </div>
        </Card>
        <Card title="Lời cảm ơn cuối màn Kết quả" icon={<HeartHandshake size={17} aria-hidden />}>
          {textarea("thanksText", "Nội dung", 2, "Để trống thì dùng câu mặc định")}
        </Card>
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
