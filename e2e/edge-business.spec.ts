import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import * as B from "../scripts/e2e-data-business";
import { closeContexts, column, DESKTOP, insideViewport, loginAs, open, pageOverflow, PHONE, readExport } from "./edge-business-support";

const q = (text: string) => `q=${encodeURIComponent(text)}`;
const table = (page: Page) => page.getByRole("region", { name: "Hồ sơ học sinh" });
const bodyRows = (page: Page) => table(page).locator("tbody tr");
const meta = (page: Page) => table(page).getByText(/^\d+ hồ sơ$/);
const pager = (page: Page) => page.getByRole("navigation", { name: "Phân trang" });
const EMPTY = "Không có hồ sơ khớp bộ lọc.";

test.afterEach(closeContexts);

test("Trang 3: tên 100 ký tự có dấu cách và tên liền không dấu cách, ở 1366 và 390 px không tràn ngang, ô tìm và các nút nằm trong màn hình", async ({ browser }) => {
  for (const device of [DESKTOP, PHONE]) {
    const page = await loginAs(browser, "zz_e2e_admin", device);
    for (const name of [B.B_LONG_NAME, B.B_UNBROKEN_NAME]) {
      await open(page, `/customers?${q(name)}&status=pending_review`);
      await expect(table(page).getByRole("link", { name, exact: true })).toBeVisible();
      await expect(page.getByText("Trạng thái: Chờ kiểm tra")).toBeVisible();
      expect([device.viewport.width, name.slice(0, 10), await pageOverflow(page)]).toEqual([device.viewport.width, name.slice(0, 10), 0]);
      for (const control of [page.getByRole("search"), page.getByRole("button", { name: "Bộ lọc" }), page.getByRole("button", { name: "Xuất Excel" }), page.getByRole("link", { name: /^Bỏ lọc/ })])
        expect(await insideViewport(control)).toBe(true);
    }
    await page.context().close();
  }
});

test("Trang 3: tên có thẻ HTML, ngoặc, %, _, \\, emoji hiện nguyên văn; tìm ký tự đặc biệt, NUL, chuỗi giống SQL không lỗi 500", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const alerts: string[] = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  for (const [name, term] of [
    [B.B_XSS, "script"],
    [B.B_QUOTES, "kep"],
    [B.B_EMOJI, "emoji"],
  ]) {
    await open(page, `/customers?${q(term)}`);
    await expect(table(page).getByRole("link", { name, exact: true })).toHaveText(name);
    expect(await page.locator('img[src="x"], tbody script').count()).toBe(0);
  }

  for (const ch of ["%", "_", "\\", "'", '"']) {
    await open(page, `/customers?${q(ch)}`);
    await expect(table(page).getByRole("link", { name: B.B_QUOTES, exact: true })).toBeVisible();
    const names = await table(page).locator("tbody tr td:nth-child(2)").allTextContents();
    expect([ch, names.every((n) => n.includes(ch))]).toEqual([ch, true]);
  }

  for (const raw of ["q=%00", "q=a%00b", "q=bien%00", q("' or 1=1 --"), q("<img src=x onerror=alert(2)>")]) {
    expect([raw, await open(page, `/customers?${raw}`)]).toEqual([raw, 200]);
    await expect(page.getByRole("heading", { level: 1, name: "Hồ sơ học sinh" })).toBeVisible();
  }
  await open(page, "/customers?q=bien%00");
  await expect(page.getByRole("search").getByRole("textbox")).toHaveValue("bien");
  expect(alerts).toEqual([]);
});

