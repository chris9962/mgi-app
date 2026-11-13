import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { BANK, SCHOOL, SLOT } from "../scripts/e2e-data-student";
import { ORIGIN, STUDENT, apiCreate, apiPhotos, apiPick, info, photoFile, withEdgeData, type ApiStudent } from "./edge-student-support";

withEdgeData();

const UNKNOWN = "e2e0a000-0000-4000-8000-0000000fffff";
// Câu lỗi tiếng Anh mặc định của zod hoặc của Next không được lọt tới học sinh.
const english = /invalid|expected|required|received|error/i;

const create = (request: APIRequestContext, data: unknown, headers: Record<string, string> = ORIGIN) =>
  request.post(`${STUDENT}/api/customers`, { headers: { ...headers, "Content-Type": "application/json" }, data: typeof data === "string" ? data : JSON.stringify(data) });

async function vietnamese400(res: Awaited<ReturnType<APIRequestContext["post"]>>) {
  expect(res.status()).toBe(400);
  const { message } = await res.json();
  expect(message).not.toMatch(english);
  return message as string;
}

async function atB3(request: APIRequestContext, name: string): Promise<ApiStudent> {
  const s = await apiCreate(request, SCHOOL.photo, info(name));
  await apiPick(request, s, [BANK.p1, BANK.p3]);
  return s;
}

const upload = (request: APIRequestContext, s: ApiStudent, customerBankId: string, slotId: string, file: { name: string; mimeType: string; buffer: Buffer }) =>
  request.post(`${STUDENT}/api/customers/me/photos`, { headers: s.auth, multipart: { customerBankId, slotId, file } });

// PNG vài trăm byte khai kích thước lớn: đủ IHDR, IDAT, IEND để thư viện ảnh đọc được phần đầu.
function pngClaiming(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.alloc(1000))), chunk("IEND", Buffer.alloc(0))]);
}

test("G1 tạo hồ sơ thiếu Origin, Origin trang khác, Origin trang quản lý: 403", async ({ request }) => {
  const body = { schoolId: SCHOOL.photo, ...info("Không Có Origin"), consent: true, existingBankIds: [] };
  for (const headers of [{}, { Origin: "http://evil.example" }, { Origin: "http://admin.localhost:3100" }, { Origin: "khong-phai-url" }] as Record<string, string>[]) {
    expect((await create(request, body, headers)).status(), JSON.stringify(headers)).toBe(403);
  }
});

test("G2 body không phải JSON, mảng, null, họ tên là số: 400 câu tiếng Việt", async ({ request }) => {
  await vietnamese400(await create(request, "khong phai json {"));
  await vietnamese400(await create(request, []));
  await vietnamese400(await create(request, null));
  expect(await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info("x"), fullName: 123, consent: true, existingBankIds: [] }))).toBe("Nhập họ và tên");
  expect(await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info(`${"A".repeat(101)}`), consent: true, existingBankIds: [] }))).toBe("Tối đa 100 ký tự");
  expect(await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info("Tên\u0000Có NUL"), consent: true, existingBankIds: [] }))).toBe("Có ký tự không hợp lệ");
  // \ud83c là nửa đầu của một emoji: JSON gửi được, cột jsonb của Postgres thì từ chối.
  for (const extra of [{ fullName: "Tên Nửa Emoji\ud83c" }, { className: "10A\ud83c" }, { parentName: "Phụ Huynh\ud83c" }]) {
    expect(await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info("Nửa Emoji", extra), consent: true, existingBankIds: [] })), JSON.stringify(extra)).toBe("Có ký tự không hợp lệ");
  }
});

test("G3 schoolId sai dạng, không có, trường đã đóng: 400, 404, 409", async ({ request }) => {
  const body = (schoolId: string) => ({ schoolId, ...info("Sai Trường"), consent: true, existingBankIds: [] });
  await vietnamese400(await create(request, body("abc")));
  const missing = await create(request, body(UNKNOWN));
  expect([missing.status(), (await missing.json()).message]).toEqual([404, "Không tìm thấy trường."]);
  const closed = await create(request, body(SCHOOL.closed));
  expect([closed.status(), (await closed.json()).message]).toEqual([409, "Trường đã đóng."]);
});

test("G4 existingBankIds 51 phần tử, id ngân hàng không có: 400", async ({ request }) => {
  await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info("Nhiều Ngân Hàng"), consent: true, existingBankIds: Array.from({ length: 51 }, () => randomUUID()) }));
  expect(await vietnamese400(await create(request, { schoolId: SCHOOL.photo, ...info("Ngân Hàng Lạ"), consent: true, existingBankIds: [UNKNOWN] }))).toBe("Ngân hàng không có trong danh sách.");
});

test("G5 tra trường bằng id sai dạng, id không có: 404", async ({ request }) => {
  for (const id of ["abc", UNKNOWN, "' or 1=1 --", "%00"]) expect((await request.get(`${STUDENT}/api/schools/${encodeURIComponent(id)}`)).status(), id).toBe(404);
});

