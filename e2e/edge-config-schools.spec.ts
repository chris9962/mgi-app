import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createSchool, createUser, expectDialogFits, LONG_WORD, open, pageScroll, PHONE } from "./edge-config-support";

const rows = (page: Page) => page.locator("tbody tr");
const cellOf = (page: Page, name: string) => page.getByRole("cell", { name, exact: true });
const searchFor = async (page: Page, q: string) => open(page, `/schools?${new URLSearchParams({ q })}`);
const noPageScroll = async (page: Page) => {
  const { scroll, client } = await pageScroll(page);
  expect(scroll, "trang cuộn ngang").toBe(client);
};

test("Trường: tên dài có dấu cách, tên liền 120 ký tự, người liên hệ dài: bảng cuộn trong khung, hộp Sửa và hộp Đóng nằm trọn ở 1366 px và 390 px", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const spaced = "ZZE2E Trường " + "Trung học phổ thông chuyên ".repeat(9).trim();
  await createSchool(page, spaced, { contactName: "Người" + "Liênhệ".repeat(20) });
  await createSchool(page, LONG_WORD);
  for (const viewport of [{ width: 1366, height: 768 }, PHONE.viewport]) {
    await page.setViewportSize(viewport);
    await searchFor(page, spaced);
    await expect(cellOf(page, spaced)).toBeVisible();
    await noPageScroll(page);
    await searchFor(page, LONG_WORD);
    await expect(cellOf(page, LONG_WORD)).toBeVisible();
    await noPageScroll(page);
    await page.getByRole("button", { name: `Sửa trường ${LONG_WORD}` }).click();
    const edit = page.getByRole("dialog", { name: "Sửa trường" });
    await expect(edit.getByLabel("Tên trường", { exact: true })).toHaveValue(LONG_WORD);
    await expectDialogFits(page, edit);
    await edit.getByRole("button", { name: "Huỷ" }).click();
    await page.getByRole("row", { name: new RegExp(LONG_WORD) }).getByRole("button", { name: "Đóng", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Đóng trường" });
    await expect(confirm).toContainText(`Đóng ${LONG_WORD}?`);
    await expectDialogFits(page, confirm);
    await expect(confirm.getByRole("button", { name: "Đóng", exact: true }).last()).toBeInViewport();
    await confirm.getByRole("button", { name: "Huỷ" }).click();
  }
});

test("Trường: ký tự đặc biệt lưu và hiện nguyên văn, khoảng trắng đầu cuối bị bỏ; tìm % và _ chỉ ra đúng chữ đó, tìm ' \\ <script> không lỗi", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const odd = `ZZE2E <script>window.__xss=1</script> 'O"Brien\\ 🎓`;
  await createSchool(page, odd);
  await createSchool(page, "ZZE2E Đặcbiệt 50% học phí");
  await createSchool(page, "ZZE2E Đặcbiệt 500 học phí");
  await createSchool(page, "ZZE2E Đặcbiệt a_b");
  await createSchool(page, "ZZE2E Đặcbiệt axb");
  await createSchool(page, "   ZZE2E Đặcbiệt khoảng trắng   ");

  await searchFor(page, "ZZE2E <script>");
  await expect(cellOf(page, odd)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await searchFor(page, "Đặcbiệt khoảng");
  await expect(cellOf(page, "ZZE2E Đặcbiệt khoảng trắng")).toBeVisible();

  await searchFor(page, "Đặcbiệt 50%");
  await expect(rows(page)).toHaveCount(1);
  await expect(cellOf(page, "ZZE2E Đặcbiệt 50% học phí")).toBeVisible();
  await searchFor(page, "Đặcbiệt a_b");
  await expect(rows(page)).toHaveCount(1);
  await expect(cellOf(page, "ZZE2E Đặcbiệt a_b")).toBeVisible();
  for (const q of ["'", "\\", "<script>", "'; drop table schools; --", "😀😀"]) {
    const res = await searchFor(page, q);
    expect([q, res?.status()]).toEqual([q, 200]);
  }
});

test("Trường: tìm không dấu, viết hoa, một phần, theo xã, nhiều khoảng trắng, chỉ khoảng trắng, từ khoá 500 ký tự; đổi từ khoá thì về trang 1", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createSchool(page, "ZZE2E Tìm Nguyễn Đình Chiểu");
  await searchFor(page, "tim nguyen dinh chieu");
  await expect(cellOf(page, "ZZE2E Tìm Nguyễn Đình Chiểu")).toBeVisible();
  await searchFor(page, "ZZE2E TÌM NGUYỄN");
  await expect(cellOf(page, "ZZE2E Tìm Nguyễn Đình Chiểu")).toBeVisible();
  await searchFor(page, "guyễn Đình Ch");
  await expect(cellOf(page, "ZZE2E Tìm Nguyễn Đình Chiểu")).toBeVisible();
  await searchFor(page, "zze2e   tìm     nguyễn");
  await expect(cellOf(page, "ZZE2E Tìm Nguyễn Đình Chiểu")).toBeVisible();
  await searchFor(page, "chau thanh");
  await expect(cellOf(page, "ZZE2E Tìm Nguyễn Đình Chiểu")).toBeVisible();

  await open(page, "/schools");
  const all = await page.getByRole("region", { name: "Trường" }).locator("header span").last().textContent();
  await searchFor(page, "     ");
  await expect(page.getByRole("region", { name: "Trường" }).locator("header span").last()).toHaveText(all!);

  await searchFor(page, "Nguyễn ".repeat(72));
  await expect(page.getByText("Không có trường khớp từ khoá.")).toBeVisible();

  for (let i = 1; i <= 16; i++) await createSchool(page, `ZZE2E Tìm trang ${String(i).padStart(2, "0")}`);
  await open(page, `/schools?${new URLSearchParams({ q: "ZZE2E Tìm trang", page: "2" })}`);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("16–16 trên 16");
  const box = page.getByLabel("Tên trường, xã…");
  await box.fill("ZZE2E Tìm");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/schools\?q=ZZE2E\+T%C3%ACm$/);
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText(/^1–15 trên/);
});