test("Trang 3 tìm: có dấu, không dấu, hoa thường, một phần, nhiều từ khác thứ tự, SĐT có dấu cách, ô chỉ có khoảng trắng, không khớp", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  for (const text of ["Biên Phân Trang", "bien phan trang", "BIÊN PHÂN", "phan tra"]) {
    await open(page, `/customers?${q(text)}`);
    await expect(meta(page), text).toHaveText("16 hồ sơ");
  }
  for (const text of ["trang 07 bien", "bien 07", "Phân 07"]) {
    await open(page, `/customers?${q(text)}`);
    await expect(meta(page), text).toHaveText("1 hồ sơ");
    await expect(table(page).getByRole("link", { name: B.bPageName(7) })).toBeVisible();
  }
  for (const text of ["0988 000 307", "0988.000.307", "000307"]) {
    await open(page, `/customers?${q(text)}`);
    await expect(meta(page), text).toHaveText("1 hồ sơ");
    await expect(table(page).getByRole("link", { name: B.bPageName(7) })).toBeVisible();
  }

  await open(page, "/customers");
  const all = await meta(page).textContent();
  const box = page.getByRole("search").getByRole("textbox");
  await box.fill("   ");
  await box.press("Enter");
  await page.waitForURL(/q=/);
  await page.waitForLoadState("networkidle");
  await expect(meta(page)).toHaveText(all!);
  await expect(page.getByText(EMPTY)).toHaveCount(0);

  await open(page, `/customers?${q("zz khong co ai bien")}`);
  await expect(page.getByText(EMPTY)).toBeVisible();
  await expect(meta(page)).toHaveText("0 hồ sơ");
});

test("Trang 3: dán 20.000 ký tự vào ô tìm không ra lỗi 431, URL tìm 2.000 ký tự hiện câu báo rỗng", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, "/customers");
  const box = page.getByRole("search").getByRole("textbox");
  await box.focus();
  await page.keyboard.insertText("biên".repeat(5000));
  const typed = await box.inputValue();
  expect(typed.length).toBeLessThanOrEqual(100);
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/customers?") && r.request().resourceType() === "document"), box.press("Enter")]);
  expect(res.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Hồ sơ học sinh" })).toBeVisible();

  expect(await open(page, `/customers?q=${"x".repeat(2000)}`)).toBe(200);
  await expect(page.getByText(EMPTY)).toBeVisible();
});

