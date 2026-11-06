import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots } from "../../src/server/db/schema";
import { loadSessionUser } from "../../src/server/auth/session";
import { createBank, getGuide, listBanks, managerOptions, saveGuide, setBankActive, updateBank } from "../../src/server/banks";
import { BankForm, GuideForm } from "../../src/lib/bankForm";
import type { SessionUser } from "../../src/lib/types";

const form = (code: string, name: string, managerIds: string[] = []) => BankForm.parse({ code, name: TEST_NAME + name, sortOrder: "1", managerIds });

let manager: SessionUser;
let holder: SessionUser;
let plain: SessionUser;
let staff: SessionUser;

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("bank_manager", "manager");
  holder = await makeActor("bank_holder", "staff", ["manage_banks"]);
  plain = await makeActor("bank_plain", "staff");
  staff = await makeActor("bank_staff", "staff");
});
afterAll(cleanTestUsers);

describe("ngân hàng", () => {
  test("chỉ người có quyền Quản lý ngân hàng tạo được ngân hàng", async () => {
    expect((await createBank(manager, form("ZZTA", "A"))).ok).toBe(true);
    expect((await createBank(holder, form("ZZTB", "B"))).ok).toBe(true);
    expect((await createBank(plain, form("ZZTC", "C"))).ok).toBe(false);
  });

  test("mã ngân hàng trùng bị từ chối ở ô mã", async () => {
    expect(await createBank(manager, form("ZZTA", "A2"))).toMatchObject({ ok: false, field: "code" });
  });

  test("nhân viên được giao sửa được ngân hàng mình, không giao lại người quản, không sửa ngân hàng khác", async () => {
    const mine = await createBank(manager, form("ZZTD", "D", [staff.id]));
    const other = await createBank(manager, form("ZZTE", "E"));
    if (!mine.ok || !other.ok) throw new Error("tạo ngân hàng lỗi");
    const me = (await loadSessionUser(staff.id))!;
    expect(me.managedBankIds).toContain(mine.id);
    expect((await updateBank(me, mine.id, form("ZZTD", "D đã sửa", []))).ok).toBe(true);
    expect((await loadSessionUser(staff.id))!.managedBankIds).toContain(mine.id);
    expect((await updateBank(me, other.id, form("ZZTE", "E sửa"))).ok).toBe(false);
    expect((await setBankActive(me, other.id, false)).ok).toBe(false);
    const visible = (await listBanks(me)).map((b) => b.id);
    expect(visible).toEqual([mine.id]);
    expect((await listBanks(me))[0].managers.map((m) => m.id)).toEqual([staff.id]);
  });

  test("bỏ khung ảnh thì ghi removed_at, không xoá dòng", async () => {
    const bank = await createBank(manager, form("ZZTG", "G"));
    if (!bank.ok) throw new Error(bank.message);
    const g = (slots: object[], seenSlotIds: string[] = []) => GuideForm.parse({ steps: ["Tải app", "Mở tài khoản"], slots, seenSlotIds });
    expect((await saveGuide(manager, bank.id, g([{ name: "Ảnh màn hình chính", sampleKey: null, checkName: true, checkCode: true }, { name: "Ảnh chuyển khoản", sampleKey: null, checkName: true, checkCode: false }]))).ok).toBe(true);
    const first = (await getGuide(bank.id))!;
    expect(first.steps).toEqual(["Tải app", "Mở tài khoản"]);
    expect(first.slots.map((s) => s.name)).toEqual(["Ảnh màn hình chính", "Ảnh chuyển khoản"]);
    expect((await saveGuide(manager, bank.id, g([{ ...first.slots[0], name: "Màn hình chính" }], first.slots.map((s) => s.id)))).ok).toBe(true);
    const after = (await getGuide(bank.id))!;
    expect(after.slots.map((s) => s.name)).toEqual(["Màn hình chính"]);
    const rows = await db.select().from(bankPhotoSlots).where(eq(bankPhotoSlots.bankId, bank.id));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.removedAt !== null)).toHaveLength(1);
    expect((await listBanks(manager)).find((b) => b.id === bank.id)?.slotCount).toBe(1);
  });

  test("khung ảnh của ngân hàng khác bị từ chối", async () => {
    const a = await createBank(manager, form("ZZTH", "H"));
    const b = await createBank(manager, form("ZZTI", "I"));
    if (!a.ok || !b.ok) throw new Error("tạo ngân hàng lỗi");
    await saveGuide(manager, a.id, GuideForm.parse({ steps: [], slots: [{ name: "A1", sampleKey: null, checkName: false, checkCode: false }], seenSlotIds: [] }));
    const slotOfA = (await getGuide(a.id))!.slots[0];
    const r = await saveGuide(manager, b.id, GuideForm.parse({ steps: [], slots: [{ ...slotOfA }], seenSlotIds: [] }));
    expect(r.ok).toBe(false);
  });

  test("ô chọn người quản chỉ có Nhân viên đang hoạt động", async () => {
    const options = await managerOptions("zz_test_bank");
    expect(options.map((o) => o.id).sort()).toEqual([holder.id, plain.id, staff.id].sort());
  });
});