test("Trường: 16 trường khớp chia 15 và 1; page=0, -1, abc, 1.5, 999 và q lặp không lỗi; Quay lại giữ từ khoá; đóng trường thì xuống cuối danh sách", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const name = (i: number) => `ZZE2E Phân trang ${String(i).padStart(2, "0")}`;
  for (let i = 1; i <= 16; i++) await createSchool(page, name(i));
  const pager = page.getByRole("navigation", { name: "Phân trang" });
  const q = "ZZE2E Phân trang";

  await searchFor(page, q);
  await expect(rows(page)).toHaveCount(15);
  await expect(pager).toContainText("1–15 trên 16");
  await expect(pager).toContainText("1 / 2");
  await expect(page.getByRole("region", { name: "Trường" })).toContainText("16 trường");
  await pager.getByRole("link", { name: "Sau" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(pager).toContainText("16–16 trên 16");
  await expect(pager.getByRole("link", { name: "Sau" })).toHaveCount(0);
  await page.goBack();
  await expect(rows(page)).toHaveCount(15);
  await expect(page.getByLabel("Tên trường, xã…")).toHaveValue(q);

  for (const p of ["0", "-1", "abc", "1.5", "1e9", "999", ""]) {
    const res = await open(page, `/schools?${new URLSearchParams({ q, page: p })}`);
    expect([p, res?.status()]).toEqual([p, 200]);
    await expect(pager).toContainText(p === "999" || p === "1e9" ? "16–16 trên 16" : "1–15 trên 16");
  }
  const twice = await open(page, `/schools?q=${encodeURIComponent(q)}&q=khac&page=1&page=2`);
  expect(twice?.status()).toBe(200);

  await searchFor(page, q);
  await page.getByRole("row", { name: new RegExp(name(1)) }).getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("dialog", { name: "Đóng trường" }).getByRole("button", { name: "Đóng", exact: true }).last().click();
  await expect(cellOf(page, name(1))).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Trường" })).toContainText("16 trường");
  await pager.getByRole("link", { name: "Sau" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name(1)) })).toContainText("Đã đóng");
});

