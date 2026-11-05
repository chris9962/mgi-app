import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { cleanTestUsers } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, photoChecks, proofPhotos } from "../../src/server/db/schema";
import { queuePhotoChecks } from "../../src/server/photoChecks";
import { BATCH, pendingPhotoCheckIds, runPhotoCheck, type PhotoCheckDeps } from "../../src/server/photoCheckWorker";
import { newKey } from "../../src/server/storage";

// S3 và OCR là hệ ngoài: ảnh giả là chữ UTF-8, OCR giả trả từng dòng của chữ đó. Test OCR thật nằm ở tests/s3/photoCheckOcr.test.ts.
let p: Program;
const images = new Map<string, Uint8Array>();
const ocrCalls: { text: string; code?: string }[] = [];
const fake = (over: Partial<PhotoCheckDeps> = {}): PhotoCheckDeps => ({
  read: async (key) => images.get(key) ?? null,
  ocr: async (image, code) => {
    const text = new TextDecoder().decode(image);
    ocrCalls.push({ text, code });
    return text.split("\n");
  },
  ...over,
});

type SlotSpec = { name: string; checkName?: boolean; checkCode?: boolean; removed?: boolean; photo?: string };

// Ngân hàng A của chương trình test, thêm khung theo spec; mỗi lần gọi là một hồ sơ mới gửi kiểm tra.
async function submitted(slots: SlotSpec[], opts: { fullName?: string; code?: string } = {}) {
  await db.update(bankPhotoSlots).set({ removedAt: new Date() }).where(eq(bankPhotoSlots.bankId, p.bank.A));
  const ids: string[] = [];
  for (const [i, s] of slots.entries()) {
    const [row] = await db
      .insert(bankPhotoSlots)
      .values({ bankId: p.bank.A, name: s.name, sortOrder: i, checkName: s.checkName ?? false, checkCode: s.checkCode ?? false, removedAt: s.removed ? new Date() : null })
      .returning({ id: bankPhotoSlots.id });
    ids.push(row.id);
  }
  const c = await insertCustomer(p, { fullName: opts.fullName ?? "Trần Minh Anh", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
  const cb = c.rows.A;
  await db.update(customerBanks).set({ referralCode: opts.code ?? "ND-TPB-01" }).where(eq(customerBanks.id, cb));
  for (const [i, s] of slots.entries()) {
    if (s.photo === undefined) continue;
    const key = newKey("proofs", "webp");
    images.set(key, new TextEncoder().encode(s.photo));
    await db.insert(proofPhotos).values({ customerBankId: cb, slotId: ids[i], s3Key: key, sizeBytes: s.photo.length });
  }
  await db.transaction((tx) => queuePhotoChecks(tx, [cb]));
  const [check] = await db.select().from(photoChecks).where(and(eq(photoChecks.customerBankId, cb), eq(photoChecks.status, "pending")));
  return { cb, checkId: check.id, slotIds: ids };
}

const checksOf = (cb: string) => db.select().from(photoChecks).where(eq(photoChecks.customerBankId, cb));
const checkRow = async (id: string) => (await db.select().from(photoChecks).where(eq(photoChecks.id, id)))[0];

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("pchk", ["A"]);
});
afterAll(cleanTestUsers);

