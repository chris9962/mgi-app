import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import * as B from "../scripts/e2e-data-business";
import { ADMIN, closeContexts, column, DESKTOP, insideViewport, loginAs, open, pageOverflow, PHONE, readExport } from "./edge-business-support";

const q = (text: string) => `q=${encodeURIComponent(text)}`;
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const rows = (page: Page, name: string) => card(page, name).locator("tbody tr");
const meta = (page: Page, name: string, unit: string) => card(page, name).getByText(new RegExp(`^\\d+ ${unit}$`));
const pager = (page: Page) => page.getByRole("navigation", { name: "Phân trang" });

test.afterEach(closeContexts);

test.describe("trang Ngân hàng nhóm Nghiệp vụ", () => {
  const NH = "Ngân hàng";

  test("tên ngân hàng, trường, học sinh dài ở 1366 và 390 px không tràn ngang; chip Trường tên dài nằm trong màn hình", async ({ browser }) => {
    for (const device of [DESKTOP, PHONE]) {
      const page = await loginAs(browser, "zz_e2e_admin", device);
      await open(page, `/customer-banks?${q(B.B_UNBROKEN_NAME.slice(0, 11))}&school=${B.B_SCHOOL_ID},${B.B_SCHOOL2_ID}`);
      await expect(card(page, NH).getByRole("link", { name: B.B_UNBROKEN_NAME })).toBeVisible();
      const chip = page.getByText(/^Trường: /);
      await expect(chip).toContainText(B.B_SCHOOL);
      await expect(chip).toContainText(B.B_SCHOOL2);
      expect([device.viewport.width, await pageOverflow(page), await insideViewport(chip), await insideViewport(page.getByRole("link", { name: /^Bỏ lọc Trường/ }))]).toEqual([device.viewport.width, 0, true, true]);
      await page.context().close();
    }
  });

  test("URL lạ: NUL, ngân hàng sai, ngân hàng ngoài phạm vi, trường không có, trạng thái lạ, chiều lạ, trang lạ không lỗi 500 và không kẹt chip; ô tìm trường nhận % _ NUL", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const raw of ["q=%00", "q=bien%00", "bank=abc", `school=${randomUUID()}`, "status=foo", "dir=foo", "page=abc", "page=-1", "from=0001-01-01", "check=x"]) {
      expect([raw, await open(page, `/customer-banks?${q("bien phan trang")}&${raw}`)]).toEqual([raw, 200]);
      await expect(page.getByText("Đang lọc"), raw).toHaveCount(0);
    }
    for (const term of ["%", "_", "\\"]) {
      const res = await page.request.get(`/api/admin/customer-banks/schools?q=${encodeURIComponent(term)}`);
      expect([term, res.status()]).toEqual([term, 200]);
      expect([term, (await res.json()).length]).toEqual([term, 0]);
    }
    const nul = await page.request.get("/api/admin/customer-banks/schools?q=%00");
    expect(nul.status()).toBe(200);
    expect(await nul.json()).toEqual(await (await page.request.get("/api/admin/customer-banks/schools?q=")).json());

    const staff = await loginAs(browser, B.B_USER1);
    await open(staff, `/customer-banks?${q("bien hai ngan hang")}&bank=${B.B_BANK2_ID}`);
    await expect(staff.getByText("Đang lọc")).toHaveCount(0);
    await expect(rows(staff, NH)).toHaveCount(1);
    await expect(rows(staff, NH)).toContainText(B.B_BANK1);
  });

  test("tìm nhiều từ, SĐT; 17 dòng ra 15 và 2; đổi chiều Ngày giữ tìm và lọc, về trang 1; lọc trọn ngày giờ Việt Nam", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    await open(page, `/customer-banks?${q("trang 07 bien")}`);
    await expect(meta(page, NH, "dòng")).toHaveText("1 dòng");
    await open(page, `/customer-banks?${q("0988 000 316")}`);
    await expect(meta(page, NH, "dòng")).toHaveText("2 dòng");

    await open(page, `/customer-banks?${q("bien phan trang")}&status=passed`);
    await expect(meta(page, NH, "dòng")).toHaveText("16 dòng");
    await open(page, `/customer-banks?${q("bien phan trang")}`);
    await expect(meta(page, NH, "dòng")).toHaveText("17 dòng");
    await expect(rows(page, NH)).toHaveCount(15);
    await pager(page).getByRole("link", { name: "Sau" }).click();
    await page.waitForURL(/page=2/);
    await expect(rows(page, NH)).toHaveCount(2);
    await card(page, NH).getByRole("link", { name: /^Ngày/ }).click();
    await page.waitForURL(/dir=asc/);
    await page.waitForLoadState("networkidle");
    const sp = new URL(page.url()).searchParams;
    expect([sp.get("q"), sp.has("page")]).toEqual(["bien phan trang", false]);
    await expect(rows(page, NH)).toHaveCount(15);
    await expect(rows(page, NH).first()).toContainText(B.bPageName(1));

    for (const [day, name] of [
      ["2026-10-31", B.B_LATE],
      ["2026-11-01", B.B_EARLY],
    ]) {
      await open(page, `/customer-banks?${q("bien gio")}&from=${day}&to=${day}`);
      await expect(rows(page, NH), day).toHaveCount(1);
      await expect(rows(page, NH), day).toContainText(name);
    }
  });

  test("lọc Chờ kiểm tra còn 1 dòng ở trang 2, mở hồ sơ đó bấm Đạt rồi bấm Quay lại của trình duyệt thì trang ghi 1 / 1, không có trang rỗng, không còn dòng cũ", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    const name = B.bWaitName(B.B_WAIT_COUNT - 1);
    await open(page, `/customer-banks?${q("bien cho kiem")}&status=pending&bank=${B.B_BANK1_ID}&page=2`);
    await expect(meta(page, NH, "dòng")).toHaveText("16 dòng");
    await expect(rows(page, NH)).toHaveCount(1);
    await card(page, NH).getByRole("link", { name, exact: true }).click();
    await page.waitForURL(new RegExp(B.bWaitId(B.B_WAIT_COUNT - 1)));
    const bank = card(page, B.B_BANK1);
    await bank.getByRole("button", { name: "Đạt", exact: true }).click();
    await page.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(bank.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);

    await page.goBack();
    await page.waitForURL(/page=2/);
    await page.waitForLoadState("networkidle");
    await expect(meta(page, NH, "dòng")).toHaveText("15 dòng");
    await expect(pager(page)).toContainText("1 / 1");
    await expect(rows(page, NH)).toHaveCount(15);
    await expect(card(page, NH).getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("phạm vi và rỗng: Nhân viên chỉ thấy dòng ngân hàng mình quản, không có mục lọc Ngân hàng; ngân hàng chưa có hồ sơ và tìm không khớp có câu báo riêng", async ({ browser }) => {
    const staff = await loginAs(browser, B.B_USER1);
    await open(staff, `/customer-banks?${q("bien")}`);
    const banks = await card(staff, NH).locator("tbody tr td:nth-child(2)").allTextContents();
    expect(banks.length).toBeGreaterThan(0);
    expect([...new Set(banks)]).toEqual([B.B_BANK1]);
    await staff.getByRole("button", { name: "Bộ lọc" }).click();
    await expect(staff.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Ngân hàng" })).toHaveCount(0);

    const empty = await loginAs(browser, B.B_USER3);
    await open(empty, "/customer-banks");
    await expect(empty.getByText("Chưa có học sinh chọn ngân hàng.")).toBeVisible();
    await open(empty, `/customer-banks?${q("bien")}`);
    await expect(empty.getByText("Không có dòng nào khớp bộ lọc.")).toBeVisible();
  });

  test("xuất Excel: đúng bộ lọc, không có dòng nào vẫn tải được, chuỗi bắt đầu bằng = + - @ là chữ", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    expect((await readExport(page, `/api/admin/customer-banks/export?${q("bien phan trang")}`)).rows.length - 3).toBe(17);
    const empty = await readExport(page, `/api/admin/customer-banks/export?${q("zz khong co ai bien")}`);
    expect([empty.rows.length, empty.rows[1][0]]).toEqual([3, "0"]);
    const sheet = await readExport(page, `/api/admin/customer-banks/export?${q("bien")}`);
    const [name, cls, parent] = ["HỌ TÊN", "LỚP", "PHỤ HUYNH"].map((h) => column(sheet, h));
    const row = sheet.rows.findIndex((r) => r[name] === "=1+2 BIEN CONG THUC");
    expect(row).toBeGreaterThan(2);
    expect([sheet.rows[row][cls], sheet.rows[row][parent], sheet.types[row][name], sheet.types[row][cls]]).toEqual(["=1+1", "+CHA BIEN CONG", ExcelJS.ValueType.String, ExcelJS.ValueType.String]);
    expect((await page.request.get("/api/admin/customer-banks/export?q=bien%00")).status()).toBe(200);
  });

  test("xuất Excel lọc trọn ngày giờ Việt Nam: ngày 31/10 chỉ ra dòng 23:30, NGÀY ghi 31/10/2026 23:30, KIỂM LÚC ghi 31/10/2026 23:45", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const [day, name, created, reviewed] of [
      ["2026-10-31", "BIEN GIO KHUYA", "31/10/2026 23:30", "31/10/2026 23:45"],
      ["2026-11-01", "BIEN GIO SOM", "01/11/2026 00:30", "01/11/2026 00:45"],
    ]) {
      const sheet = await readExport(page, `/api/admin/customer-banks/export?${q("bien gio")}&from=${day}&to=${day}`);
      const cols = ["HỌ TÊN", "NGÀY", "KIỂM LÚC"].map((h) => column(sheet, h));
      expect([day, sheet.rows.slice(3).map((r) => cols.map((c) => r[c]))]).toEqual([day, [[name, created, reviewed]]]);
    }
  });
});

