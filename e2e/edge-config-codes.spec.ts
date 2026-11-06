import { expect, test, type Locator, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createBank, createCode, createSchool, createUser, expectDialogFits, LONG_WORD, open, pageScroll, PHONE } from "./edge-config-support";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rows = (page: Page) => page.locator("tbody tr");
const rowOf = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(escape(name)) });
const searchBox = (page: Page) => page.getByRole("search").getByLabel("Tìm mã");
const bankFilter = (page: Page) => page.getByRole("search").getByLabel("Ngân hàng");
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

async function openAdd(page: Page) {
  await page.getByRole("button", { name: "Thêm mã" }).click();
  return page.getByRole("dialog", { name: "Thêm mã giới thiệu" });
}

test("Mã: tên hiển thị và mã text dài liền không làm trang cuộn ngang ở 1366 px và 390 px; thẻ trường tên dài không tràn hộp Thêm mã", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMADAI", "ZZE2E Mã dài", [], "0");
  await createCode(page, bank, LONG_WORD, { code: "X".repeat(80) });
  const school = LONG_WORD + "Mã";
  await createSchool(page, school);
  for (const viewport of [{ width: 1366, height: 768 }, PHONE.viewport]) {
    await page.setViewportSize(viewport);
    await open(page, `/banks/codes?q=${encodeURIComponent("ZZE2E Dài")}`);
    await expect(rows(page)).toHaveCount(1);
    const { scroll, client } = await pageScroll(page);
    expect(scroll).toBe(client);
    const d = await openAdd(page);
    await d.getByRole("combobox", { name: "Trường dùng mã này" }).fill("DàiDàiDài");
    await d.getByRole("listbox").getByRole("option", { name: new RegExp(escape(school)) }).first().click();
    await expect(d.getByRole("list", { name: "Trường dùng mã này đã chọn" }).getByRole("listitem")).toHaveCount(1);
    await d.getByRole("combobox", { name: "Trường dùng mã này" }).press("Escape");
    await expect(d.getByRole("listbox")).toBeHidden();
    await expectDialogFits(page, d);
    await d.getByRole("button", { name: "Huỷ" }).click();
  }
});

test("Mã: tìm % và _ chỉ ra mã có đúng ký tự đó; tìm không dấu theo tên, theo mã text; ô chỉ khoảng trắng không đưa q lên URL", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMATIM", "ZZE2E Mã tìm");
  await createCode(page, bank, "ZZE2E Tìm 50%");
  await createCode(page, bank, "ZZE2E Tìm 500");
  await createCode(page, bank, "ZZE2E Tìm a_b");
  await createCode(page, bank, "ZZE2E Tìm axb", { code: "ZZC-MATEXT-77" });
  const names = async () => (await page.locator("tbody tr td:nth-child(2) span.font-semibold").allTextContents()).sort();
  await open(page, `/banks/codes?bank=${bank}`);
  for (const [q, expected] of [
    ["50%", ["ZZE2E Tìm 50%"]],
    ["a_b", ["ZZE2E Tìm a_b"]],
    ["TIM A_B", ["ZZE2E Tìm a_b"]],
    ["matext-77", ["ZZE2E Tìm axb"]],
  ] as const) {
    await searchBox(page).fill(q);
    await expect(page).toHaveURL(new RegExp(`q=${escape(encodeURIComponent(q).replace(/%20/g, "+"))}`, "i"));
    await expect.poll(names, { message: q }).toEqual([...expected]);
  }
  await searchBox(page).fill("    ");
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(rows(page)).toHaveCount(4);
});

