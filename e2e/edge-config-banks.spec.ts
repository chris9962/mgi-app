import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createBank, createUser, expectDialogFits, LONG_WORD, open, pageScroll, PHONE } from "./edge-config-support";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rowOf = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(escape(name)) });
const guideBody = (steps: string[], slots: { id?: string; name: string }[], seenSlotIds: string[] = []) => ({ steps, slots: slots.map((s) => ({ ...s, sampleKey: null, checkName: false, checkCode: false })), seenSlotIds });
const guideDialog = (page: Page) => page.getByRole("dialog", { name: /Hướng dẫn mở tài khoản/ });
const MISSING = "00000000-0000-4000-8000-00000000c0de";
const TOO_LARGE = "Ảnh lớn hơn 20 MB.";
const HTML_413 = "<html><head><title>413 Request Entity Too Large</title></head><body><center><h1>413 Request Entity Too Large</h1></center></body></html>";

const uploadsOf = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/admin/uploads") seen.push(r.url());
  });
  return seen;
};

async function pickFile(page: Page, trigger: Locator, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await trigger.click();
  await (await chooser).setFiles(file);
}

test("Ngân hàng: tên liền 120 ký tự và tên có thẻ HTML: trang không cuộn ngang, hộp Hướng dẫn và hộp Tắt nằm trọn ở 1366 px và 390 px", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCLONG", LONG_WORD);
  const html = `ZZE2E <b>đậm</b> & "nháy"`;
  await createBank(page, "ZZCHTML", html);
  for (const viewport of [{ width: 1366, height: 768 }, PHONE.viewport]) {
    await page.setViewportSize(viewport);
    await open(page, "/banks");
    await expect(page.getByRole("cell", { name: html, exact: true })).toBeVisible();
    const { scroll, client } = await pageScroll(page);
    expect(scroll).toBe(client);
    await page.getByRole("button", { name: `Hướng dẫn mở tài khoản ${LONG_WORD}` }).click();
    const guide = guideDialog(page);
    await expect(guide.getByLabel("Các bước")).toBeVisible();
    await expectDialogFits(page, guide);
    await guide.getByRole("button", { name: "Huỷ" }).click();
    await rowOf(page, LONG_WORD).getByRole("button", { name: "Tắt" }).click();
    const confirm = page.getByRole("dialog", { name: "Tắt ngân hàng" });
    await expectDialogFits(page, confirm);
    await confirm.getByRole("button", { name: "Huỷ" }).click();
  }
});

test("Ngân hàng: mã viết thường lưu in hoa; mã sai dạng, mã trùng khác hoa thường, độ ưu tiên sai hoặc bỏ trống, tên chỉ khoảng trắng đều báo đúng ô", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/banks");
  const openForm = async () => {
    await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
    return page.getByRole("dialog", { name: "Thêm ngân hàng" });
  };
  let d = await openForm();
  await d.getByLabel("Mã ngân hàng").fill("zzcthuong");
  await d.getByLabel("Tên ngân hàng").fill("ZZE2E Mã thường");
  await d.getByRole("button", { name: "Tạo ngân hàng" }).click();
  await expect(d).toBeHidden();
  await expect(rowOf(page, "ZZE2E Mã thường").getByRole("cell").first()).toHaveText("ZZCTHUONG");

  d = await openForm();
  const code = d.getByLabel("Mã ngân hàng");
  const submit = () => d.getByRole("button", { name: "Tạo ngân hàng" }).click();
  await d.getByLabel("Tên ngân hàng").fill("ZZE2E Mã sai");
  for (const bad of ["Z", "ZZCABCDEFGH", "ZZĐ", "ZZ-C", "ZZ C", "   "]) {
    await code.fill(bad);
    await submit();
    await expect(code, bad).toHaveAccessibleDescription("Mã ngân hàng 2 tới 10 ký tự, chữ in hoa không dấu hoặc số");
  }
  await code.fill("ZzCtHuOnG");
  await submit();
  await expect(code).toHaveAccessibleDescription("Mã ngân hàng đã có.");

  await code.fill("ZZCUUTIEN");
  const order = d.getByLabel("Độ ưu tiên");
  for (const [bad, msg] of [
    ["-1", "Độ ưu tiên từ 0 tới 999"],
    ["1000", "Độ ưu tiên từ 0 tới 999"],
    ["1.5", "Độ ưu tiên là số nguyên"],
    ["abc", "Độ ưu tiên là số"],
    ["   ", "Độ ưu tiên là số"],
    ["", "Độ ưu tiên là số"],
  ]) {
    await order.fill(bad);
    await submit();
    await expect(order, JSON.stringify(bad)).toHaveAccessibleDescription(msg);
  }
  await order.fill("5");
  await d.getByLabel("Tên ngân hàng").fill("    ");
  await submit();
  await expect(d.getByLabel("Tên ngân hàng")).toHaveAccessibleDescription("Nhập tên ngân hàng");
  expect((await api(page, "POST", "/api/admin/banks", { code: "ZZCRONG", name: "ZZE2E Rỗng", sortOrder: "", managerIds: [] })).body).toEqual({ message: "Độ ưu tiên là số", field: "sortOrder" });
});