test.describe("Trang 12 Mã voucher", () => {
  const VC = "Mã voucher";

  test("URL lạ không lỗi 500; tìm mã một phần chữ thường, họ tên không dấu, nhiều từ; 16 mã ra 15 và 1; tìm không khớp; khổ 390 không tràn ngang", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const raw of ["q=%00", "q=%25", "q=bien%00", "from=0001-01-01", "to=0000-01-01", "page=-1", "page=abc"]) expect([raw, await open(page, `/vouchers?${raw}`)]).toEqual([raw, 200]);

    await open(page, `/vouchers?${q("zzbien-bpt0")}`);
    await expect(meta(page, VC, "mã")).toHaveText("9 mã");
    await open(page, `/vouchers?${q("trang 07 bien")}`);
    await expect(meta(page, VC, "mã")).toHaveText("1 mã");
    await expect(rows(page, VC)).toContainText(B.bPageVoucher(7));
    await open(page, `/vouchers?${q("bpt07 phan trang")}`);
    await expect(meta(page, VC, "mã")).toHaveText("1 mã");
    await expect(rows(page, VC)).toContainText(B.bPageVoucher(7));
    await open(page, `/vouchers?${q("bien phan trang")}`);
    await expect(meta(page, VC, "mã")).toHaveText("16 mã");
    await expect(rows(page, VC)).toHaveCount(15);
    await pager(page).getByRole("link", { name: "Sau" }).click();
    await page.waitForURL(/page=2/);
    await expect(rows(page, VC)).toHaveCount(1);
    await expect(rows(page, VC)).toContainText(B.bPageVoucher(1));
    await open(page, `/vouchers?${q("zz khong co ai bien")}`);
    await expect(page.getByText("Không có mã khớp bộ lọc.")).toBeVisible();

    const phone = await loginAs(browser, "zz_e2e_admin", PHONE);
    await open(phone, `/vouchers?${q("bien")}`);
    expect(await pageOverflow(phone)).toBe(0);
  });

  test("ngày cấp 23:45 ngày 31/10 và 00:45 ngày 01/11 giờ Việt Nam hiện đúng, lọc ngày cấp trọn ngày", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const [day, code, shown] of [
      ["2026-10-31", B.B_LATE_VOUCHER, "31/10/2026 23:45"],
      ["2026-11-01", B.B_EARLY_VOUCHER, "01/11/2026 00:45"],
    ]) {
      await open(page, `/vouchers?${q("zzbien-bg")}&from=${day}&to=${day}`);
      await expect(rows(page, VC), day).toHaveCount(1);
      await expect(rows(page, VC), day).toContainText(code);
      await expect(rows(page, VC), day).toContainText(shown);
    }
  });

  test("xuất Excel lọc trọn ngày cấp giờ Việt Nam: ngày 31/10 chỉ ra mã 23:45, NGÀY CẤP ghi 31/10/2026 23:45; ngày 01/11 chỉ ra mã 00:45", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const [day, code, issued] of [
      ["2026-10-31", B.B_LATE_VOUCHER, "31/10/2026 23:45"],
      ["2026-11-01", B.B_EARLY_VOUCHER, "01/11/2026 00:45"],
    ]) {
      const sheet = await readExport(page, `/api/admin/vouchers/export?${q("zzbien-bg")}&from=${day}&to=${day}`);
      const cols = ["MÃ VOUCHER", "NGÀY CẤP"].map((h) => column(sheet, h));
      expect([day, sheet.rows.slice(3).map((r) => cols.map((c) => r[c]))]).toEqual([day, [[code, issued]]]);
    }
  });

  test("phân quyền: Nhân viên không có quyền voucher nhận 404 và 403; người có quyền voucher mà không thấy mọi hồ sơ thì tên không thành link", async ({ browser }) => {
    const staff = await loginAs(browser, B.B_USER1);
    expect(await open(staff, "/vouchers")).toBe(404);
    expect((await staff.request.get("/api/admin/vouchers")).status()).toBe(403);
    expect((await staff.request.get("/api/admin/vouchers/export")).status()).toBe(403);

    const reviewer = await loginAs(browser, "zz_e2e_reviewer");
    await open(reviewer, `/vouchers?${q("bien phan trang 07")}`);
    await expect(rows(reviewer, VC)).toContainText(B.bPageName(7));
    await expect(card(reviewer, VC).getByRole("link")).toHaveCount(0);
  });

  test("xuất Excel: đúng bộ lọc, không có dòng nào vẫn tải được, tên, lớp, phụ huynh bắt đầu bằng = + - @ là chữ, từ khoá có NUL không lỗi", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    const sheet = await readExport(page, `/api/admin/vouchers/export?${q("bien phan trang")}`);
    expect(sheet.rows.length - 3).toBe(16);
    expect(sheet.types[3][column(sheet, "MÃ VOUCHER")]).toBe(ExcelJS.ValueType.String);
    const empty = await readExport(page, `/api/admin/vouchers/export?${q("zz khong co ai bien")}`);
    expect([empty.rows.length, empty.rows[1][0]]).toEqual([3, "0"]);

    const all = await readExport(page, `/api/admin/vouchers/export?${q("bien")}`);
    const [code, name, cls, parent] = ["MÃ VOUCHER", "HỌ TÊN", "LỚP", "PHỤ HUYNH"].map((h) => column(all, h));
    const cell = (row: number, col: number) => ({ value: all.rows[row][col], type: all.types[row][col] });
    const text = ExcelJS.ValueType.String;
    const formula = all.rows.findIndex((r) => r[code] === B.B_FORMULA_VOUCHER);
    const minus = all.rows.findIndex((r) => r[code] === B.B_MINUS_VOUCHER);
    expect([formula > 2, minus > 2]).toEqual([true, true]);
    expect([cell(formula, name), cell(formula, cls), cell(formula, parent), cell(minus, name), cell(minus, parent)]).toEqual([
      { value: "=1+2 BIEN CONG THUC", type: text },
      { value: "=1+1", type: text },
      { value: "+CHA BIEN CONG", type: text },
      { value: "-BIEN TRU", type: text },
      { value: "@ME BIEN CONG", type: text },
    ]);
    expect((await page.request.get("/api/admin/vouchers/export?q=bien%00")).status()).toBe(200);
  });
});