test("Mã: tìm nhiều từ không theo thứ tự, từ ở tên hiển thị và từ ở mã text; ô tìm và ô chọn trường nhận tối đa 100 ký tự, ô chọn trường tìm nhiều từ", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMATACH", "ZZE2E Mã tách từ");
  await createCode(page, bank, "ZZE2E Nguyễn Thị Anh Táchma", { code: "ZZC-TACHMA" });
  await createSchool(page, "ZZE2E THPT Nguyễn Thị Anh Táchma");
  await open(page, "/banks/codes");
  await expect(searchBox(page)).toHaveAttribute("maxlength", "100");
  for (const q of ["anh nguyen tachma", "zzc-tachma anh", "THỊ  táchma"]) {
    await open(page, `/banks/codes?q=${encodeURIComponent(q)}`);
    await expect(rows(page), q).toHaveCount(1);
    await expect(rowOf(page, "ZZE2E Nguyễn Thị Anh Táchma"), q).toBeVisible();
  }
  await open(page, `/banks/codes?q=${encodeURIComponent("tachma khongco")}`);
  await expect(rows(page)).toHaveText(["Không có mã khớp bộ lọc."]);

  const d = await openAdd(page);
  const picker = d.getByRole("combobox", { name: "Trường dùng mã này" });
  await expect(picker).toHaveAttribute("maxlength", "100");
  await picker.fill("anh nguyen tachma");
  await expect(d.getByRole("listbox").getByRole("option")).toHaveText([/^ZZE2E THPT Nguyễn Thị Anh Táchma - /]);
  await d.getByRole("button", { name: "Huỷ" }).click();
});

test("Mã: gõ liền sáu ký tự thì URL chỉ đổi một lần; gõ rồi bấm sang Danh sách ngân hàng trước 300 ms thì không bị kéo về Kho mã", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMAGO", "ZZE2E Mã gõ");
  await createCode(page, bank, "ZZE2E Gõnhanh");
  await page.clock.install();
  await open(page, "/banks/codes");
  const seen: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) seen.push(new URL(f.url()).searchParams.get("q") ?? "");
  });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await searchBox(page).pressSequentially("gõnhan", { delay: 40 });
  await page.clock.runFor(299);
  expect(seen.filter(Boolean)).toEqual([]);
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/q=g%C3%B5nhan/);
  await expect(rows(page)).toHaveCount(1);
  await page.clock.runFor(600);
  expect([...new Set(seen.filter(Boolean))]).toEqual(["gõnhan"]);

  await searchBox(page).fill("ZZE2E");
  await page.getByRole("link", { name: "Danh sách ngân hàng" }).click();
  await expect(page).toHaveURL(/\/banks$/);
  await page.clock.runFor(1000);
  await expect(page).toHaveURL(/\/banks$/);
});

test("Mã: gõ ô tìm rồi bấm sang Danh sách ngân hàng lúc mạng chậm thì ở lại trang ngân hàng, không bị kéo về Kho mã", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await page.clock.install();
  await open(page, "/banks/codes");
  await page.route(
    (url) => url.pathname === "/banks",
    async (route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    },
  );
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await searchBox(page).fill("ZZE2E");
  await page.getByRole("link", { name: "Danh sách ngân hàng" }).click();
  await page.clock.runFor(400);
  await expect(page).toHaveURL(/\/banks$/);
  await expect(page.getByRole("button", { name: "Thêm ngân hàng" })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page).toHaveURL(/\/banks$/);
});