test("Trang 3 phân trang: 16 hồ sơ ra 15 và 1 dòng, đổi từ khoá về trang 1, đổi lọc về trang 1, lọc còn 15 thì không có nút Sau", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, `/customers?${q("bien phan trang")}`);
  await expect(bodyRows(page)).toHaveCount(15);
  await expect(pager(page)).toContainText("1–15 trên 16");
  await pager(page).getByRole("link", { name: "Sau" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(bodyRows(page)).toHaveCount(1);
  await expect(bodyRows(page)).toContainText(B.bPageName(1));
  await expect(pager(page)).toContainText("16–16 trên 16");
  await expect(pager(page).getByRole("link", { name: "Sau" })).toHaveCount(0);

  const box = page.getByRole("search").getByRole("textbox");
  await box.fill("bien phan");
  await box.press("Enter");
  await page.waitForURL((url) => url.searchParams.get("q") === "bien phan");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(pager(page)).toContainText("1–15 trên 16");

  await open(page, `/customers?${q("bien phan trang")}&passed=1&page=2`);
  await expect(meta(page)).toHaveText("16 hồ sơ");
  await expect(bodyRows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Bộ lọc" }).click();
  await page.getByRole("radio", { name: "Đã kiểm tra" }).check();
  await page.waitForURL(/status=reviewed/);
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  expect(new URL(page.url()).searchParams.get("passed")).toBe("1");
  await page.getByRole("button", { name: "Xong" }).click();
  await expect(meta(page)).toHaveText("15 hồ sơ");
  await expect(bodyRows(page)).toHaveCount(15);
  await expect(pager(page)).toHaveCount(0);
  await expect(pager(page).getByRole("link", { name: "Sau" })).toHaveCount(0);
});

test("Trang 3 URL lạ: số trang sai, giá trị lọc không có, ngày sai hoặc năm 0001 không lỗi 500; bỏ chip chỉ bỏ đúng một lọc", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  for (const [p, shown] of [
    ["0", "1 / 2"],
    ["-1", "1 / 2"],
    ["abc", "1 / 2"],
    ["999", "2 / 2"],
    ["1e400", "2 / 2"],
    ["2.5", "2 / 2"],
  ]) {
    expect([p, await open(page, `/customers?${q("bien phan trang")}&page=${p}`)]).toEqual([p, 200]);
    await expect(pager(page), p).toContainText(shown);
  }

  await open(page, `/customers?${q("bien phan trang")}&status=foo&passed=3&check=x`);
  await expect(meta(page)).toHaveText("16 hồ sơ");
  await expect(page.getByText("Đang lọc")).toHaveCount(0);

  for (const dates of ["from=2026-02-30", "from=abc", "to=2026-13-01", "from=0001-01-01", "to=0000-01-01", "from=0001-01-01&to=0001-01-01"]) {
    expect([dates, await open(page, `/customers?${q("bien phan trang")}&${dates}`)]).toEqual([dates, 200]);
    await expect(meta(page), dates).toHaveText("16 hồ sơ");
  }

  await open(page, `/customers?${q("bien phan trang")}&status=reviewed&passed=1&from=2026-10-01&to=2026-10-31`);
  await expect(page.getByText("Ngày: 01/10/2026 – 31/10/2026")).toBeVisible();
  await page.getByRole("link", { name: "Bỏ lọc Trạng thái: Đã kiểm tra" }).click();
  await page.waitForURL((url) => !url.searchParams.has("status"));
  const sp = new URL(page.url()).searchParams;
  expect([sp.get("q"), sp.get("passed"), sp.get("from"), sp.get("to")]).toEqual(["bien phan trang", "1", "2026-10-01", "2026-10-31"]);
  await expect(page.getByRole("search").getByRole("textbox")).toHaveValue("bien phan trang");
  await expect(page.getByText("Đạt 1 ngân hàng")).toBeVisible();
  await expect(meta(page)).toHaveText("16 hồ sơ");
});

test("Trang 3: bấm Quay lại của trình duyệt khôi phục bộ lọc của bước trước, chip và ô chọn khớp URL", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, `/customers?${q("bien phan trang")}`);
  await page.getByRole("button", { name: "Bộ lọc" }).click();
  await page.getByRole("radio", { name: "Đã kiểm tra" }).check();
  await page.waitForURL(/status=reviewed/);
  await page.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Số ngân hàng đạt" }).click();
  await page.getByRole("radio", { name: "Đạt 1 ngân hàng" }).check();
  await page.waitForURL(/passed=1/);
  await page.keyboard.press("Escape");
  await page.waitForLoadState("networkidle");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("status") === "reviewed" && !url.searchParams.has("passed"));
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "Bỏ lọc Trạng thái: Đã kiểm tra" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bỏ lọc Đạt 1 ngân hàng" })).toHaveCount(0);
  await expect(meta(page)).toHaveText("15 hồ sơ");
  await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  await page.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Trạng thái" }).click();
  await expect(page.getByRole("radio", { name: "Đã kiểm tra" })).toBeChecked();
  await page.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Số ngân hàng đạt" }).click();
  await expect(page.getByRole("radio", { name: "Mọi hồ sơ" })).toBeChecked();
});