describe("hàng chờ kiểm ảnh", () => {
  test("mỗi dòng ngân hàng chỉ một lượt pending: chèn lượt thứ hai bị DB từ chối", async () => {
    const { cb } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    await expect(db.insert(photoChecks).values({ customerBankId: cb }).then(() => "ghi được")).rejects.toThrow();
    await db.insert(photoChecks).values({ customerBankId: cb, status: "done" });
  });

  test("hàng chờ giới hạn theo trường không có lượt của trường khác", async () => {
    const other = await setupProgram("pchx", ["A"]);
    const c = await insertCustomer(other, { fullName: "Lê Hoàng Nam", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
    await db.transaction((tx) => queuePhotoChecks(tx, [c.rows.A]));
    const [check] = await checksOf(c.rows.A);
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).not.toContain(check.id);
    expect(await pendingPhotoCheckIds(BATCH, [other.schoolId])).toContain(check.id);
  });

  test("xếp lượt thay lượt pending cũ bằng lượt mới", async () => {
    const { cb, checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    await db.transaction((tx) => queuePhotoChecks(tx, [cb]));
    const rows = await checksOf(cb);
    expect(rows.map((r) => r.status)).toEqual(["pending"]);
    expect(rows[0].id).not.toBe(checkId);
  });
});

describe("worker kiểm ảnh", () => {
  test("kết quả từng khung đúng dạng PhotoCheckItem, passed/total đếm khung có bật kiểm, không đổi trạng thái dòng ngân hàng", async () => {
    const { cb, checkId, slotIds } = await submitted([
      { name: "Ảnh màn hình chính", checkName: true, checkCode: true, photo: "Mở tài khoản thành công\nTRẦN MINH ANH\nMã giới thiệu\nND-TPB-01" },
      { name: "Ảnh chuyển khoản", checkName: true, photo: "Chuyển tiền thành công\nTRAN MINH" },
      { name: "Ảnh mã", checkCode: true, photo: "Mã giới thiệu ND-TPB-010" },
      { name: "Ảnh không kiểm", photo: "gì cũng được" },
      { name: "Ảnh khung đã bỏ", checkName: true, removed: true, photo: "TRAN MINH ANH" },
    ]);
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).toContain(checkId);
    expect(await runPhotoCheck(checkId, fake())).toBe("done");
    const row = await checkRow(checkId);
    expect([row.status, row.passed, row.total, row.error, row.checkedAt !== null]).toEqual(["done", 1, 3, "", true]);
    expect(row.result).toEqual([
      { slotId: slotIds[0], slotName: "Ảnh màn hình chính", expected: "Trần Minh Anh - ND-TPB-01", passed: true, reason: "Họ tên và mã giới thiệu" },
      { slotId: slotIds[1], slotName: "Ảnh chuyển khoản", expected: "Trần Minh Anh", passed: false, reason: "Không tìm thấy họ tên Trần Minh Anh trong ảnh." },
      { slotId: slotIds[2], slotName: "Ảnh mã", expected: "ND-TPB-01", passed: false, reason: "Không tìm thấy mã giới thiệu ND-TPB-01 trong ảnh." },
    ]);
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).not.toContain(checkId);
    const [bank] = await db.select({ status: customerBanks.status }).from(customerBanks).where(eq(customerBanks.id, cb));
    expect(bank.status).toBe("pending");
  });

  test("chỉ khung kiểm mã gửi mã cho OCR để đọc lại vùng O/0, I/1", async () => {
    ocrCalls.length = 0;
    const { checkId } = await submitted(
      [
        { name: "Ảnh tên", checkName: true, photo: "ẢNH TÊN\nTRAN MINH ANH" },
        { name: "Ảnh mã", checkCode: true, photo: "ẢNH MÃ\nBO08" },
      ],
      { code: "BO08" },
    );
    expect(await runPhotoCheck(checkId, fake())).toBe("done");
    expect(ocrCalls.map((c) => [c.text.split("\n")[0], c.code])).toEqual([
      ["ẢNH TÊN", undefined],
      ["ẢNH MÃ", "BO08"],
    ]);
    expect((await checkRow(checkId)).passed).toBe(2);
  });

  test("khung bật kiểm mà chưa có ảnh thì Không đạt, Chưa có ảnh", async () => {
    const { checkId } = await submitted([{ name: "Ảnh 1", checkName: true }]);
    expect(await runPhotoCheck(checkId, fake())).toBe("done");
    expect((await checkRow(checkId)).result).toMatchObject([{ passed: false, reason: "Chưa có ảnh." }]);
  });

  test("dòng ngân hàng không có mã chữ: khung chỉ kiểm mã không tính, khung kiểm cả hai chỉ so họ tên", async () => {
    const { checkId } = await submitted(
      [
        { name: "Ảnh 1", checkName: true, checkCode: true, photo: "TRAN MINH ANH" },
        { name: "Ảnh 2", checkCode: true, photo: "không có mã" },
      ],
      { code: "" },
    );
    expect(await runPhotoCheck(checkId, fake())).toBe("done");
    const row = await checkRow(checkId);
    expect([row.passed, row.total]).toEqual([1, 1]);
    expect(row.result).toMatchObject([{ slotName: "Ảnh 1", expected: "Trần Minh Anh", passed: true, reason: "Họ tên" }]);
  });

  test("ngân hàng đã tắt hết khung kiểm thì xoá lượt chờ, không ghi kết quả rỗng", async () => {
    const { cb, checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    await db.update(bankPhotoSlots).set({ checkName: false }).where(eq(bankPhotoSlots.bankId, p.bank.A));
    expect(await runPhotoCheck(checkId, fake())).toBe("dropped");
    expect(await checksOf(cb)).toEqual([]);
  });

  test("lượt bị thay trong lúc đọc thì bỏ kết quả, lượt mới vẫn chờ", async () => {
    const { cb, checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    const deps = fake({
      ocr: async (image) => {
        await db.transaction((tx) => queuePhotoChecks(tx, [cb]));
        return new TextDecoder().decode(image).split("\n");
      },
    });
    expect(await runPhotoCheck(checkId, deps)).toBe("dropped");
    const rows = await checksOf(cb);
    expect(rows.map((r) => [r.status, r.result, r.passed, r.total])).toEqual([["pending", null, 0, 0]]);
    expect(rows[0].id).not.toBe(checkId);
  });

  test("hai worker cùng lấy một lượt: chỉ một bên đọc ảnh và ghi", async () => {
    const { checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    let calls = 0;
    const slow = fake({
      ocr: async (image) => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 150));
        return new TextDecoder().decode(image).split("\n");
      },
    });
    const results = await Promise.all([runPhotoCheck(checkId, slow), runPhotoCheck(checkId, slow)]);
    expect(results.sort()).toEqual(["done", "skipped"]);
    expect(calls).toBe(1);
  });

  test("lượt đang có worker giữ thì vòng khác bỏ qua; giữ quá 5 phút thì lấy lại được", async () => {
    const { checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    await db.update(photoChecks).set({ claimedAt: sql`now() - interval '4 minutes'` }).where(eq(photoChecks.id, checkId));
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).not.toContain(checkId);
    expect(await runPhotoCheck(checkId, fake())).toBe("skipped");
    await db.update(photoChecks).set({ claimedAt: sql`now() - interval '6 minutes'` }).where(eq(photoChecks.id, checkId));
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).toContain(checkId);
    expect(await runPhotoCheck(checkId, fake())).toBe("done");
  });

  test("lỗi máy thì ghi failed kèm lý do, không thử lại", async () => {
    const { checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    const broken = fake({ ocr: async () => Promise.reject(new Error("Tiến trình OCR thoát (1).")) });
    expect(await runPhotoCheck(checkId, broken)).toBe("failed");
    const row = await checkRow(checkId);
    expect([row.status, row.error, row.result, row.checkedAt !== null]).toEqual(["failed", "Tiến trình OCR thoát (1).", null, true]);
    expect(await pendingPhotoCheckIds(BATCH, [p.schoolId])).not.toContain(checkId);
    expect(await runPhotoCheck(checkId, fake())).toBe("skipped");
  });

  test("ảnh không còn trên S3 thì ghi failed", async () => {
    const { checkId } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    expect(await runPhotoCheck(checkId, fake({ read: async () => null }))).toBe("failed");
    expect((await checkRow(checkId)).error).toBe("Không tải được ảnh Ảnh 1.");
  });

  test("ảnh vừa bị worker nén đổi khoá trong lúc đọc thì đọc lại khoá mới", async () => {
    const { checkId, cb } = await submitted([{ name: "Ảnh 1", checkName: true, photo: "TRAN MINH ANH" }]);
    const [photo] = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cb));
    const compressed = newKey("proofs", "webp");
    const deps = fake({
      read: async (key) => {
        if (key === photo.s3Key) {
          images.set(compressed, images.get(key)!);
          await db.update(proofPhotos).set({ s3Key: compressed }).where(eq(proofPhotos.id, photo.id));
          return null;
        }
        return images.get(key) ?? null;
      },
    });
    expect(await runPhotoCheck(checkId, deps)).toBe("done");
    expect((await checkRow(checkId)).passed).toBe(1);
  });
});