test("Mã: gõ ô tìm rồi bấm Tháng sau hay Sau trước 300 ms thì ô tìm khớp từ khoá trên URL, bảng lọc đúng như ô tìm", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMALECH", "ZZE2E Mã lệch");
  for (let i = 1; i <= 16; i++) await createCode(page, bank, `ZZE2E Lệchô ${String(i).padStart(2, "0")}`);
  await page.clock.install();
  for (const link of [page.getByRole("link", { name: "Tháng sau" }), page.getByRole("navigation", { name: "Phân trang" }).getByRole("link", { name: "Sau" })]) {
    await open(page, `/banks/codes?bank=${bank}`);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    const href = (await link.getAttribute("href"))!;
    await searchBox(page).fill("lệchô 05");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${escape(href)}$`));
    await page.waitForLoadState("networkidle");
    await page.clock.runFor(1000);
    await page.waitForLoadState("networkidle");
    // Ô tìm và bảng phải cùng theo một từ khoá: từ khoá trên URL là từ khoá bảng đang lọc.
    const q = new URL(page.url()).searchParams.get("q") ?? "";
    await expect(searchBox(page), href).toHaveValue(q);
    await expect(page.getByText(q ? "1 mã" : "16 mã", { exact: true }), href).toBeVisible();
    await page.clock.resume();
  }
});

test("Mã: lọc ngân hàng, từ khoá, Ẩn mã đã ngừng kết hợp; đổi một lọc về trang 1 và giữ lọc khác; đổi tháng giữ lọc; 16 mã thì trang 1 có 15, trang 2 có 1", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMALOC", "ZZE2E Mã lọc");
  const other = await createBank(page, "ZZCMALOC2", "ZZE2E Mã lọc khác");
  const ids: string[] = [];
  for (let i = 1; i <= 16; i++) ids.push(await createCode(page, bank, `ZZE2E Lọcx ${String(i).padStart(2, "0")}`));
  await createCode(page, other, "ZZE2E Lọcx ngân hàng khác");
  expect((await api(page, "POST", `/api/admin/referral-codes/${ids[0]}/active`, { active: false })).status).toBe(204);

  await open(page, "/banks/codes");
  await bankFilter(page).selectOption(bank);
  await expect(page).toHaveURL(new RegExp(`bank=${bank}`));
  await searchBox(page).fill("lọcx");
  await expect(page).toHaveURL(/q=l%E1%BB%8Dcx/);
  await expect(page.getByText("16 mã", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(15);
  await page.getByRole("navigation", { name: "Phân trang" }).getByRole("link", { name: "Sau" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("ZZE2E Lọcx 01");

  await page.getByLabel("Ẩn mã đã ngừng").check();
  await expect(page).toHaveURL(/hide=1/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(page).toHaveURL(new RegExp(`bank=${bank}`));
  await expect(page.getByText("15 mã", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(15);

  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page).toHaveURL(/hide=1/);
  await expect(page).toHaveURL(/q=l%E1%BB%8Dcx/);
  await expect(bankFilter(page)).toHaveValue(bank);
  await expect(searchBox(page)).toHaveValue("lọcx");

  await bankFilter(page).selectOption("");
  await expect(page).not.toHaveURL(/bank=/);
  await expect(page.getByText("16 mã", { exact: true })).toBeVisible();
});

test("Mã: bật Ẩn mã đã ngừng, ở trang 2 còn một mã, ngừng mã đó thì bảng hiện trang có mã, thanh phân trang ghi đúng", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMACUOI", "ZZE2E Mã trang cuối");
  for (let i = 1; i <= 16; i++) await createCode(page, bank, `ZZE2E Cuốitrang ${String(i).padStart(2, "0")}`);
  await open(page, `/banks/codes?${new URLSearchParams({ bank, q: "cuoitrang", hide: "1", page: "2" })}`);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("ZZE2E Cuốitrang 16");
  await rows(page).first().getByRole("button", { name: "Ngừng" }).click();
  await page.getByRole("dialog", { name: "Ngừng mã" }).getByRole("button", { name: "Ngừng" }).click();
  await expect(rows(page)).toHaveCount(15);
  const pager = page.getByRole("navigation", { name: "Phân trang" });
  await expect(pager).toContainText("1–15 trên 15");
  await expect(pager).toContainText("1 / 1");
  await expect(pager.getByRole("link")).toHaveCount(0);
  await expect(page.getByText("15 mã", { exact: true })).toBeVisible();
});

test("Mã: tham số URL lạ không lỗi 500: tháng sai về tháng hiện tại, ngân hàng lạ bỏ lọc, page lạ, q lặp", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Mã phạm vi URL", username: "zz_e2e_c_maurl" });
  await createBank(admin, "ZZCMAURL", "ZZE2E Mã URL", [u.id]);
  const outside = await createBank(admin, "ZZCMAURL2", "ZZE2E Mã URL ngoài");
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
  const label = `Tháng ${now.slice(5, 7)}/${now.slice(0, 4)}`;
  for (const month of ["2026-13", "abc", "2026-1", "", "2026-00"]) {
    expect((await admin.goto(`/banks/codes?month=${month}`))?.status()).toBe(200);
    await expect(admin.getByText(label, { exact: true })).toBeVisible();
  }
  for (const qs of ["page=0", "page=-1", "page=abc", "page=1.5", "page=999", "page=1e9", `bank=${MISSING}`, "bank=abc", "q=a&q=b", "bank=a&bank=b", "month=2026-11&month=2026-12", "hide=1&hide=0"]) {
    expect([qs, (await admin.goto(`/banks/codes?${qs}`))?.status()]).toEqual([qs, 200]);
  }
  const staff = await asUser(browser, "zz_e2e_c_maurl", u.password);
  await open(staff, `/banks/codes?bank=${outside}`);
  await expect(bankFilter(staff)).toHaveValue("");
  await expect(bankFilter(staff).locator("option")).toHaveText(["Mọi ngân hàng", "ZZE2E Mã URL"]);
});

test("Mã: lọc trên URL đổi bằng link hoặc nút Quay lại thì ô tìm, ô ngân hàng hiện đúng lọc của URL", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMABACK", "ZZE2E Mã quay lại");
  await createCode(page, bank, "ZZE2E Quay lại");
  await open(page, "/banks/codes");
  await searchBox(page).fill("quay lai");
  await expect(page).toHaveURL(/q=quay\+lai/);
  await bankFilter(page).selectOption(bank);
  await expect(page).toHaveURL(new RegExp(`bank=${bank}`));
  await page.getByRole("link", { name: "Kho mã giới thiệu" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(searchBox(page)).toHaveValue("");
  await expect(bankFilter(page)).toHaveValue("");
  await page.goBack();
  await expect(page).toHaveURL(/q=quay\+lai/);
  await expect(searchBox(page)).toHaveValue("quay lai");
  await expect(bankFilter(page)).toHaveValue(bank);
});

test("Mã: tháng 12/2026 bấm Tháng sau ra 01/2027, bấm Tháng trước về 12/2026", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await open(page, "/banks/codes?month=2026-12");
  await expect(page.getByText("Tháng 12/2026", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page).toHaveURL(/month=2027-01/);
  await expect(page.getByText("Tháng 01/2027", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tháng trước" }).click();
  await expect(page).toHaveURL(/month=2026-12/);
  await expect(page.getByText("Tháng 12/2026", { exact: true })).toBeVisible();
});

test("Mã: tháng trước 1900 trên URL bị bỏ như ngày, bấm Tháng sau ra tháng sau của tháng hiện tại", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
  const [y, m] = now.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = (ym: string) => `Tháng ${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
  for (const month of ["0001-01", "0099-12", "1899-12"]) {
    await open(page, `/banks/codes?month=${month}`);
    await expect(page.getByText(label(now), { exact: true }), month).toBeVisible();
  }
  await page.getByRole("link", { name: "Tháng sau" }).click();
  await expect(page).toHaveURL(new RegExp(`month=${next}`));
  await expect(page.getByText(label(next), { exact: true })).toBeVisible();
});

test("Mã: form báo lỗi đúng ô: tên trống, thiếu cả mã text lẫn QR, số lượt và độ ưu tiên sai hoặc bỏ trống, link sai dạng, tên trùng cùng ngân hàng", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMAFORM", "ZZE2E Mã form", [], "0");
  const other = await createBank(page, "ZZCMAFORM2", "ZZE2E Mã form khác");
  await createCode(page, bank, "ZZE2E Đã có");
  await open(page, "/banks/codes");
  const d = await openAdd(page);
  await d.getByLabel("Ngân hàng").selectOption(bank);
  const submit = () => d.getByRole("button", { name: "Tạo mã" }).click();
  const name = d.getByLabel("Tên hiển thị");
  const text = d.getByLabel("Mã text (Mã giới thiệu)");
  await name.fill("   ");
  await submit();
  await expect(name).toHaveAccessibleDescription("Nhập tên hiển thị");
  await expect(text).toHaveAccessibleDescription("Nhập mã text hoặc chọn ảnh QR");
  await name.fill("ZZE2E Mã form mới");
  await text.fill("ZZC-FORM");

  const quota = d.getByLabel("Số lượt mỗi tháng");
  for (const [bad, msg] of [
    ["0", "Số lượt mỗi tháng lớn hơn 0"],
    ["-1", "Số lượt mỗi tháng lớn hơn 0"],
    ["1.5", "Số lượt là số nguyên"],
    ["abc", "Số lượt là số"],
    ["100001", "Số lượt tối đa 100.000"],
  ]) {
    await quota.fill(bad);
    await submit();
    await expect(quota, bad).toHaveAccessibleDescription(msg);
  }
  await quota.fill("100000");
  const priority = d.getByLabel("Độ ưu tiên");
  for (const [bad, msg] of [
    ["-1", "Độ ưu tiên từ 0 tới 999"],
    ["1000", "Độ ưu tiên từ 0 tới 999"],
    ["", "Độ ưu tiên là số"],
  ]) {
    await priority.fill(bad);
    await submit();
    await expect(priority, JSON.stringify(bad)).toHaveAccessibleDescription(msg);
  }
  await priority.fill("1");
  const link = d.getByLabel("Link mở tài khoản trong QR");
  for (const bad of ["javascript:alert(1)", "example.com", "data:text/html,x", "ftp://example.com"]) {
    await link.fill(bad);
    await submit();
    await expect(link, bad).toHaveAccessibleDescription("Link phải bắt đầu bằng http:// hoặc https://");
  }
  await link.fill("");
  await name.fill("ZZE2E Đã có");
  await submit();
  await expect(name).toHaveAccessibleDescription("Tên hiển thị đã có trong ngân hàng này.");
  await name.fill("ZZE2E Mã form mới");
  await link.fill("  HTTPS://Example.com/mo?ref=1  ");
  await submit();
  await expect(d).toBeHidden();
  await expect(rowOf(page, "ZZE2E Mã form mới")).toBeVisible();
  await createCode(page, other, "ZZE2E Đã có");
});

