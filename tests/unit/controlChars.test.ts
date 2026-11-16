import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";
import { BankForm, GuideForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "../../src/lib/controlChars";
import { CustomerEditForm, CustomerForm } from "../../src/lib/customerForm";
import { InfoForm } from "../../src/lib/profileForm";
import { NoteForm } from "../../src/lib/reviewForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { SettingsForm } from "../../src/lib/sms";
import { UserForm } from "../../src/lib/userForm";

const UUID = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
// Nửa đầu của 🎓: JSON.stringify giữ nguyên dạng \ud83c, cột jsonb của Postgres từ chối.
const HIGH = "\ud83c";
const LOW = "\udf93";
const INFO = { fullName: "Trần Minh Anh", className: "11A3", phone: "0912345678", parentPhone: "0987654321" };

const FORMS: [string, ZodType, Record<string, unknown>, string[]][] = [
  ["Trường", SchoolForm, { name: "THPT A", provinceCode: "80", wardCode: "25585", contactName: "Người liên hệ", contactPhone: "0903111222" }, ["name", "provinceCode", "wardCode", "contactName"]],
  ["Ngân hàng", BankForm, { code: "ZZ", name: "Ngân hàng", sortOrder: "1", managerIds: [] }, ["name"]],
  ["Hướng dẫn", GuideForm, { steps: ["Tải app"], slots: [{ name: "Ảnh một", sampleKey: null, checkName: false, checkCode: false }], seenSlotIds: [] }, ["steps.0", "slots.0.name"]],
  ["Kho mã", CodeForm, { bankId: UUID, displayName: "Mã", code: "ABC", qrKey: null, openUrl: "https://a.vn/x", monthlyQuota: "1", priority: "0", schoolIds: [] }, ["displayName", "code", "openUrl"]],
  ["Tài khoản", UserForm, { fullName: "Người dùng", staffCode: "S1", phone: "", username: "abc", role: "staff", title: "Chức danh", permissions: [] }, ["fullName", "staffCode", "title"]],
  ["Cá nhân", InfoForm, { fullName: "Người dùng", phone: "" }, ["fullName"]],
  ["Cài đặt", SettingsForm, { smsTemplate: "Ma {MA_VOUCHER}", zaloUrl: "https://zalo.me/a", pviAppUrl: "https://pvi.vn" }, ["zaloUrl", "pviAppUrl"]],
  ["Học sinh", CustomerForm, { schoolId: UUID, ...INFO, consent: true, existingBankIds: [] }, ["fullName", "className"]],
  ["Sửa thông tin", CustomerEditForm, INFO, ["fullName", "className"]],
  ["Ghi chú", NoteForm, { note: "Ghi chú" }, ["note"]],
];

const withText = (base: Record<string, unknown>, path: string, text: string) => {
  const body = structuredClone(base);
  const keys = path.split(".");
  let node = body as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
  node[keys.at(-1)!] = `${String(node[keys.at(-1)!])}${text}`;
  return body;
};

describe("nửa cặp surrogate", () => {
  test("luật chung: nửa đầu, nửa sau đứng lẻ bị chặn; emoji đủ cặp và chữ có dấu vẫn nhận", () => {
    for (const bad of [HIGH, LOW, `a${HIGH}b`, `${LOW}${HIGH}`, `🎓${HIGH}`]) expect([bad, noControlChar(bad)]).toEqual([bad, false]);
    for (const ok of ["🎓", `${HIGH}${LOW}`, "Nguyễn Thị Ánh", "👩‍🎓", "à"]) expect([ok, noControlChar(ok)]).toEqual([ok, true]);
  });

  for (const [name, schema, base, paths] of FORMS) {
    test(`${name}: mọi ô chữ có nửa cặp surrogate báo Có ký tự không hợp lệ ở đúng ô; emoji đủ cặp vẫn nhận`, () => {
      expect(schema.safeParse(base).success).toBe(true);
      for (const path of paths) {
        const issues = schema.safeParse(withText(base, path, `${HIGH}x`)).error?.issues ?? [];
        expect([path, issues.map((i) => [i.path.join("."), i.message])]).toEqual([path, [[path, CONTROL_CHAR_MESSAGE]]]);
        if (!["provinceCode", "wardCode", "openUrl", "zaloUrl", "pviAppUrl"].includes(path)) expect([path, schema.safeParse(withText(base, path, " 🎓")).success]).toEqual([path, true]);
      }
    });
  }
});