test("Trang 3 ngày giờ Việt Nam: 23:30 ngày 31/10 và 00:30 ngày 01/11 hiện đúng ngày, lọc trọn ngày, từ ngày lớn hơn tới ngày ra rỗng", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, `/customers?${q("bien gio")}`);
  await expect(bodyRows(page)).toHaveCount(2);
  await expect(bodyRows(page).nth(0)).toContainText(B.B_EARLY);
  await expect(bodyRows(page).nth(0).locator("td").first()).toHaveText("01/11 00:30");
  await expect(bodyRows(page).nth(1)).toContainText(B.B_LATE);
  await expect(bodyRows(page).nth(1).locator("td").first()).toHaveText("31/10 23:30");

  for (const [day, name] of [
    ["2026-10-31", B.B_LATE],
    ["2026-11-01", B.B_EARLY],
  ]) {
    await open(page, `/customers?${q("bien gio")}&from=${day}&to=${day}`);
    await expect(bodyRows(page), day).toHaveCount(1);
    await expect(bodyRows(page), day).toContainText(name);
  }
  await open(page, `/customers?${q("bien gio")}&from=2026-10-01&to=2026-10-31`);
  await expect(bodyRows(page)).toHaveCount(1);
  await expect(bodyRows(page)).toContainText(B.B_LATE);

  await open(page, `/customers?${q("bien gio")}&from=2026-11-01&to=2026-10-31`);
  await expect(page.getByText(EMPTY)).toBeVisible();
  await expect(page.getByText("Ngày: 01/11/2026 – 31/10/2026")).toBeVisible();
  await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  await page.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Ngày" }).click();
  await expect(page.getByRole("region", { name: "Ngày" }).getByRole("button")).toHaveText("01/11/2026 → 31/10/2026");
});

test("Trang 3 phân quyền: Nhân viên chỉ thấy hồ sơ có ngân hàng mình quản ở trang và API, không có quyền Xuất Excel thì không có nút và route trả 403", async ({ browser }) => {
  const staff = await loginAs(browser, B.B_USER1);
  await open(staff, `/customers?${q("bien")}`);
  await expect(table(staff).getByRole("link", { name: B.B_NAMES.both })).toBeVisible();
  for (const name of [B.B_NAMES.only2, B.B_NAMES.none]) await expect(table(staff).getByRole("link", { name, exact: true })).toHaveCount(0);
  await open(staff, `/customers?${q(B.B_NAMES.only2)}`);
  await expect(staff.getByText(EMPTY)).toBeVisible();
  expect((await (await staff.request.get(`/api/admin/customers?${q(B.B_NAMES.only2)}`)).json()).total).toBe(0);
  expect((await (await staff.request.get(`/api/admin/customers?${q(B.B_NAMES.none)}`)).json()).total).toBe(0);
  await expect(staff.getByRole("button", { name: "Xuất Excel" })).toHaveCount(0);
  expect((await staff.request.get("/api/admin/customers/export")).status()).toBe(403);

  const empty = await loginAs(browser, B.B_USER3);
  await open(empty, "/customers");
  await expect(empty.getByText("Chưa có hồ sơ nào.")).toBeVisible();

  const none = await loginAs(browser, "zz_e2e_noperm");
  expect(await open(none, "/customers")).toBe(404);
  expect((await none.request.get("/api/admin/customers")).status()).toBe(403);
  expect((await none.request.get("/api/admin/customers/export")).status()).toBe(403);

  const exporter = await loginAs(browser, B.B_USER2);
  const sheet = await readExport(exporter, `/api/admin/customers/export?${q("bien")}`);
  const names = sheet.rows.slice(3).map((r) => r[column(sheet, "HỌ TÊN")]);
  expect(names).toContain("BIEN CHI HAI");
  expect(names).toContain("BIEN HAI NGAN HANG");
  expect(names).not.toContain("BIEN THAY ANH");
  expect(names).not.toContain("BIEN CHUA CHON");
});