test("Mã: ba request tạo cùng tên cùng ngân hàng cùng lúc thì một 201, hai 409, không lỗi 500", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMADONG", "ZZE2E Mã đồng thời");
  const body = { bankId: bank, displayName: "ZZE2E Đồng thời", code: "ZZC-DONG", qrKey: null, openUrl: "", monthlyQuota: "5", priority: "0", schoolIds: [] };
  const results = await Promise.all([1, 2, 3].map(() => api(page, "POST", "/api/admin/referral-codes", body)));
  expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  for (const r of results.filter((x) => x.status !== 201)) expect(r.body).toEqual({ message: "Tên hiển thị đã có trong ngân hàng này.", field: "displayName" });
});

test("Mã: API với ngân hàng không có, trường không có, trường đã đóng trả lỗi rõ ràng, không lỗi 500; mã đang gắn trường đã đóng vẫn sửa được", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMAID", "ZZE2E Mã id lạ");
  const base = { bankId: bank, displayName: "ZZE2E Id lạ", code: "ZZC-ID", qrKey: null, openUrl: "", monthlyQuota: "5", priority: "0", schoolIds: [] as string[] };
  expect(await api(page, "POST", "/api/admin/referral-codes", { ...base, bankId: MISSING })).toEqual({ status: 404, body: { message: "Không tìm thấy ngân hàng.", field: "bankId" } });
  const bad = await api(page, "POST", "/api/admin/referral-codes", { ...base, schoolIds: [MISSING] });
  expect(bad.status).toBe(400);
  expect((bad.body as { field?: string }).field).toBe("schoolIds");

  const school = await createSchool(page, "ZZE2E Trường sẽ đóng");
  const id = await createCode(page, bank, "ZZE2E Gắn trường", { schoolIds: [school] });
  expect((await api(page, "POST", `/api/admin/schools/${school}/active`, { active: false })).status).toBe(204);
  const closed = await api(page, "POST", "/api/admin/referral-codes", { ...base, displayName: "ZZE2E Gắn trường đóng", schoolIds: [school] });
  expect(closed.status).toBe(400);
  expect((closed.body as { field?: string }).field).toBe("schoolIds");
  expect((await api(page, "PATCH", `/api/admin/referral-codes/${id}`, { ...base, displayName: "ZZE2E Gắn trường sửa", schoolIds: [school] })).status).toBe(204);
  expect((await api(page, "PATCH", `/api/admin/referral-codes/${id}`, { ...base, displayName: "ZZE2E Gắn trường sửa", schoolIds: [school, MISSING] })).status).toBe(400);

  await open(page, `/banks/codes?bank=${bank}`);
  await page.getByRole("button", { name: "Sửa mã ZZE2E Gắn trường sửa" }).click();
  const d = page.getByRole("dialog", { name: "Sửa mã giới thiệu" });
  await page.route("**/api/admin/referral-codes/*", (route) =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Có trường đã đóng hoặc không còn.", field: "schoolIds" }) }) : route.continue(),
  );
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d.getByRole("combobox", { name: "Trường dùng mã này" })).toHaveAccessibleDescription("Có trường đã đóng hoặc không còn.");
});