test("Trường: form báo lỗi đúng ô khi bỏ trống, chỉ khoảng trắng, SĐT sai dạng; xã khoá tới khi chọn tỉnh, đổi tỉnh thì bỏ xã; Huỷ rồi mở lại thì form sạch", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/schools");
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const d = page.getByRole("dialog", { name: "Thêm trường" });
  await expect(d.getByRole("combobox", { name: "Xã/phường" })).toBeDisabled();
  await d.getByRole("button", { name: "Tạo trường" }).click();
  await expect(d.locator('[id$="-error"]')).toHaveText(["Nhập tên trường", "Chọn tỉnh/thành phố", "Chọn xã/phường", "Nhập họ tên người liên hệ", "Số điện thoại gồm 10 số, bắt đầu bằng 0"]);

  await d.getByLabel("Tên trường", { exact: true }).fill("    ");
  await d.getByLabel("Họ tên người liên hệ").fill("   ");
  await d.getByRole("button", { name: "Tạo trường" }).click();
  await expect(d.getByText("Nhập tên trường", { exact: true })).toBeVisible();
  await expect(d.getByText("Nhập họ tên người liên hệ", { exact: true })).toBeVisible();
  for (const phone of ["090311122", "09031112223", "1903111222", "09031a1222", "+84903111222"]) {
    await d.getByLabel("SĐT người liên hệ").fill(phone);
    await d.getByRole("button", { name: "Tạo trường" }).click();
    await expect(d.getByText("Số điện thoại gồm 10 số, bắt đầu bằng 0", { exact: true })).toBeVisible();
  }

  await d.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
  const ward = d.getByRole("combobox", { name: "Xã/phường" });
  await ward.fill("chau thanh");
  await page.getByRole("option", { name: "Xã Châu Thành" }).click();
  await expect(ward).toHaveValue("Xã Châu Thành");
  await d.getByLabel("Tỉnh/thành phố").selectOption({ label: "Thành phố Hà Nội" });
  await expect(ward).toHaveValue("");

  await d.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Thêm trường" }).click();
  await expect(d.getByLabel("Tên trường", { exact: true })).toHaveValue("");
  await expect(d.getByLabel("Tỉnh/thành phố")).toHaveValue("");
  await expect(d.getByText("Nhập tên trường", { exact: true })).toHaveCount(0);
});