test("Ngân hàng: ô chọn người quản tìm nhiều từ không theo thứ tự, từ ở họ tên và từ ở tên đăng nhập; ô nhận tối đa 100 ký tự", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createUser(page, { fullName: "E2E C Nguyễn Thị Anh Táchnq", username: "zz_e2e_c_tachnq" });
  await open(page, "/banks");
  await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
  const d = page.getByRole("dialog", { name: "Thêm ngân hàng" });
  const picker = d.getByRole("combobox", { name: "Người quản ngân hàng này" });
  await expect(picker).toHaveAttribute("maxlength", "100");
  for (const q of ["anh nguyen tachnq", "zz_e2e_c_tachnq anh"]) {
    await picker.fill(q);
    await expect(d.getByRole("listbox").getByRole("option"), q).toHaveText(["E2E C Nguyễn Thị Anh Táchnq"]);
  }
  await d.getByRole("button", { name: "Huỷ" }).click();
});

test("Ngân hàng: ba request tạo cùng mã cùng lúc thì một 201, hai 409 báo ở ô mã, không lỗi 500", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const body = { code: "ZZCDONG", name: "ZZE2E Đồng thời", sortOrder: "1", managerIds: [] };
  const results = await Promise.all([1, 2, 3].map(() => api(page, "POST", "/api/admin/banks", body)));
  expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  for (const r of results.filter((x) => x.status !== 201)) expect(r.body).toEqual({ message: "Mã ngân hàng đã có.", field: "code" });
});

test("Ngân hàng: người quản đã bị khoá thì sửa tên ngân hàng vẫn lưu được, người quản giữ nguyên", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const staff = await createUser(page, { fullName: "E2E C Người quản nghỉ", username: "zz_e2e_c_nqnghi" });
  await createBank(page, "ZZCNGHI", "ZZE2E Người quản nghỉ", [staff.id]);
  expect((await api(page, "POST", `/api/admin/users/${staff.id}/lock`, { active: false })).status).toBe(204);
  await open(page, "/banks");
  await page.getByRole("button", { name: "Sửa ngân hàng ZZE2E Người quản nghỉ" }).click();
  const d = page.getByRole("dialog", { name: "Sửa ngân hàng" });
  await d.getByLabel("Tên ngân hàng").fill("ZZE2E Người quản nghỉ đã đổi");
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d).toBeHidden();
  await expect(rowOf(page, "ZZE2E Người quản nghỉ đã đổi")).toContainText("E2E C Người quản nghỉ");

  const fresh = await createUser(page, { fullName: "E2E C Người quản mới khoá", username: "zz_e2e_c_nqmoi" });
  expect((await api(page, "POST", `/api/admin/users/${fresh.id}/lock`, { active: false })).status).toBe(204);
  const r = await api(page, "POST", "/api/admin/banks", { code: "ZZCNGHI2", name: "ZZE2E Giao người khoá", sortOrder: "1", managerIds: [fresh.id] });
  expect(r).toEqual({ status: 400, body: { message: "Người quản phải là Nhân viên đang hoạt động.", field: "managerIds" } });
});