test("Mã: Nhân viên được giao một ngân hàng chỉ thấy mã ngân hàng đó; sửa, ngừng mã ngân hàng khác qua API nhận 404; mọi mã đã ngừng mà bật Ẩn thì ghi không có mã khớp", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Nhân viên mã", username: "zz_e2e_c_manv" });
  const mine = await createBank(admin, "ZZCMANV", "ZZE2E Mã của mình", [u.id]);
  const other = await createBank(admin, "ZZCMANV2", "ZZE2E Mã người khác");
  const myCode = await createCode(admin, mine, "ZZE2E Mã mình");
  const otherCode = await createCode(admin, other, "ZZE2E Mã người khác");
  const staff = await asUser(browser, "zz_e2e_c_manv", u.password);
  await open(staff, "/banks/codes");
  await expect(rows(staff)).toHaveCount(1);
  await expect(rowOf(staff, "ZZE2E Mã mình")).toBeVisible();
  const d = await openAdd(staff);
  await expect(d.getByLabel("Ngân hàng").locator("option")).toHaveText(["ZZE2E Mã của mình"]);
  await d.getByRole("button", { name: "Huỷ" }).click();

  const body = { bankId: other, displayName: "ZZE2E Lấn", code: "X", qrKey: null, openUrl: "", monthlyQuota: "5", priority: "0", schoolIds: [] };
  expect((await api(staff, "POST", "/api/admin/referral-codes", body)).status).toBe(404);
  expect((await api(staff, "PATCH", `/api/admin/referral-codes/${otherCode}`, body)).status).toBe(404);
  expect((await api(staff, "POST", `/api/admin/referral-codes/${otherCode}/active`, { active: false })).status).toBe(404);
  expect((await api(staff, "POST", `/api/admin/referral-codes/${MISSING}/active`, { active: false })).status).toBe(404);

  expect((await api(staff, "POST", `/api/admin/referral-codes/${myCode}/active`, { active: false })).status).toBe(204);
  await open(staff, "/banks/codes?hide=1");
  await expect(rows(staff)).toHaveCount(1);
  await expect(rows(staff).first()).toHaveText("Không có mã khớp bộ lọc.");
});

