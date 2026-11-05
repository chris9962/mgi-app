import { smsParts } from "@/lib/sms";

export type SmsResult = { ok: true; providerMessageId: string | null } | { ok: false; error: string };
export type SmsSender = (to: string, body: string) => Promise<SmsResult>;

// Hàm gửi dùng chung cho worker. Bản đầu chưa nối nhà cung cấp: chỉ ghi số nhận và nội dung ra log; nối nhà cung cấp thì chỉ sửa hàm này.
export const sendSms: SmsSender = async (to, body) => {
  console.log(`[sms] tới ${to}, ${smsParts(body)} tin: ${body}`);
  return { ok: true, providerMessageId: null };
};