test.describe("Tin SMS lỗi", () => {
  const SMS = "Tin SMS";
  const resendDialog = (page: Page) => page.getByRole("dialog", { name: "Gửi lại tin SMS" });

  test("URL lạ không lỗi 500, trạng thái lạ về Lỗi; tìm nhiều từ, SĐT có dấu cách; 16 tin ra 15 và 1; Gửi lại dòng cuối của trang cuối thì về trang còn dòng", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    for (const raw of ["q=%00", "q=bien%00", "status=foo", "page=999", "page=-1"]) expect([raw, await open(page, `/sms?${q("bien")}&${raw}`)]).toEqual([raw, 200]);
    await open(page, "/sms?status=foo");
    await expect(page.getByText("Trạng thái: Lỗi")).toBeVisible();

    await open(page, `/sms?${q("trang 07 bien")}`);
    await expect(meta(page, SMS, "tin")).toHaveText("1 tin");
    await open(page, `/sms?${q("0988 000 307")}`);
    await expect(meta(page, SMS, "tin")).toHaveText("1 tin");

    await open(page, `/sms?${q("bien phan trang")}`);
    await expect(meta(page, SMS, "tin")).toHaveText("16 tin");
    await expect(rows(page, SMS)).toHaveCount(15);
    await pager(page).getByRole("link", { name: "Sau" }).click();
    await page.waitForURL(/page=2/);
    await page.waitForLoadState("networkidle");
    await expect(rows(page, SMS)).toHaveCount(1);
    await page.getByRole("button", { name: `Gửi lại tin cho ${B.bPageName(1)}` }).click();
    await resendDialog(page).getByRole("button", { name: "Gửi lại" }).click();
    await expect(resendDialog(page)).toHaveCount(0);
    await expect(meta(page, SMS, "tin")).toHaveText("15 tin");
    await expect(rows(page, SMS)).toHaveCount(15);
    await expect(pager(page)).toContainText("1 / 1");

    const phone = await loginAs(browser, "zz_e2e_admin", PHONE);
    await open(phone, `/sms?${q("bien")}`);
    expect(await pageOverflow(phone)).toBe(0);
    await phone.getByRole("button", { name: `Gửi lại tin cho ${B.B_NAMES.resend}` }).click();
    expect([await insideViewport(resendDialog(phone)), await insideViewport(resendDialog(phone).getByRole("button", { name: "Gửi lại" }))]).toEqual([true, true]);
  });

  test("tin có cột Lỗi 500 ký tự liền ở 1366 và 390 px: trang không cuộn ngang, chi tiết hồ sơ cũng không", async ({ browser }) => {
    for (const device of [DESKTOP, PHONE]) {
      const page = await loginAs(browser, "zz_e2e_admin", device);
      await open(page, `/sms?${q(B.B_NAMES.longError)}`);
      await expect(rows(page, SMS)).toContainText(B.B_LONG_SMS_ERROR);
      expect([device.viewport.width, "sms", await pageOverflow(page)]).toEqual([device.viewport.width, "sms", 0]);
      await open(page, `/customers/${B.B_IDS.longError}`);
      await expect(card(page, "SMS cho phụ huynh")).toContainText(B.B_LONG_SMS_ERROR);
      expect([device.viewport.width, "chi tiết", await pageOverflow(page)]).toEqual([device.viewport.width, "chi tiết", 0]);
    }
  });

  test("Gửi lại: SĐT trống, sai dạng báo ở ô; Huỷ rồi mở lại hiện SĐT đang lưu; Enter gửi, SĐT có dấu cách được chuẩn hoá", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    await open(page, `/sms?${q(B.B_NAMES.resend)}`);
    const openResend = () => page.getByRole("button", { name: `Gửi lại tin cho ${B.B_NAMES.resend}` }).click();
    const box = resendDialog(page).getByLabel("SĐT nhận");
    await openResend();
    for (const value of ["", "   ", "12345", "+84977123456", "0977-123-456"]) {
      await box.fill(value);
      await resendDialog(page).getByRole("button", { name: "Gửi lại" }).click();
      await expect(resendDialog(page).getByText("SĐT phải có 10 số, bắt đầu bằng 0."), value).toBeVisible();
      await expect(box, value).toHaveAttribute("aria-invalid", "true");
    }
    await box.fill("0911 000 000");
    await resendDialog(page).getByRole("button", { name: "Huỷ" }).click();
    await openResend();
    await expect(box).toHaveValue(B.bParentPhone(218));
    await expect(box).not.toHaveAttribute("aria-invalid", "true");
    await box.fill("0977 123 456");
    await box.press("Enter");
    await expect(resendDialog(page)).toHaveCount(0);
    await open(page, `/sms?${q(B.B_NAMES.resend)}&status=all`);
    await expect(rows(page, SMS)).toContainText("0977 123 456");
    await expect(rows(page, SMS)).toContainText("Đang gửi");
    await expect(rows(page, SMS)).toContainText("0/3");
  });

  test("đang Gửi lại thì Huỷ bị khoá, không có nút Đóng, nhấn Esc 4 lần không đóng hộp; máy chủ trả lời xong thì hộp đóng", async ({ browser }) => {
    const page = await loginAs(browser, "zz_e2e_admin");
    await open(page, `/sms?${q(B.bPageName(2))}`);
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Máy chủ giả trả 204 nên tin vẫn ở trạng thái Lỗi.
    await page.route("**/api/admin/sms/*/resend", async (route) => {
      await gate;
      await route.fulfill({ status: 204 });
    });
    await page.getByRole("button", { name: `Gửi lại tin cho ${B.bPageName(2)}` }).click();
    const dialog = resendDialog(page);
    await dialog.getByRole("button", { name: "Gửi lại" }).click();
    await expect(dialog.getByRole("button", { name: "Gửi lại" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Huỷ" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Đóng" })).toHaveCount(0);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");
    await expect(dialog, "sau Esc").toBeVisible();
    release();
    await expect(dialog).toHaveCount(0);
  });

  test("hai tab cùng Gửi lại một tin: tab sau báo tin không còn lỗi ở dòng báo chung, ô SĐT không bị đánh dấu sai; đóng hộp thì bảng tải lại, dòng Lỗi cũ mất; mất mạng thì đóng hộp không tải lại trang", async ({ browser }) => {
    const a = await loginAs(browser, "zz_e2e_admin");
    const b = await loginAs(browser, "zz_e2e_admin");
    for (const page of [a, b]) {
      await open(page, `/sms?${q(B.B_NAMES.resendTabs)}`);
      await page.getByRole("button", { name: `Gửi lại tin cho ${B.B_NAMES.resendTabs}` }).click();
    }
    await resendDialog(a).getByRole("button", { name: "Gửi lại" }).click();
    await expect(resendDialog(a)).toHaveCount(0);
    await resendDialog(b).getByRole("button", { name: "Gửi lại" }).click();
    await expect(resendDialog(b).getByRole("alert")).toHaveText("Tin này không ở trạng thái lỗi.");
    await expect(resendDialog(b).getByLabel("SĐT nhận")).not.toHaveAttribute("aria-invalid", "true");
    await resendDialog(b).getByRole("button", { name: "Huỷ" }).click();
    await expect(resendDialog(b)).toHaveCount(0);
    await expect(b.getByText("Không có tin khớp bộ lọc.")).toBeVisible();

    // Tải lại trang lúc mất mạng là ra trang báo lỗi của trình duyệt: chỉ tải lại khi máy chủ đã trả lời.
    await open(a, `/sms?${q(B.bPageName(3))}`);
    await a.context().setOffline(true);
    await a.getByRole("button", { name: `Gửi lại tin cho ${B.bPageName(3)}` }).click();
    await resendDialog(a).getByRole("button", { name: "Gửi lại" }).click();
    await expect(resendDialog(a).getByRole("alert")).toHaveText("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    await resendDialog(a).getByRole("button", { name: "Huỷ" }).click();
    await expect(resendDialog(a)).toHaveCount(0);
    await expect(a.getByRole("button", { name: `Gửi lại tin cho ${B.bPageName(3)}` })).toBeVisible();
    await a.context().setOffline(false);
  });

  test("phạm vi và rỗng: Nhân viên không thấy và không Gửi lại được tin ngoài phạm vi; ngân hàng chưa có hồ sơ báo không có tin lỗi; lọc Đã gửi không khớp báo không có tin khớp bộ lọc", async ({ browser }) => {
    const admin = await loginAs(browser, "zz_e2e_admin");
    await open(admin, `/sms?${q(B.B_NAMES.only2)}`);
    // Id của tin không có trên trang: bắt request Gửi lại của Quản trị rồi huỷ, không gửi thật.
    let url = "";
    await admin.route("**/api/admin/sms/*/resend", (route) => {
      url = route.request().url();
      return route.abort();
    });
    await admin.getByRole("button", { name: `Gửi lại tin cho ${B.B_NAMES.only2}` }).click();
    await resendDialog(admin).getByRole("button", { name: "Gửi lại" }).click();
    await expect.poll(() => url).toMatch(/\/api\/admin\/sms\/[0-9a-f-]{36}\/resend$/);

    const staff = await loginAs(browser, B.B_USER1);
    await open(staff, `/sms?${q("bien")}`);
    await expect(card(staff, SMS).getByRole("link", { name: B.B_NAMES.only2 })).toHaveCount(0);
    expect((await staff.request.post(url, { headers: { Origin: ADMIN }, data: { toPhone: "0977123456" } })).status()).toBe(404);

    const empty = await loginAs(browser, B.B_USER3);
    await open(empty, "/sms");
    await expect(empty.getByText("Không có tin lỗi.")).toBeVisible();
    await open(empty, "/sms?status=sent");
    await expect(empty.getByText("Không có tin khớp bộ lọc.")).toBeVisible();
    await open(empty, "/sms?status=all");
    await expect(empty.getByText("Chưa có tin nào.")).toBeVisible();
  });
});