test("Mã: mã của ngân hàng đã tắt mở hộp Sửa thì ô Ngân hàng hiện đúng ngân hàng của mã", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const off = await createBank(page, "ZZCMATAT", "ZZE2E Mã ngân hàng tắt");
  await createCode(page, off, "ZZE2E Mã ngân hàng tắt");
  expect((await api(page, "POST", `/api/admin/banks/${off}/active`, { active: false })).status).toBe(204);
  await open(page, `/banks/codes?bank=${off}`);
  await page.getByRole("button", { name: "Sửa mã ZZE2E Mã ngân hàng tắt" }).click();
  const d = page.getByRole("dialog", { name: "Sửa mã giới thiệu" });
  await expect(d.getByLabel("Ngân hàng")).toHaveValue(off);
  await expect(d.getByLabel("Ngân hàng").locator("option:checked")).toHaveText("ZZE2E Mã ngân hàng tắt");
});

test("Mã: tạo mã cho ngân hàng vừa tắt, bằng API hay ở tab còn mở hộp Thêm mã, báo Ngân hàng đã tắt. ở ô Ngân hàng", async ({ browser }) => {
  const one = await asUser(browser, "zz_e2e_admin");
  const off = await createBank(one, "ZZCMAVTAT", "ZZE2E Mã ngân hàng vừa tắt", [], "0");
  expect((await api(one, "POST", `/api/admin/banks/${off}/active`, { active: false })).status).toBe(204);
  const body = { bankId: off, displayName: "ZZE2E Mã cho ngân hàng tắt", code: "ZZC-TAT", qrKey: null, openUrl: "", monthlyQuota: "5", priority: "0", schoolIds: [] };
  expect(await api(one, "POST", "/api/admin/referral-codes", body)).toEqual({ status: 400, body: { message: "Ngân hàng đã tắt.", field: "bankId" } });

  const live = await createBank(one, "ZZCMAVTAT2", "ZZE2E Mã ngân hàng sắp tắt", [], "0");
  const two = await one.context().newPage();
  await open(two, "/banks/codes");
  await two.getByRole("button", { name: "Thêm mã" }).click();
  const d = two.getByRole("dialog", { name: "Thêm mã giới thiệu" });
  await d.getByLabel("Ngân hàng").selectOption(live);
  await d.getByLabel("Tên hiển thị").fill("ZZE2E Mã hai tab tắt");
  await d.getByLabel("Mã text (Mã giới thiệu)").fill("ZZC-HAITAB");
  expect((await api(one, "POST", `/api/admin/banks/${live}/active`, { active: false })).status).toBe(204);
  await d.getByRole("button", { name: "Tạo mã" }).click();
  await expect(d.getByLabel("Ngân hàng")).toHaveAccessibleDescription("Ngân hàng đã tắt.");
});