test("Trường: SĐT gõ có dấu cách hoặc dấu chấm lưu được thành 10 số liền", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/schools");
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const d = page.getByRole("dialog", { name: "Thêm trường" });
  await d.getByLabel("Tên trường", { exact: true }).fill("ZZE2E SĐT dấu cách");
  await d.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
  await d.getByRole("combobox", { name: "Xã/phường" }).fill("chau thanh");
  await page.getByRole("option", { name: "Xã Châu Thành" }).click();
  await d.getByLabel("Họ tên người liên hệ").fill("Lê Hương");
  await d.getByLabel("SĐT người liên hệ").fill("0903 111 222");
  await d.getByRole("button", { name: "Tạo trường" }).click();
  await expect(d).toBeHidden();
  await searchFor(page, "ZZE2E SĐT dấu cách");
  await expect(page.getByRole("row", { name: /ZZE2E SĐT dấu cách/ })).toContainText("0903111222");
  const r = await api(page, "POST", "/api/admin/schools", { name: "ZZE2E SĐT dấu chấm", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903.111.333" });
  expect(r.status).toBe(201);
});

test("Trường: Enter ở ô tên gửi form; bấm Tạo hai lần lúc máy chủ chậm chỉ tạo một trường; xã khác tỉnh qua API báo ở ô xã; Sửa rồi Huỷ thì mở lại thấy bản đang lưu", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  let posts = 0;
  await page.route("**/api/admin/schools", async (route) => {
    if (route.request().method() === "POST") posts++;
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await open(page, "/schools");
  for (const [name, how] of [
    ["ZZE2E Enter gửi", "enter"],
    ["ZZE2E Bấm hai lần", "dblclick"],
  ] as const) {
    await page.getByRole("button", { name: "Thêm trường" }).click();
    const d = page.getByRole("dialog", { name: "Thêm trường" });
    await d.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
    await d.getByRole("combobox", { name: "Xã/phường" }).fill("chau thanh");
    await page.getByRole("option", { name: "Xã Châu Thành" }).click();
    await d.getByLabel("Họ tên người liên hệ").fill("Lê Hương");
    await d.getByLabel("SĐT người liên hệ").fill("0903111222");
    await d.getByLabel("Tên trường", { exact: true }).fill(name);
    if (how === "enter") await d.getByLabel("Tên trường", { exact: true }).press("Enter");
    else await d.getByRole("button", { name: "Tạo trường" }).dblclick();
    await expect(d).toBeHidden();
  }
  expect(posts).toBe(2);
  await page.unroute("**/api/admin/schools");
  await searchFor(page, "ZZE2E Bấm hai lần");
  await expect(rows(page)).toHaveCount(1);

  const other = await api(page, "POST", "/api/admin/schools", { name: "ZZE2E Sai xã", provinceCode: "80", wardCode: "00004", contactName: "A", contactPhone: "0903111222" });
  expect(other).toEqual({ status: 400, body: { message: "Xã/phường không thuộc tỉnh đã chọn.", field: "wardCode" } });

  await page.getByRole("button", { name: "Sửa trường ZZE2E Bấm hai lần" }).click();
  const edit = page.getByRole("dialog", { name: "Sửa trường" });
  await expect(edit.getByRole("combobox", { name: "Xã/phường" })).toHaveValue("Xã Châu Thành");
  await edit.getByLabel("Tên trường", { exact: true }).fill("ZZE2E Đổi mà huỷ");
  await edit.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Sửa trường ZZE2E Bấm hai lần" }).click();
  await expect(edit.getByLabel("Tên trường", { exact: true })).toHaveValue("ZZE2E Bấm hai lần");
});

test("Trường: phân quyền: có quyền Trường mà không có Xuất Excel thì không thấy nút, API xuất 403; không có quyền Trường thì API 403; id sai dạng hoặc không có trả 404", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const id = await createSchool(admin, "ZZE2E Quyền trường");
  const u = await createUser(admin, { fullName: "E2E C Trường không xuất", username: "zz_e2e_c_truong_kx", permissions: ["schools"] });
  const staff = await asUser(browser, "zz_e2e_c_truong_kx", u.password);
  await open(staff, "/schools");
  await expect(staff.getByRole("button", { name: "Thêm trường" })).toBeVisible();
  await expect(staff.getByRole("button", { name: "Xuất Excel" })).toHaveCount(0);
  expect((await api(staff, "GET", "/api/admin/schools/export")).status).toBe(403);

  const none = await asUser(browser, "zz_e2e_noperm");
  const body = { name: "ZZE2E Không quyền", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" };
  expect((await api(none, "POST", "/api/admin/schools", body)).status).toBe(403);
  expect((await api(none, "PATCH", `/api/admin/schools/${id}`, body)).status).toBe(403);
  expect((await api(none, "POST", `/api/admin/schools/${id}/active`, { active: false })).status).toBe(403);
  expect((await api(none, "GET", `/api/admin/schools/${id}/qr`)).status).toBe(403);
  expect((await api(none, "GET", "/api/admin/wards?province=80")).status).toBe(403);

  const missing = "00000000-0000-4000-8000-00000000c0de";
  for (const bad of ["abc", missing, "' or 1=1"]) {
    expect([bad, (await api(admin, "PATCH", `/api/admin/schools/${encodeURIComponent(bad)}`, body)).status]).toEqual([bad, 404]);
    expect([bad, (await api(admin, "POST", `/api/admin/schools/${encodeURIComponent(bad)}/active`, { active: false })).status]).toEqual([bad, 404]);
    expect([bad, (await api(admin, "GET", `/api/admin/schools/${encodeURIComponent(bad)}/qr`)).status]).toEqual([bad, 404]);
  }
  expect(await api(admin, "GET", "/api/admin/wards?province=abc")).toEqual({ status: 200, body: [] });
});

test("Trường: tab 1 đóng trường, tab 2 còn nút Đóng cũ bấm Đóng thì không lỗi, trường vẫn đóng", async ({ browser }) => {
  const one = await asUser(browser, "zz_e2e_admin");
  await createSchool(one, "ZZE2E Hai tab");
  const two = await one.context().newPage();
  await searchFor(one, "ZZE2E Hai tab");
  await searchFor(two, "ZZE2E Hai tab");
  for (const page of [one, two]) {
    await page.getByRole("row", { name: /ZZE2E Hai tab/ }).getByRole("button", { name: "Đóng", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Đóng trường" });
    await confirm.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("row", { name: /ZZE2E Hai tab/ })).toContainText("Đã đóng");
  }
});

test("Trường: xuất Excel theo từ khoá, không khớp thì file chỉ có đầu bảng; giá trị bắt đầu bằng = + - @ là ô chữ; tên dài giữ đủ; SĐT giữ số 0", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const formulas = ["=1+1", "+84903", "-5", "@SUM(A1)"];
  for (const [i, f] of formulas.entries()) await createSchool(page, `ZZE2E Excel ${i + 1}`, { contactName: f });
  const longName = "ZZE2E Excel " + "Tên rất dài ".repeat(30).trim();
  await createSchool(page, longName);

  const read = async (q: string) => {
    await searchFor(page, q);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Xuất Excel" }).click()]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile((await download.path())!);
    const ws = wb.worksheets[0];
    return { ws, data: Array.from({ length: ws.rowCount - 3 }, (_, i) => ws.getRow(i + 4)) };
  };
  const empty = await read("zze2e-khong-co-truong-nao");
  expect(empty.data).toHaveLength(0);
  expect(empty.ws.getRow(3).getCell(2).value).toBe("TRƯỜNG");

  const { data } = await read("ZZE2E Excel");
  expect(data).toHaveLength(5);
  const contact = (name: string) => data.find((r) => r.getCell(2).value === name)!;
  for (const [i, f] of formulas.entries()) {
    const cell = contact(`ZZE2E Excel ${i + 1}`).getCell(5);
    expect([f, cell.type, cell.formula, cell.value]).toEqual([f, ExcelJS.ValueType.String, undefined, f]);
  }
  expect(contact(longName).getCell(2).value).toBe(longName);
  expect(contact("ZZE2E Excel 1").getCell(6).value).toBe("0903111222");
});

test("Trường: trình duyệt chặn clipboard thì Chép link báo không chép được; tải QR của trường tên đặc biệt ra tên file chỉ có chữ, số, gạch", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }));
  await apiLogin(page, "zz_e2e_admin");
  const id = await createSchool(page, `ZZE2E QR "Trường" <số 1> / Đặc biệt`);
  await searchFor(page, "ZZE2E QR");
  await page.getByRole("button", { name: `Chép link của ZZE2E QR "Trường" <số 1> / Đặc biệt` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Không chép được" })).toHaveCount(1);
  const res = await page.request.get(`/api/admin/schools/${id}/qr`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="qr-[A-Za-z0-9-]+\.png"$/);
});