test("Ngân hàng: máy chủ báo lỗi ở ô Người quản thì lỗi gắn vào ô chọn người quản", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/banks");
  await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
  const d = page.getByRole("dialog", { name: "Thêm ngân hàng" });
  await d.getByLabel("Mã ngân hàng").fill("ZZCPICK");
  await d.getByLabel("Tên ngân hàng").fill("ZZE2E Lỗi ô người quản");
  await page.route(
    (url) => url.pathname === "/api/admin/banks",
    (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Người quản phải là Nhân viên đang hoạt động.", field: "managerIds" }) }),
  );
  await d.getByRole("button", { name: "Tạo ngân hàng" }).click();
  await expect(d.getByRole("combobox", { name: "Người quản ngân hàng này" })).toHaveAccessibleDescription("Người quản phải là Nhân viên đang hoạt động.");
});

test("Ngân hàng: Nhân viên được giao chỉ sửa ngân hàng mình, không đổi được người quản; ngân hàng khác và id không có trả 404", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Nhân viên ngân hàng", username: "zz_e2e_c_nhnv" });
  const mine = await createBank(admin, "ZZCMINE", "ZZE2E Của mình", [u.id]);
  const other = await createBank(admin, "ZZCOTHER", "ZZE2E Của người khác");
  const staff = await asUser(browser, "zz_e2e_c_nhnv", u.password);
  await open(staff, "/banks");
  await expect(staff.getByRole("cell", { name: "ZZE2E Của mình", exact: true })).toBeVisible();
  await expect(staff.getByRole("cell", { name: "ZZE2E Của người khác", exact: true })).toHaveCount(0);
  await expect(staff.getByRole("button", { name: "Thêm ngân hàng" })).toHaveCount(0);
  await staff.getByRole("button", { name: "Sửa ngân hàng ZZE2E Của mình" }).click();
  await expect(staff.getByRole("dialog", { name: "Sửa ngân hàng" }).getByText("Người quản ngân hàng này")).toHaveCount(0);

  const edit = { code: "ZZCMINE", name: "ZZE2E Của mình sửa", sortOrder: "3", managerIds: [] };
  expect((await api(staff, "PATCH", `/api/admin/banks/${mine}`, edit)).status).toBe(204);
  await open(admin, "/banks");
  await expect(rowOf(admin, "ZZE2E Của mình sửa")).toContainText("E2E C Nhân viên ngân hàng");

  const guide = guideBody(["Bước"], [{ name: "Ảnh" }]);
  for (const id of [other, MISSING]) {
    expect((await api(staff, "PATCH", `/api/admin/banks/${id}`, { ...edit, code: "ZZCOTHER" })).status).toBe(404);
    expect((await api(staff, "POST", `/api/admin/banks/${id}/active`, { active: false })).status).toBe(404);
    expect((await api(staff, "GET", `/api/admin/banks/${id}/guide`)).status).toBe(404);
    expect((await api(staff, "PUT", `/api/admin/banks/${id}/guide`, guide)).status).toBe(404);
  }
  expect((await api(staff, "POST", "/api/admin/banks", { ...edit, code: "ZZCSTAFF" })).status).toBe(403);
  expect((await api(admin, "GET", `/api/admin/banks/${MISSING}/guide`)).status).toBe(404);
  expect((await api(admin, "PUT", `/api/admin/banks/${MISSING}/guide`, guide)).status).toBe(404);
  expect((await api(admin, "PATCH", `/api/admin/banks/${MISSING}`, { ...edit, code: "ZZCMISS" })).status).toBe(404);
  expect((await api(admin, "POST", `/api/admin/banks/${MISSING}/active`, { active: true })).status).toBe(404);
  for (const id of ["abc", "' or 1=1"]) expect((await api(admin, "PATCH", `/api/admin/banks/${encodeURIComponent(id)}`, edit)).status).toBe(404);
});