test("Mã: link có dấu cách giữa lưu như mgst-app; ảnh QR là file văn bản đổi đuôi thì báo lỗi, ô ảnh không giữ ảnh", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const bank = await createBank(page, "ZZCMALINK", "ZZE2E Mã link", [], "0");
  await open(page, "/banks/codes");
  const d = await openAdd(page);
  await d.getByLabel("Ngân hàng").selectOption(bank);
  await d.getByLabel("Tên hiển thị").fill("ZZE2E Link cách");
  const chooser = page.waitForEvent("filechooser");
  await d.getByRole("button", { name: "Chọn ảnh QR" }).click();
  await (await chooser).setFiles({ name: "qr.png", mimeType: "image/png", buffer: Buffer.from("không phải ảnh") });
  await expect(d.getByRole("alert")).toHaveText("Chỉ nhận ảnh jpg, png, webp hoặc heic.");
  await expect(d.getByRole("button", { name: "Chọn ảnh QR" })).toBeVisible();
  await expect(d.getByRole("img", { name: "Ảnh QR đã chọn" })).toHaveCount(0);
  await d.getByLabel("Mã text (Mã giới thiệu)").fill("ZZC-LINK");
  await d.getByLabel("Link mở tài khoản trong QR").fill("https://exa mple.com/mo");
  await d.getByRole("button", { name: "Tạo mã" }).click();
  await expect(d).toBeHidden();
});

