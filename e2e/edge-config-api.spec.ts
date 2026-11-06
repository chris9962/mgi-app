import { expect, test } from "@playwright/test";
import { api, apiLogin, BASE, newPage, ORIGIN } from "./edge-config-support";

const ID = "00000000-0000-4000-8000-00000000c0de";
const WRITES: [string, string][] = [
  ["POST", "/api/admin/schools"],
  ["PATCH", `/api/admin/schools/${ID}`],
  ["POST", `/api/admin/schools/${ID}/active`],
  ["POST", "/api/admin/banks"],
  ["PATCH", `/api/admin/banks/${ID}`],
  ["POST", `/api/admin/banks/${ID}/active`],
  ["PUT", `/api/admin/banks/${ID}/guide`],
  ["POST", "/api/admin/referral-codes"],
  ["PATCH", `/api/admin/referral-codes/${ID}`],
  ["POST", `/api/admin/referral-codes/${ID}/active`],
  ["POST", "/api/admin/users"],
  ["PATCH", `/api/admin/users/${ID}`],
  ["POST", `/api/admin/users/${ID}/lock`],
  ["POST", `/api/admin/users/${ID}/reset-password`],
  ["PATCH", "/api/admin/profile"],
  ["POST", "/api/admin/profile/password"],
  ["PATCH", "/api/admin/settings"],
  ["POST", "/api/admin/uploads?folder=qr"],
];

test("API: mọi route ghi không có Origin hoặc Origin lạ trả 403; không có phiên trả 401", async ({ browser }) => {
  const page = await newPage(browser);
  await apiLogin(page, "zz_e2e_admin");
  const anon = await newPage(browser);
  for (const [method, url] of WRITES) {
    for (const headers of [{}, { Origin: "http://evil.example" }, { Origin: "http://bank.localhost:3100" }] as Record<string, string>[]) {
      expect([method, url, headers.Origin ?? "", (await api(page, method, url, {}, headers)).status]).toEqual([method, url, headers.Origin ?? "", 403]);
    }
    expect([method, url, (await api(anon, method, url, {})).status]).toEqual([method, url, 401]);
  }
});

test("API: thân không phải JSON, active là chuỗi, thiếu trường trả 400, không lỗi 500", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  for (const [method, url] of WRITES.filter(([, u]) => !u.includes("uploads") && !u.includes("reset-password"))) {
    const res = await page.request.fetch(url, { method, headers: { ...ORIGIN, "content-type": "application/json" }, data: "{không phải json", maxRedirects: 0 });
    expect([method, url, res.status()]).toEqual([method, url, 400]);
  }
  for (const url of [`/api/admin/schools/${ID}/active`, `/api/admin/banks/${ID}/active`, `/api/admin/referral-codes/${ID}/active`, `/api/admin/users/${ID}/lock`]) {
    expect([url, (await api(page, "POST", url, { active: "true" })).status]).toEqual([url, 400]);
  }
  expect((await api(page, "POST", "/api/admin/schools", { name: 1, provinceCode: null })).status).toBe(400);
  expect((await api(page, "POST", "/api/admin/users", [])).status).toBe(400);
});

test("API: tải ảnh thư mục lạ, không có file, file 0 byte, file không phải ảnh trả 400; xem ảnh khoá sai dạng hoặc khoá ảnh học sinh trả 404; xã của tỉnh sai dạng trả rỗng", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const upload = (folder: string, file?: { name: string; mimeType: string; buffer: Buffer }) =>
    page.request.post(`${BASE}/api/admin/uploads?folder=${folder}`, { headers: ORIGIN, multipart: file ? { file } : { other: "x" } });
  const png = { name: "a.png", mimeType: "image/png", buffer: Buffer.from("không phải ảnh") };
  for (const folder of ["proofs", "abc", "", "..%2Fqr"]) expect([folder, (await upload(folder, png)).status()]).toEqual([folder, 400]);
  expect((await upload("qr")).status()).toBe(400);
  expect((await upload("samples", { name: "rong.png", mimeType: "image/png", buffer: Buffer.alloc(0) })).status()).toBe(400);
  const notImage = await upload("samples", png);
  expect(notImage.status()).toBe(400);
  expect(await notImage.json()).toEqual({ message: "Chỉ nhận ảnh jpg, png, webp hoặc heic." });

  for (const key of ["", "abc", "../secret", "proofs/2026-11/x.webp", "samples/../../x", "qr/" + "a".repeat(500)]) {
    expect([key, (await api(page, "GET", `/api/admin/images?key=${encodeURIComponent(key)}`)).status]).toEqual([key, 404]);
  }
  for (const province of ["abc", "", "1", "999", "80' or 1=1"]) {
    const r = await api(page, "GET", `/api/admin/wards?province=${encodeURIComponent(province)}`);
    expect([province, r.status, r.body]).toEqual([province, 200, []]);
  }
});