test("Hướng dẫn: hai tab cùng mở, tab 1 bỏ một khung rồi lưu, tab 2 lưu bản cũ thì báo hướng dẫn đã đổi, không tạo lại khung đã bỏ", async ({ browser }) => {
  const one = await asUser(browser, "zz_e2e_admin");
  const id = await createBank(one, "ZZCHAITAB", "ZZE2E Hướng dẫn hai tab");
  expect((await api(one, "PUT", `/api/admin/banks/${id}/guide`, guideBody(["Tải app"], [{ name: "Ảnh một" }, { name: "Ảnh hai" }]))).status).toBe(204);
  const two = await one.context().newPage();
  for (const page of [one, two]) {
    await open(page, "/banks");
    await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Hướng dẫn hai tab" }).click();
    await expect(guideDialog(page).getByLabel("Tên ảnh 2")).toHaveValue("Ảnh hai");
  }
  const g1 = guideDialog(one);
  await g1.getByRole("button", { name: "Bỏ Ảnh hai", exact: true }).click();
  await g1.getByRole("button", { name: "Lưu" }).click();
  await expect(g1).toBeHidden();
  const g2 = guideDialog(two);
  await g2.getByLabel("Tên ảnh 1").fill("Ảnh một sửa");
  await g2.getByRole("button", { name: "Lưu" }).click();
  await expect(g2.getByRole("alert")).toHaveText("Hướng dẫn đã có người sửa. Mở lại để xem bản mới.");
  await open(one, "/banks");
  await expect(rowOf(one, "ZZE2E Hướng dẫn hai tab")).toContainText("1 ảnh");
});

test("Hướng dẫn: hai tab cùng mở, tab 1 thêm khung rồi lưu, tab 2 lưu bản cũ thì báo hướng dẫn đã đổi, khung tab 1 vừa thêm vẫn còn", async ({ browser }) => {
  const one = await asUser(browser, "zz_e2e_admin");
  const id = await createBank(one, "ZZCTHEMTAB", "ZZE2E Hướng dẫn thêm khung");
  expect((await api(one, "PUT", `/api/admin/banks/${id}/guide`, guideBody(["Tải app"], [{ name: "Ảnh một" }, { name: "Ảnh hai" }]))).status).toBe(204);
  const two = await one.context().newPage();
  for (const page of [one, two]) {
    await open(page, "/banks");
    await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Hướng dẫn thêm khung" }).click();
    await expect(guideDialog(page).getByLabel("Tên ảnh 2")).toHaveValue("Ảnh hai");
  }
  const g1 = guideDialog(one);
  await g1.getByRole("button", { name: "Thêm ảnh" }).click();
  await g1.getByLabel("Tên ảnh 3").fill("Ảnh ba");
  await g1.getByRole("button", { name: "Lưu" }).click();
  await expect(g1).toBeHidden();
  const g2 = guideDialog(two);
  await g2.getByLabel("Tên ảnh 1").fill("Ảnh một sửa");
  await g2.getByRole("button", { name: "Lưu" }).click();
  await expect(g2.getByRole("alert")).toHaveText("Hướng dẫn đã có người sửa. Mở lại để xem bản mới.");
  await open(one, "/banks");
  await expect(rowOf(one, "ZZE2E Hướng dẫn thêm khung")).toContainText("3 ảnh");
  await one.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Hướng dẫn thêm khung" }).click();
  await expect(guideDialog(one).getByLabel("Tên ảnh 1")).toHaveValue("Ảnh một");
  await expect(guideDialog(one).getByLabel("Tên ảnh 3")).toHaveValue("Ảnh ba");
});

