import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";
import { BankChoiceForm, CustomerForm, PhotoTargetForm } from "../../src/lib/customerForm";

const UUID = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
const VALID = { schoolId: UUID, fullName: "Trần Minh Anh", className: "11A3", phone: "0912345678", parentPhone: "0987654321", consent: true, existingBankIds: [] };
// Câu báo lỗi tiếng Việt luôn có ít nhất một chữ có dấu; câu mặc định của zod ("Invalid input...") thì không.
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const messages = (schema: ZodType, input: unknown) => schema.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe("câu báo lỗi của form học sinh", () => {
  const cases: [string, ZodType, unknown][] = [
    ["body rỗng", CustomerForm, null],
    ["thiếu trường", CustomerForm, {}],
    ["id trường sai", CustomerForm, { ...VALID, schoolId: "abc" }],
    ["họ tên là số", CustomerForm, { ...VALID, fullName: 123 }],
    ["SĐT là số", CustomerForm, { ...VALID, phone: 912345678 }],
    ["ngân hàng đã có sai id", CustomerForm, { ...VALID, existingBankIds: ["x"] }],
    ["ngân hàng đã có không phải mảng", CustomerForm, { ...VALID, existingBankIds: "x" }],
    ["lớp quá dài", CustomerForm, { ...VALID, className: "A".repeat(30) }],
    ["thiếu đồng ý", CustomerForm, { ...VALID, consent: undefined }],
    ["đồng ý là false", CustomerForm, { ...VALID, consent: false }],
    ["chọn ngân hàng: body rỗng", BankChoiceForm, null],
    ["chọn ngân hàng: id sai", BankChoiceForm, { bankIds: ["x"] }],
    ["chọn ngân hàng: 3 ngân hàng", BankChoiceForm, { bankIds: [UUID, UUID, UUID] }],
    ["nộp ảnh: thiếu hết", PhotoTargetForm, {}],
    ["nộp ảnh: khung sai", PhotoTargetForm, { customerBankId: UUID, slotId: "y" }],
    ["nộp ảnh: không phải chuỗi", PhotoTargetForm, { customerBankId: null, slotId: 5 }],
  ];
  for (const [name, schema, input] of cases) {
    test(`${name}: mọi câu báo lỗi là tiếng Việt`, () => {
      const list = messages(schema, input);
      expect(list.length).toBeGreaterThan(0);
      for (const m of list) expect(m).toMatch(VIETNAMESE);
    });
  }
});

describe("ký tự điều khiển", () => {
  test("NUL và ký tự điều khiển trong họ tên, lớp bị từ chối", () => {
    for (const bad of [{ fullName: "Trần\u0000Anh" }, { className: "11A\u0000" }, { fullName: "An\u007f" }]) {
      const r = CustomerForm.safeParse({ ...VALID, ...bad });
      expect(r.success).toBe(false);
      expect(r.error!.issues[0].message).toMatch(VIETNAMESE);
    }
  });

  test("tab và xuống dòng trong họ tên thành dấu cách", () => {
    expect(CustomerForm.parse({ ...VALID, fullName: "Trần\tMinh\nAnh" }).fullName).toBe("Trần Minh Anh");
  });
});
