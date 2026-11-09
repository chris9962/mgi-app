import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { cleanTestUsers, makeActor } from "../db/helpers";
import { insertCustomer, setupProgram, type Program } from "../db/fixtures";
import { heicFixture } from "../support/heic";
import { db } from "../../src/server/db/client";
import { photoChecks, proofPhotos } from "../../src/server/db/schema";
import { SESSION_COOKIE, createSession } from "../../src/server/auth/session";
import { runPhotoCheck } from "../../src/server/photoCheckWorker";
import { deleteImage, imageExtOf, readImage } from "../../src/server/storage";
import { POST as replaceRoute } from "../../src/app/api/admin/customer-banks/[id]/photos/route";
import { POST as uploadRoute } from "../../src/app/api/admin/uploads/route";

// Chạy trên bucket dev mgi-bank-dev và DB local; mọi object test ghi đều xoá ở afterAll.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");

const SITE = `http://${process.env.ADMIN_HOST ?? "admin.localhost"}:3100`;
let p: Program;
let staffCookie = "";
let managerCookie = "";
const heic = heicFixture("heic-320x240.heic");
const keys: string[] = [];

const post = (path: string, cookie: string, form: FormData) => new Request(`${SITE}${path}`, { method: "POST", headers: { Origin: SITE, Cookie: `${SESSION_COOKIE}=${cookie}` }, body: form });

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("adup", ["A"]);
  const staff = await makeActor("adup_staff", "staff", [], [p.bank.A]);
  staffCookie = (await createSession(staff.id)).token;
  managerCookie = (await createSession(p.manager.id)).token;
});
afterAll(async () => {
  for (const key of keys) await deleteImage(key).catch(() => undefined);
  await cleanTestUsers();
});

describe("ảnh tải ở trang quản lý đổi WebP lúc nhận", () => {
  test("nhân viên tải HEIC làm ảnh thay thế: dòng ảnh mới có khoá .webp, dung lượng của object đã ghi, lượt kiểm ảnh đọc được", async () => {
    const c = await insertCustomer(p, { fullName: "Thay Ảnh Trần Minh Anh", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
    const form = new FormData();
    form.append("slotId", p.slot.A);
    form.append("file", new File([new Uint8Array(heic)], "IMG_0003.HEIC", { type: "image/heic" }));
    const res = await replaceRoute(post(`/api/admin/customer-banks/${c.rows.A}/photos`, staffCookie, form), { params: Promise.resolve({ id: c.rows.A }) });
    expect(res.status).toBe(204);

    const [row] = await db.select().from(proofPhotos).where(and(eq(proofPhotos.customerBankId, c.rows.A), isNull(proofPhotos.replacedAt)));
    keys.push(row.s3Key);
    expect(row.s3Key).toMatch(/^proofs\/.+\.webp$/);
    const body = (await readImage(row.s3Key))!;
    expect((await sharp(body).metadata()).format).toBe("webp");
    expect(row.sizeBytes).toBe(body.length);

    const [check] = await db.select().from(photoChecks).where(and(eq(photoChecks.customerBankId, c.rows.A), eq(photoChecks.status, "pending")));
    const read: string[] = [];
    const outcome = await runPhotoCheck(check.id, {
      read: readImage,
      ocr: async (image) => {
        read.push(imageExtOf(image) ?? "");
        return ["THAY ANH TRAN MINH ANH"];
      },
    });
    expect([outcome, read]).toEqual(["done", ["webp"]]);
    const [done] = await db.select().from(photoChecks).where(eq(photoChecks.id, check.id));
    expect([done.passed, done.total]).toEqual([1, 1]);
  }, 60_000);

  test("ảnh mẫu, ảnh QR và logo ngân hàng HEIC ghi thành WebP", async () => {
    for (const folder of ["samples", "qr", "logos"]) {
      const form = new FormData();
      form.append("file", new File([new Uint8Array(heic)], "IMG_0004.HEIC"));
      const res = await uploadRoute(post(`/api/admin/uploads?folder=${folder}`, managerCookie, form));
      expect(res.status).toBe(201);
      const { key } = (await res.json()) as { key: string };
      keys.push(key);
      expect(key).toMatch(new RegExp(`^${folder}/.+\\.webp$`));
      expect((await sharp((await readImage(key))!).metadata()).format).toBe("webp");
    }
  }, 60_000);
});