test("Hướng dẫn: ngân hàng mới ghi Chưa cài, Chưa giao; tên ảnh trống, 21 bước, bỏ hết khung, 11 khung đều báo lỗi; dòng trống và số thứ tự bị bỏ; tab dán từ Word thành dấu cách; file không phải ảnh bị từ chối", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCMOI", "ZZE2E Hướng dẫn mới");
  await open(page, "/banks");
  const row = rowOf(page, "ZZE2E Hướng dẫn mới");
  await expect(row).toContainText("Chưa cài");
  await expect(row).toContainText("Chưa giao");
  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Hướng dẫn mới" }).click();
  const g = guideDialog(page);
  await expect(g.getByLabel("Tên ảnh 1")).toHaveValue("");
  await expect(g.getByLabel("Tên ảnh 2")).toHaveCount(0);

  await g.getByRole("button", { name: "Lưu" }).click();
  await expect(g.getByRole("alert")).toHaveText("Nhập tên ảnh");
  await g.getByLabel("Tên ảnh 1").fill("Ảnh màn hình chính");
  await g.getByLabel("Các bước").fill(Array.from({ length: 21 }, (_, i) => `Bước ${i + 1}`).join("\n"));
  await g.getByRole("button", { name: "Lưu" }).click();
  await expect(g.getByRole("alert")).toHaveText("Tối đa 20 bước");

  await g.getByLabel("Các bước").fill("1. Tải app\n\n   \n2) Mở tài khoản\n  3.Nhập mã  \n•\tChụp\tảnh\n\t");
  await g.getByRole("button", { name: "Bỏ Ảnh màn hình chính", exact: true }).click();
  await g.getByRole("button", { name: "Lưu" }).click();
  await expect(g.getByRole("alert")).toHaveText("Cần ít nhất 1 ảnh cần nộp");
  for (let i = 1; i <= 11; i++) {
    await g.getByRole("button", { name: "Thêm ảnh" }).click();
    await g.getByLabel(`Tên ảnh ${i}`, { exact: true }).fill(`Ảnh ${i}`);
  }
  await g.getByRole("button", { name: "Lưu" }).click();
  await expect(g.getByRole("alert")).toHaveText("Tối đa 10 ảnh");
  await g.getByRole("button", { name: "Bỏ Ảnh 11", exact: true }).click();

  const sample = g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh 1", exact: true });
  for (const [name, buffer] of [
    ["gia.jpg", Buffer.from("đây không phải ảnh")],
    ["rong.jpg", Buffer.alloc(0)],
  ] as const) {
    await pickFile(page, sample, { name, mimeType: "image/jpeg", buffer });
    await expect(g.getByRole("alert"), name).toHaveText("Chỉ nhận ảnh jpg, png, webp hoặc heic.");
    await expect(sample.locator("img")).toHaveCount(0);
  }
  await g.getByRole("button", { name: "Lưu" }).click();
  await expect(g).toBeHidden();
  await expect(row).toContainText("10 ảnh");
  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Hướng dẫn mới" }).click();
  await expect(g.getByLabel("Các bước")).toHaveValue("Tải app\nMở tài khoản\nNhập mã\n• Chụp ảnh");
  await expect(g.getByLabel("Tên ảnh 10", { exact: true })).toHaveValue("Ảnh 10");
});