test("G6 đọc hồ sơ thiếu token, token sai dạng, token 43 ký tự lạ: 401", async ({ request }) => {
  for (const authorization of [undefined, "Bearer abc", `Bearer ${"A".repeat(43)}`, `Basic ${"A".repeat(43)}`, `Bearer ${"A".repeat(43)} thua`]) {
    const res = await request.get(`${STUDENT}/api/customers/me`, { headers: authorization ? { Authorization: authorization } : {} });
    expect(res.status(), authorization).toBe(401);
  }
});

test("G7 giữ chỗ hai lần cùng ngân hàng, ngân hàng không ở trường, giữ chỗ lần hai: 400, 409, 409", async ({ request }) => {
  const s = await apiCreate(request, SCHOOL.photo, info("Giữ Chỗ Lạ"));
  const pick = (bankIds: string[]) => request.post(`${STUDENT}/api/customers/me/banks`, { headers: s.auth, data: { bankIds } });
  expect(await vietnamese400(await pick([BANK.p1, BANK.p1]))).toBe("Chọn đúng 2 ngân hàng.");
  expect((await pick([BANK.p1, BANK.longSpace])).status()).toBe(409);
  expect((await pick([BANK.p1, BANK.p3])).status()).toBe(204);
  expect((await pick([BANK.p1, BANK.p4])).status()).toBe(409);
  expect((await s.me()).banks.map((b) => b.bankId)).toEqual([BANK.p1, BANK.p3]);
});

test("G8 gửi kiểm tra khi còn khung trống, rồi gửi lần hai: 400, 409", async ({ request }) => {
  const s = await atB3(request, "Gửi Thiếu Ảnh");
  const submit = () => request.post(`${STUDENT}/api/customers/me/submit`, { headers: s.auth });
  await apiPhotos(request, s, [SLOT.p3]);
  expect(await vietnamese400(await submit())).toBe("Còn khung chưa có ảnh.");
  await apiPhotos(request, s, [SLOT.p1Main, SLOT.p1Transfer]);
  expect((await submit()).status()).toBe(204);
  expect((await submit()).status()).toBe(409);
});

test("G9 nộp ảnh vào dòng ngân hàng của học sinh khác, vào khung của ngân hàng khác: 404, không ghi ảnh", async ({ request }) => {
  const a = await atB3(request, "Học Sinh A");
  const b = await atB3(request, "Học Sinh B");
  const [aP1] = (await a.me()).banks;
  expect((await upload(request, b, aP1.id, SLOT.p1Main, photoFile())).status()).toBe(404);
  expect((await upload(request, a, aP1.id, SLOT.p3, photoFile())).status()).toBe(404);
  expect((await a.me()).banks.flatMap((x) => x.slots).filter((x) => x.photo)).toEqual([]);
});

test("E9, E10 thân request quá 22 MB: 413; file 20,5 MB có chữ ký JPEG: 400; cả hai báo lớn hơn 20 MB", async ({ request }) => {
  const s = await atB3(request, "Ảnh Quá Trần");
  const [p1] = (await s.me()).banks;
  const huge = await upload(request, s, p1.id, SLOT.p1Main, { name: "lon.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(23 * 1024 * 1024, 0xff) });
  expect([huge.status(), (await huge.json()).message]).toEqual([413, "Ảnh lớn hơn 20 MB."]);
  const over = Buffer.alloc(Math.round(20.5 * 1024 * 1024), 7);
  over.set([0xff, 0xd8, 0xff], 0);
  const res = await upload(request, s, p1.id, SLOT.p1Main, { name: "lon.jpg", mimeType: "image/jpeg", buffer: over });
  expect([res.status(), (await res.json()).message]).toEqual([400, "Ảnh lớn hơn 20 MB."]);
  expect((await s.me()).banks[0].slots[0].photo).toBeNull();
});

test("E11, E12 PNG vài trăm byte khai 20000x20000 và HEIC 8192x8192: nhận trong 5 giây, giữ bản gốc", async ({ request }) => {
  const s = await atB3(request, "Ảnh Khai Lớn");
  const [p1] = (await s.me()).banks;
  const started = Date.now();
  const png = await upload(request, s, p1.id, SLOT.p1Main, { name: "bom.png", mimeType: "image/png", buffer: pngClaiming(20000, 20000) });
  expect(png.status()).toBe(201);
  expect(Date.now() - started).toBeLessThan(5000);
  const heic = await upload(request, s, p1.id, SLOT.p1Transfer, { name: "IMG.HEIC", mimeType: "image/heic", buffer: readFileSync("tests/fixtures/heic-8192x8192-phang.heic") });
  expect(heic.status()).toBe(201);
  const [main, transfer] = (await s.me()).banks[0].slots;
  expect(new URL(main.photo!.url).pathname).toMatch(/\.png$/);
  expect(new URL(transfer.photo!.url).pathname).toMatch(/\.heic$/);
});
