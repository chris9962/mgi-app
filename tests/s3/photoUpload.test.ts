import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { cleanTestUsers } from "../db/helpers";
import { setupProgram, type Program } from "../db/fixtures";
import { screenshot } from "../support/screenshot";
import { db } from "../../src/server/db/client";
import { customerBanks, customers, proofPhotos } from "../../src/server/db/schema";
import { createCustomer, reserveBanks, submitForReview, type Customer } from "../../src/server/customers";
import { s3PhotoStore, uploadPhoto } from "../../src/server/customerPhotos";
import { deleteImage, readImage } from "../../src/server/storage";
import { CustomerForm } from "../../src/lib/customerForm";
import { POST as photosRoute } from "../../src/app/api/customers/me/photos/route";

// Chạy trên bucket dev mgi-bank-dev và DB local; mọi object test ghi đều xoá ở afterAll.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");

const SITE = `http://${process.env.STUDENT_HOST ?? "bank.localhost"}:3100`;
let p: Program;
let phoneSeq = 700;
const keys = new Set<string>();

async function student(): Promise<{ customer: Customer; token: string; customerBankId: string }> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId: p.schoolId, fullName: "Học Sinh Tải", className: "10A1", phone: `0900000${phoneSeq}`, parentPhone: `0910000${phoneSeq}`, consent: true, existingBankIds: [] }),
    null,
    "2026-11",
  );
  if (!r.ok) throw new Error(r.message);
  const fresh = async () => (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
  const reserved = await reserveBanks(await fresh(), [p.bank.A], "2026-11");
  if (!reserved.ok) throw new Error(reserved.message);
  const [cb] = await db.select().from(customerBanks).where(eq(customerBanks.customerId, r.id));
  return { customer: await fresh(), token: r.token, customerBankId: cb.id };
}

const send = (token: string, customerBankId: string, bytes: Uint8Array) => {
  const form = new FormData();
  form.append("customerBankId", customerBankId);
  form.append("slotId", p.slot.A);
  form.append("file", new File([new Uint8Array(bytes)], "IMG_0001.png"));
  return photosRoute(new Request(`${SITE}/api/customers/me/photos`, { method: "POST", headers: { Origin: SITE, Authorization: `Bearer ${token}` }, body: form }));
};

async function activeRows(customerBankId: string) {
  const rows = await db.select().from(proofPhotos).where(and(eq(proofPhotos.customerBankId, customerBankId), isNull(proofPhotos.replacedAt)));
  for (const r of rows) keys.add(r.s3Key);
  return rows;
}

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("upl", ["A"]);
});
afterAll(async () => {
  for (const key of keys) await deleteImage(key).catch(() => undefined);
  await cleanTestUsers();
});

describe("B3 gửi ảnh qua API", () => {
  test("PNG gửi qua route thành WebP trong proofs/, cạnh dài 1600, dung lượng của object đã ghi", async () => {
    const s = await student();
    const res = await send(s.token, s.customerBankId, await screenshot(2400, 3200, "png"));
    expect(res.status).toBe(201);
    const [row] = await activeRows(s.customerBankId);
    expect(row.s3Key).toMatch(/^proofs\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.webp$/);
    const body = (await readImage(row.s3Key))!;
    const meta = await sharp(body).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
    expect(row.sizeBytes).toBe(body.length);
  }, 30_000);

  test("chụp lại thì object cũ bị xoá trên S3", async () => {
    const s = await student();
    expect((await send(s.token, s.customerBankId, await screenshot(600, 800, "png"))).status).toBe(201);
    const [first] = await activeRows(s.customerBankId);
    expect((await send(s.token, s.customerBankId, await screenshot(600, 900, "png"))).status).toBe(201);
    const [second] = await activeRows(s.customerBankId);
    expect(second.s3Key).not.toBe(first.s3Key);
    expect(await readImage(first.s3Key)).toBeNull();
    expect(await readImage(second.s3Key)).not.toBeNull();
  }, 30_000);

  test("hai lần gửi cùng khung song song: còn một dòng, object của lần thua bị xoá trên S3", async () => {
    const s = await student();
    const written: string[] = [];
    const store = {
      ...s3PhotoStore,
      put: async (bytes: Uint8Array) => {
        const r = await s3PhotoStore.put(bytes);
        if (r.ok) {
          written.push(r.key);
          keys.add(r.key);
        }
        return r;
      },
    };
    const target = { customerBankId: s.customerBankId, slotId: p.slot.A };
    const results = await Promise.all([600, 700].map(async (h) => uploadPhoto(s.customer, target, await screenshot(500, h, "png"), store)));
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const rows = await activeRows(s.customerBankId);
    expect(rows.length).toBe(1);
    expect(written.length).toBe(2);
    const [loser] = written.filter((k) => k !== rows[0].s3Key);
    expect(await readImage(loser)).toBeNull();
    expect(await readImage(rows[0].s3Key)).not.toBeNull();
  }, 30_000);

  test("hồ sơ bị gửi kiểm tra trong lúc ảnh đang ghi S3: từ chối và object vừa ghi bị xoá trên S3", async () => {
    const s = await student();
    expect((await send(s.token, s.customerBankId, await screenshot(400, 600, "png"))).status).toBe(201);
    await activeRows(s.customerBankId);
    let written = "";
    const store = {
      ...s3PhotoStore,
      put: async (bytes: Uint8Array) => {
        const r = await s3PhotoStore.put(bytes);
        if (r.ok) {
          written = r.key;
          keys.add(r.key);
        }
        expect(await submitForReview(s.customer)).toEqual({ ok: true });
        return r;
      },
    };
    expect(await uploadPhoto(s.customer, { customerBankId: s.customerBankId, slotId: p.slot.A }, await screenshot(400, 700, "png"), store)).toMatchObject({ ok: false, status: 409 });
    expect(written).not.toBe("");
    expect(await readImage(written)).toBeNull();
  }, 30_000);
});