test("Hướng dẫn: ảnh mẫu 23 MB báo Ảnh lớn hơn 20 MB. ở ô ảnh đó, không gửi lên máy chủ; máy chủ trả 413 dạng HTML cũng báo ở ô ảnh", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCANHTO", "ZZE2E Ảnh mẫu to");
  await open(page, "/banks");
  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Ảnh mẫu to" }).click();
  const g = guideDialog(page);
  await g.getByLabel("Tên ảnh 1").fill("Ảnh một");
  await g.getByRole("button", { name: "Thêm ảnh" }).click();
  await g.getByLabel("Tên ảnh 2").fill("Ảnh hai");
  const uploads = uploadsOf(page);
  const one = g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh một", exact: true });
  await pickFile(page, one, { name: "to.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(23 * 1024 * 1024) });
  await expect(one).toHaveAccessibleDescription(TOO_LARGE);
  expect(uploads).toEqual([]);

  await page.route((url) => url.pathname === "/api/admin/uploads", (route) => route.fulfill({ status: 413, contentType: "text/html", body: HTML_413 }));
  const two = g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh hai", exact: true });
  await pickFile(page, two, { name: "nho.jpg", mimeType: "image/jpeg", buffer: Buffer.from("ảnh nhỏ") });
  await expect.poll(() => uploads.length).toBe(1);
  await expect(two).toHaveAccessibleDescription(TOO_LARGE);
});

test("Hướng dẫn: đang tải ảnh mẫu của một khung thì nút đổi ảnh của mọi khung bị khoá, Lưu chờ tải xong, khung giữ đúng ảnh vừa tải", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCHAILAN", "ZZE2E Ảnh hai lần");
  await open(page, "/banks");
  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Ảnh hai lần" }).click();
  const g = guideDialog(page);
  await g.getByLabel("Tên ảnh 1").fill("Ảnh một");
  await g.getByRole("button", { name: "Thêm ảnh" }).click();
  await g.getByLabel("Tên ảnh 2").fill("Ảnh hai");
  // Máy chủ trả chậm theo từng lượt: ảnh chọn trước tải xong sau thì khung khác mất ảnh hoặc Lưu mở lại khi còn ảnh đang tải.
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const key = "samples/2026-11-07/0b7c2f4e-6a1d-4c3b-9e8f-1a2b3c4d5e6f.webp";
  await page.route((url) => url.pathname === "/api/admin/uploads", async (route) => {
    await gate;
    await route.fulfill({ json: { key } });
  });
  const one = g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh một", exact: true });
  const two = g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh hai", exact: true });
  await pickFile(page, one, { name: "mot.jpg", mimeType: "image/jpeg", buffer: Buffer.from("ảnh một") });
  await expect(one).toHaveText("…");
  await expect(two).toBeDisabled();
  await expect(one).toBeDisabled();
  await expect(g.getByRole("button", { name: "Lưu" })).toBeDisabled();
  release();
  await expect(one.locator("img")).toHaveAttribute("src", `/api/admin/images?key=${encodeURIComponent(key)}`);
  await expect(two).toBeEnabled();
  await expect(two.locator("img")).toHaveCount(0);
  await expect(g.getByRole("button", { name: "Lưu" })).toBeEnabled();
  await g.getByRole("button", { name: "Huỷ" }).click();
});

test("Hướng dẫn: huỷ hộp chọn ảnh mẫu thì hộp Hướng dẫn vẫn mở, chữ đang gõ còn; Esc vẫn đóng hộp", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCHUYFILE", "ZZE2E Huỷ chọn ảnh");
  await open(page, "/banks");
  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E Huỷ chọn ảnh" }).click();
  const g = guideDialog(page);
  await g.getByLabel("Các bước").fill("Bước đang gõ");
  await g.getByLabel("Tên ảnh 1").fill("Ảnh đang gõ");
  const chooser = page.waitForEvent("filechooser");
  await g.getByRole("button", { name: "Đổi ảnh mẫu của Ảnh đang gõ", exact: true }).click();
  await chooser;
  // Huỷ hộp chọn file hay chọn lại đúng ảnh cũ thì Chrome phát `cancel` từ ô file; phát thẳng sự kiện đó, không chờ Chrome tự phát.
  await g.locator('input[type="file"]').evaluate(async (el) => {
    el.dispatchEvent(new Event("cancel", { bubbles: true }));
    await new Promise(requestAnimationFrame);
  });
  await expect(g).toBeVisible();
  await expect(g.getByLabel("Các bước")).toHaveValue("Bước đang gõ");
  await expect(g.getByLabel("Tên ảnh 1")).toHaveValue("Ảnh đang gõ");
  await page.keyboard.press("Escape");
  await expect(g).toBeHidden();
});