test("Mã: ảnh QR 23 MB báo Ảnh lớn hơn 20 MB. ở ô Ảnh QR, không gửi lên máy chủ; máy chủ trả 413 dạng HTML cũng báo ở ô Ảnh QR", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCQRTO", "ZZE2E Ảnh QR to", [], "0");
  await open(page, "/banks/codes");
  const uploads = uploadsOf(page);
  await page.getByRole("button", { name: "Thêm mã" }).click();
  let d = page.getByRole("dialog", { name: "Thêm mã giới thiệu" });
  let qr = d.getByRole("button", { name: "Chọn ảnh QR" });
  await pickFile(page, qr, { name: "to.png", mimeType: "image/png", buffer: Buffer.alloc(23 * 1024 * 1024) });
  await expect(qr).toHaveAccessibleDescription(TOO_LARGE);
  expect(uploads).toEqual([]);
  await d.getByRole("button", { name: "Huỷ" }).click();

  await page.route((url) => url.pathname === "/api/admin/uploads", (route) => route.fulfill({ status: 413, contentType: "text/html", body: HTML_413 }));
  await page.getByRole("button", { name: "Thêm mã" }).click();
  d = page.getByRole("dialog", { name: "Thêm mã giới thiệu" });
  qr = d.getByRole("button", { name: "Chọn ảnh QR" });
  await expect(qr).not.toHaveAccessibleDescription(TOO_LARGE);
  await pickFile(page, qr, { name: "nho.png", mimeType: "image/png", buffer: Buffer.from("ảnh nhỏ") });
  await expect.poll(() => uploads.length).toBe(1);
  await expect(qr).toHaveAccessibleDescription(TOO_LARGE);
});

test("Mã: đang tải ảnh QR thì nút chọn ảnh QR bị khoá, không chọn được ảnh thứ hai; tải xong ô ảnh giữ đúng ảnh vừa tải", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCQRHAI", "ZZE2E Ảnh QR hai lần", [], "0");
  await open(page, "/banks/codes");
  const d = await openAdd(page);
  // Máy chủ trả chậm: ảnh chọn trước tải xong sau thì ảnh QR là ảnh trước, link là link của ảnh sau.
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const key = "qr/2026-11-07/0b7c2f4e-6a1d-4c3b-9e8f-1a2b3c4d5e6f.webp";
  await page.route((url) => url.pathname === "/api/admin/uploads", async (route) => {
    await gate;
    await route.fulfill({ json: { key } });
  });
  await pickFile(page, d.getByRole("button", { name: "Chọn ảnh QR" }), { name: "qr.png", mimeType: "image/png", buffer: Buffer.from("ảnh một") });
  const busy = d.getByRole("button", { name: "Đang tải ảnh…" });
  await expect(busy).toBeDisabled();
  await expect(d.getByRole("button", { name: "Tạo mã" })).toBeDisabled();
  release();
  await expect(d.getByRole("img", { name: "Ảnh QR đã chọn" })).toHaveAttribute("src", `/api/admin/images?key=${encodeURIComponent(key)}`);
  await expect(d.getByRole("button", { name: "Ảnh QR đã chọn" })).toBeEnabled();
  await d.getByRole("button", { name: "Huỷ" }).click();
});

test("Mã: huỷ hộp chọn ảnh QR thì hộp Thêm mã vẫn mở, chữ đang gõ còn; Esc vẫn đóng hộp", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createBank(page, "ZZCQRHUY", "ZZE2E Huỷ chọn QR", [], "0");
  await open(page, "/banks/codes");
  const d = await openAdd(page);
  await d.getByLabel("Tên hiển thị").fill("ZZE2E Tên đang gõ");
  await d.getByLabel("Mã text (Mã giới thiệu)").fill("ZZC-DANGGO");
  const chooser = page.waitForEvent("filechooser");
  await d.getByRole("button", { name: "Chọn ảnh QR" }).click();
  await chooser;
  // Huỷ hộp chọn file hay chọn lại đúng ảnh cũ thì Chrome phát `cancel` từ ô file; phát thẳng sự kiện đó, không chờ Chrome tự phát.
  await d.locator('input[type="file"]').evaluate(async (el) => {
    el.dispatchEvent(new Event("cancel", { bubbles: true }));
    await new Promise(requestAnimationFrame);
  });
  await expect(d).toBeVisible();
  await expect(d.getByLabel("Tên hiển thị")).toHaveValue("ZZE2E Tên đang gõ");
  await expect(d.getByLabel("Mã text (Mã giới thiệu)")).toHaveValue("ZZC-DANGGO");
  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
});