test("Trang 3 xuất Excel: đúng bộ lọc, không có dòng nào vẫn tải được, chuỗi bắt đầu bằng = + - @ là chữ, tên 100 ký tự giữ nguyên, SĐT giữ số 0, từ khoá có NUL không lỗi", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const filtered = await readExport(page, `/api/admin/customers/export?${q("bien phan trang")}&status=reviewed`);
  expect(filtered.rows.length - 3).toBe(15);
  expect(filtered.rows[1][0]).toBe("15");

  const empty = await readExport(page, `/api/admin/customers/export?${q("zz khong co ai bien")}`);
  expect(empty.rows.length).toBe(3);
  expect(empty.rows[1][0]).toBe("0");
  expect(empty.rows[2][0]).toBe("STT");

  const sheet = await readExport(page, `/api/admin/customers/export?${q("bien")}`);
  const [name, cls, phone] = ["HỌ TÊN", "LỚP", "SĐT"].map((h) => column(sheet, h));
  const at = (text: string) => sheet.rows.findIndex((r) => r[name] === text);
  const cell = (row: number, col: number) => ({ value: sheet.rows[row][col], type: sheet.types[row][col] });
  const formula = at("=1+2 BIEN CONG THUC");
  const minus = at("-BIEN TRU");
  expect(formula).toBeGreaterThan(2);
  expect(minus).toBeGreaterThan(2);
  const text = ExcelJS.ValueType.String;
  expect([cell(formula, name), cell(formula, cls)]).toEqual([
    { value: "=1+2 BIEN CONG THUC", type: text },
    { value: "=1+1", type: text },
  ]);
  expect(cell(minus, name)).toEqual({ value: "-BIEN TRU", type: text });
  const long = at(B.B_LONG_NAME.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase());
  expect(long).toBeGreaterThan(2);
  expect(sheet.rows[long][name].length).toBe(100);
  expect(sheet.rows[long][cls]).toBe(B.B_LONG_CLASS);
  expect(cell(long, phone)).toEqual({ value: B.bPhone(201), type: text });

  expect((await page.request.get("/api/admin/customers/export?q=bien%00")).status()).toBe(200);
});

test("Trang 3 xuất Excel lọc trọn ngày giờ Việt Nam: ngày 31/10 chỉ ra hồ sơ 23:30, GỬI LÚC ghi 31/10/2026 23:30, NGÀY CẤP ghi 31/10/2026 23:45; ngày 01/11 chỉ ra hồ sơ 00:30", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  for (const [day, name, sent, issued] of [
    ["2026-10-31", "BIEN GIO KHUYA", "31/10/2026 23:30", "31/10/2026 23:45"],
    ["2026-11-01", "BIEN GIO SOM", "01/11/2026 00:30", "01/11/2026 00:45"],
  ]) {
    const sheet = await readExport(page, `/api/admin/customers/export?${q("bien gio")}&from=${day}&to=${day}`);
    const cols = ["HỌ TÊN", "GỬI LÚC", "NGÀY CẤP"].map((h) => column(sheet, h));
    expect([day, sheet.rows.slice(3).map((r) => cols.map((c) => r[c]))]).toEqual([day, [[name, sent, issued]]]);
  }
});

test("Trang 3: lọc Chờ kiểm tra còn 1 dòng ở trang 2, mở hồ sơ đó bấm Đạt rồi bấm Quay lại của trình duyệt thì còn một trang nên không có thanh phân trang, không có trang rỗng, không còn dòng cũ", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const name = B.bWaitName(0);
  await open(page, `/customers?${q("bien cho kiem")}&status=pending_review&from=2026-10-15&to=2026-10-15&page=2`);
  await expect(meta(page)).toHaveText("16 hồ sơ");
  await expect(bodyRows(page)).toHaveCount(1);
  await table(page).getByRole("link", { name, exact: true }).click();
  await page.waitForURL(new RegExp(B.bWaitId(0)));
  const bank = page.getByRole("region", { name: B.B_BANK2, exact: true });
  await bank.getByRole("button", { name: "Đạt", exact: true }).click();
  await page.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bank.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);

  await page.goBack();
  await page.waitForURL(/page=2/);
  await page.waitForLoadState("networkidle");
  await expect(meta(page)).toHaveText("15 hồ sơ");
  await expect(pager(page)).toHaveCount(0);
  await expect(bodyRows(page)).toHaveCount(15);
  await expect(table(page).getByRole("link", { name, exact: true })).toHaveCount(0);
});