test("Thêm ngân hàng, Hướng dẫn: đang lưu thì Huỷ bị khoá, không có nút Đóng, nhấn Esc 4 lần không đóng hộp; máy chủ báo lỗi thì câu báo hiện trong hộp, Huỷ đóng được", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCGIUHOP", "ZZE2E Giữ hộp");
  const cases: { button: string; title: string | RegExp; url: string; submit: string; fill: (d: Locator) => Promise<void> }[] = [
    {
      button: "Thêm ngân hàng",
      title: "Thêm ngân hàng",
      url: "**/api/admin/banks",
      submit: "Tạo ngân hàng",
      fill: async (d) => {
        await d.getByLabel("Mã ngân hàng").fill("ZZCGIUMOI");
        await d.getByLabel("Tên ngân hàng").fill("ZZE2E Giữ hộp mới");
      },
    },
    { button: "Hướng dẫn mở tài khoản ZZE2E Giữ hộp", title: /Hướng dẫn mở tài khoản/, url: "**/api/admin/banks/*/guide", submit: "Lưu", fill: (d) => d.getByLabel("Tên ảnh 1").fill("Ảnh một") },
  ];
  for (const c of cases) {
    await open(page, "/banks");
    // Giữ request ghi tới khi test cho đi; máy chủ giả trả 500 nên dữ liệu không đổi.
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(c.url, async (route) => {
      if (route.request().method() === "GET") return route.continue();
      await gate;
      await route.fulfill({ status: 500 });
    });
    await page.getByRole("button", { name: c.button, exact: true }).click();
    const d = page.getByRole("dialog", { name: c.title });
    await c.fill(d);
    await d.getByRole("button", { name: c.submit, exact: true }).click();
    await expect(d.getByRole("button", { name: c.submit, exact: true }), c.button).toBeDisabled();
    await expect(d.getByRole("button", { name: "Huỷ" }), c.button).toBeDisabled();
    await expect(d.getByRole("button", { name: "Đóng" }), c.button).toHaveCount(0);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");
    await expect(d, c.button).toBeVisible();
    release();
    await expect(d.getByRole("alert"), c.button).toHaveText("Không lưu được. Thử lại sau ít phút.");
    await expect(d.getByRole("button", { name: "Đóng" }), c.button).toBeVisible();
    await d.getByRole("button", { name: "Huỷ" }).click();
    await expect(page.getByRole("dialog"), c.button).toHaveCount(0);
    await page.unroute(c.url);
  }
});

test("Logo ngân hàng: file 23 MB báo lỗi ở ô logo, không gửi lên máy chủ; chọn logo rồi tạo thì bảng hiện logo; mở Sửa thấy logo đang dùng", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/banks");
  await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
  const d = page.getByRole("dialog", { name: "Thêm ngân hàng" });
  await d.getByLabel("Mã ngân hàng").fill("ZZLOGO");
  await d.getByLabel("Tên ngân hàng").fill("ZZE2E Logo");
  const uploads = uploadsOf(page);
  const pick = d.getByRole("button", { name: "Chọn logo" });
  await pickFile(page, pick, { name: "to.png", mimeType: "image/png", buffer: Buffer.alloc(23 * 1024 * 1024) });
  await expect(pick).toHaveAccessibleDescription(TOO_LARGE);
  expect(uploads).toEqual([]);

  await pickFile(page, pick, { name: "mb.webp", mimeType: "image/webp", buffer: readFileSync("scripts/data/bank-logos/mb.webp") });
  const change = d.getByRole("button", { name: "Đổi logo" });
  await expect(change.locator("img")).toHaveAttribute("src", /^\/api\/admin\/images\?key=logos%2F/);
  await expect(change).not.toHaveAccessibleDescription(TOO_LARGE);
  await d.getByRole("button", { name: "Tạo ngân hàng" }).click();
  await expect(d).toHaveCount(0);

  const logo = rowOf(page, "ZZE2E Logo").locator("img");
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const src = await logo.getAttribute("src");
  await page.getByRole("button", { name: "Sửa ngân hàng ZZE2E Logo" }).click();
  const edit = page.getByRole("dialog", { name: "Sửa ngân hàng" });
  await expect(edit.getByRole("button", { name: "Đổi logo" }).locator("img")).toHaveAttribute("src", src!);
  await edit.getByRole("button", { name: "Huỷ" }).click();
});
