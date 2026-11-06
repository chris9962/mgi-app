import { expect, test, type Page } from "@playwright/test";
import { api, apiLogin, asUser, BASE, createBank, createCode, createSchool, createUser, newPage, open, ORIGIN, PASSWORD, WARD } from "./edge-config-support";

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

test("API: ký tự NUL, ký tự điều khiển, nửa cặp surrogate ở mọi ô chữ của form trả 400 kèm ô lỗi, không lỗi 500; đăng nhập với tên có NUL trả 401", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await asUser(browser, "zz_e2e_admin");
  const bankId = await createBank(admin, "ZZCNUL", "ZZE2E Ký tự lạ");
  const schoolId = await createSchool(admin, "ZZE2E Ký tự lạ");
  const codeId = await createCode(admin, bankId, "ZZE2E Ký tự lạ");
  const target = await createUser(admin, { fullName: "E2E C Ký tự lạ", username: "zz_e2e_c_kytu" });
  const self = await asUser(browser, "zz_e2e_c_kytu", target.password);
  // Cài đặt là cấu hình dùng chung của DB local: đọc giá trị đang lưu, test xong ghi lại đúng giá trị đó.
  await open(admin, "/settings");
  const before = { smsTemplate: await admin.getByLabel("Nội dung, không dấu").inputValue(), zaloUrl: await admin.getByLabel("Link Zalo").inputValue(), pviAppUrl: await admin.getByLabel("Link app PVI").inputValue() };
  const settings = { ...before, zaloUrl: "https://zalo.me/abc", pviAppUrl: "https://www.pvi.com.vn" };

  const school = { name: "ZZE2E Ký tự lạ mới", ...WARD, contactName: "Người liên hệ", contactPhone: "0903111222" };
  const bank = { code: "ZZCNUL2", name: "ZZE2E Ký tự lạ mới", sortOrder: "1", managerIds: [] };
  const guide = { steps: ["Tải app"], slots: [{ name: "Ảnh một", sampleKey: null, checkName: false, checkCode: false }], seenSlotIds: [] };
  const code = { bankId, displayName: "ZZE2E Ký tự lạ mới", code: "ZZC-NUL", qrKey: null, openUrl: "https://example.com/mo", monthlyQuota: "5", priority: "0", schoolIds: [] };
  const user = { fullName: "E2E C Ký tự lạ mới", staffCode: "ZZCNUL", phone: "", username: "zz_e2e_c_kytu_moi", role: "staff", title: "Chức danh", permissions: [] };
  const userEdit = { ...user, fullName: "E2E C Ký tự lạ", username: "zz_e2e_c_kytu", staffCode: "" };
  const cases: [Page, string, string, Record<string, unknown>, string[]][] = [
    [admin, "POST", "/api/admin/schools", school, ["name", "provinceCode", "wardCode", "contactName", "contactPhone"]],
    [admin, "PATCH", `/api/admin/schools/${schoolId}`, school, ["name", "provinceCode", "wardCode", "contactName", "contactPhone"]],
    [admin, "POST", "/api/admin/banks", bank, ["code", "name"]],
    [admin, "PATCH", `/api/admin/banks/${bankId}`, { ...bank, code: "ZZCNUL" }, ["code", "name"]],
    [admin, "PUT", `/api/admin/banks/${bankId}/guide`, guide, ["steps.0", "slots.0.name"]],
    [admin, "POST", "/api/admin/referral-codes", code, ["displayName", "code", "openUrl"]],
    [admin, "PATCH", `/api/admin/referral-codes/${codeId}`, code, ["displayName", "code", "openUrl"]],
    [admin, "POST", "/api/admin/users", user, ["fullName", "staffCode", "phone", "username", "title"]],
    [admin, "PATCH", `/api/admin/users/${target.id}`, userEdit, ["fullName", "staffCode", "phone", "username", "title"]],
    [self, "PATCH", "/api/admin/profile", { fullName: "E2E C Ký tự lạ", phone: "" }, ["fullName", "phone"]],
    [admin, "PATCH", "/api/admin/settings", settings, ["smsTemplate", "zaloUrl", "pviAppUrl"]],
  ];
  const withChar = (base: Record<string, unknown>, path: string, ch: string) => {
    const body = structuredClone(base) as Record<string, unknown>;
    const keys = path.split(".");
    let node = body as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
    const last = keys.at(-1)!;
    node[last] = `${String(node[last] ?? "")}${ch}x`;
    return body;
  };
  try {
    // \ud83c là nửa đầu của 🎓: JSON vẫn gửi được, cột jsonb của audit_log thì từ chối.
    for (const ch of ["\u0000", "\u0001", "\u007f", "\ud83c"]) {
      for (const [page, method, url, base, paths] of cases) {
        for (const path of paths) {
          const r = await api(page, method, url, withChar(base, path, ch));
          const label = `${method} ${url} ${path} U+${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
          expect([label, r.status, (r.body as { field?: string } | null)?.field]).toEqual([label, 400, path.split(".")[0]]);
        }
      }
    }
  } finally {
    expect((await api(admin, "PATCH", "/api/admin/settings", before)).status).toBe(204);
  }
  const anon = await newPage(browser);
  for (const username of ["zz_e2e_admin\u0000", "\u0000", "zz_e2e\u0001admin", "zz_e2e_admin\ud83c"]) {
    const r = await api(anon, "POST", "/api/admin/login", { username, password: PASSWORD });
    expect([400, 401], JSON.stringify(username)).toContain(r.status);
  }
});
