import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import * as B from "../scripts/e2e-data-business";
import { ADMIN, closeContexts, DESKTOP, insideViewport, loginAs, open, overflowOf, pageOverflow, PHONE } from "./edge-business-support";

const PHOTO = "public/brand/photo.jpg";
const detail = (id: string) => `/customers/${id}`;
const bank1 = (page: Page) => page.getByRole("region", { name: B.B_BANK1, exact: true });
const bank2 = (page: Page) => page.getByRole("region", { name: B.B_BANK2, exact: true });
const TAKEN = "Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới.";

test.afterEach(closeContexts);

async function bankRowId(page: Page, customerId: string, bankName: string): Promise<string> {
  const res = await page.request.get(`/api/admin/customers/${customerId}`);
  expect(res.status()).toBe(200);
  return (await res.json()).banks.find((b: { name: string }) => b.name === bankName).id;
}

// Số mã voucher của đúng một hồ sơ: tên link khớp nguyên văn, "Biên Hai Tab" không lẫn với "Biên Gửi Hai Tab".
async function voucherCount(page: Page, name: string) {
  await open(page, `/vouchers?q=${encodeURIComponent(name)}`);
  return page.getByRole("region", { name: "Mã voucher" }).locator("tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) }).count();
}

async function markPassed(page: Page) {
  await bank1(page).getByRole("button", { name: "Đạt", exact: true }).click();
  await page.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(bank1(page).getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);
}

test("Trang 4: tên 100 ký tự, tên liền, ghi chú 1.000 ký tự liền ở 1366 và 390 px không tràn ngang, nút và hộp thoại nằm trọn trong màn hình", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const device of [DESKTOP, PHONE]) {
    const page = await loginAs(browser, "zz_e2e_admin", device);
    const width = device.viewport.width;
    for (const id of [B.B_IDS.long, B.B_IDS.unbroken]) {
      await open(page, detail(id));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(id === B.B_IDS.long ? B.B_LONG_NAME : B.B_UNBROKEN_NAME);
      expect([width, id, await pageOverflow(page)]).toEqual([width, id, 0]);
      for (const card of [page.getByRole("region", { name: "Thông tin" }), bank1(page)]) expect([width, id, await overflowOf(card)]).toEqual([width, id, 0]);
      const buttons = [page.getByRole("button", { name: "Sửa thông tin" }), bank1(page).getByRole("button", { name: "Đạt", exact: true }), bank1(page).getByRole("button", { name: "Không đạt" }), bank1(page).getByRole("button", { name: "Tải ảnh thay thế" }), bank1(page).getByRole("button", { name: /^Sửa ghi chú/ })];
      for (const button of buttons) {
        await button.scrollIntoViewIfNeeded();
        expect([width, id, await button.textContent(), await insideViewport(button)]).toEqual([width, id, await button.textContent(), true]);
      }
      if (id === B.B_IDS.unbroken) await expect(bank1(page).getByText(B.B_UNBROKEN_NOTE)).toBeVisible();

      const dialogs: [() => Promise<void>, string, string][] = [
        [() => bank1(page).getByRole("button", { name: "Đạt", exact: true }).click(), "Đánh dấu Đạt", "Đạt"],
        [() => bank1(page).getByRole("button", { name: /^Sửa ghi chú/ }).click(), "Ghi chú nội bộ", "Lưu"],
        [() => page.getByRole("button", { name: "Sửa thông tin" }).click(), "Sửa thông tin", "Lưu"],
      ];
      for (const [openDialog, title, submit] of dialogs) {
        await openDialog();
        const dialog = page.getByRole("dialog", { name: title });
        await expect(dialog).toBeVisible();
        expect([width, title, await insideViewport(dialog), await overflowOf(dialog)]).toEqual([width, title, true, 0]);
        const button = dialog.getByRole("button", { name: submit, exact: true });
        await button.scrollIntoViewIfNeeded();
        expect([width, title, await insideViewport(button)]).toEqual([width, title, true]);
        await dialog.getByRole("button", { name: "Huỷ" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
    }
    await page.context().close();
  }
});

test("Trang 4: tên có <script>, phụ huynh có <img onerror>, ghi chú có thẻ HTML, xuống dòng, emoji hiện nguyên văn dạng chữ", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const alerts: string[] = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await open(page, detail(B.B_IDS.xss));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(B.B_XSS);
  await expect(page.getByRole("region", { name: "Thông tin" }).getByText(B.B_IMG, { exact: true })).toBeVisible();
  const note = bank1(page).getByRole("region", { name: "Ghi chú nội bộ" }).locator("p");
  expect(await note.evaluate((el) => (el as HTMLElement).innerText)).toBe("<b>đậm</b>\nDòng hai 😀");
  expect(await note.locator("b").count()).toBe(0);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(alerts).toEqual([]);
});

test("Trang 4 URL sai: id không phải uuid, uuid không có trả 404 ở trang, API hồ sơ và route ảnh", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const missing = randomUUID();
  for (const id of ["abc", missing, `${missing}x`, "%00"]) expect([id, await open(page, detail(id))]).toEqual([id, 404]);
  const headers = { Origin: ADMIN };
  for (const id of ["abc", missing]) {
    expect((await page.request.get(`/api/admin/customers/${id}`)).status()).toBe(404);
    expect((await page.request.patch(`/api/admin/customers/${id}`, { headers, data: { fullName: "A", className: "1", phone: "0911111111", parentName: "B", parentPhone: "0922222222" } })).status()).toBe(404);
    expect((await page.request.get(`/api/admin/photos/${id}`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await page.request.post(`/api/admin/customer-banks/${id}/review`, { headers, data: { result: "passed", expected: "pending" } })).status()).toBe(404);
    expect((await page.request.put(`/api/admin/customer-banks/${id}/note`, { headers, data: { note: "x" } })).status()).toBe(404);
  }
});

test("Trang 4 Sửa thông tin: ô trống, chỉ khoảng trắng, quá dài, SĐT sai dạng, SĐT trùng báo ở đúng ô; Huỷ rồi mở lại hiện dữ liệu đã lưu; Enter gửi form; bấm Lưu hai lần chỉ gửi một request", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, detail(B.B_IDS.form));
  const dialog = page.getByRole("dialog", { name: "Sửa thông tin" });
  const field = (label: string) => dialog.getByLabel(label, { exact: true });
  const save = dialog.getByRole("button", { name: "Lưu" });
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  for (const [label, value, message] of [
    ["Họ tên", "", "Nhập họ và tên"],
    ["Họ tên", "     ", "Nhập họ và tên"],
    ["Họ tên", "a".repeat(101), "Tối đa 100 ký tự"],
    ["Lớp", "", "Nhập lớp"],
    ["Lớp", "1".repeat(21), "Tối đa 20 ký tự"],
    ["Phụ huynh", "  ", "Nhập họ và tên phụ huynh"],
    ["SĐT", "+84912345678", "SĐT phải có 10 số, bắt đầu bằng 0."],
    ["SĐT", "091234567", "SĐT phải có 10 số, bắt đầu bằng 0."],
    ["SĐT", "09123abc56", "SĐT phải có 10 số, bắt đầu bằng 0."],
    ["SĐT phụ huynh", "", "SĐT phải có 10 số, bắt đầu bằng 0."],
  ]) {
    await page.getByRole("button", { name: "Huỷ" }).click();
    await page.getByRole("button", { name: "Sửa thông tin" }).click();
    await field(label).fill(value);
    await save.click();
    await expect(field(label), `${label} "${value.slice(0, 12)}"`).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText(message, { exact: true })).toBeVisible();
    expect(await dialog.locator('[aria-invalid="true"]').count()).toBe(1);
  }

  await page.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await field("SĐT").fill(B.bParentPhone(217));
  await save.click();
  await expect(field("SĐT phụ huynh")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("SĐT phụ huynh phải khác SĐT học sinh.")).toBeVisible();

  await field("Họ tên").fill("Chữ gõ dở");
  await dialog.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await expect(field("Họ tên")).toHaveValue(B.B_NAMES.form);
  await expect(field("SĐT")).toHaveValue(B.bPhone(217));
  await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);

  const patches: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH" && r.url().endsWith(`/api/admin/customers/${B.B_IDS.form}`)) patches.push(r.url());
  });
  await field("Họ tên").fill("  Biên   Sửa    Form   Mới  ");
  await field("Lớp").fill("12 a1");
  await field("SĐT").fill("0912 345 678");
  await field("Họ tên").press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Biên Sửa Form Mới");
  const info = page.getByRole("region", { name: "Thông tin" });
  await expect(info).toContainText("12A1");
  await expect(info).toContainText("0912 345 678");
  expect(patches.length).toBe(1);

  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await expect(field("Họ tên")).toHaveValue("Biên Sửa Form Mới");
  await field("Họ tên").fill("Biên Sửa Form Hai");
  await save.dblclick();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Biên Sửa Form Hai");
  expect(patches.length).toBe(2);
});

test("Trang 4 ghi chú: ô nhập chặn ở 1.000 ký tự, API từ chối 1.001 ký tự và ký tự điều khiển, cắt khoảng trắng đầu cuối; hai tab cùng sửa thì người lưu sau ghi đè; mất mạng báo ở dòng báo chung", async ({ browser }) => {
  const a = await loginAs(browser, "zz_e2e_admin");
  const b = await loginAs(browser, "zz_e2e_admin");
  await open(a, detail(B.B_IDS.note));
  await open(b, detail(B.B_IDS.note));
  const rowId = await bankRowId(a, B.B_IDS.note, B.B_BANK1);
  const put = (note: string) => a.request.put(`/api/admin/customer-banks/${rowId}/note`, { headers: { Origin: ADMIN }, data: { note } });

  let res = await put("x".repeat(1001));
  expect([res.status(), (await res.json()).message]).toEqual([400, "Ghi chú tối đa 1000 ký tự"]);
  res = await put("có \u0001 ký tự điều khiển");
  expect([res.status(), (await res.json()).message]).toEqual([400, "Có ký tự không hợp lệ"]);
  expect((await put("   cắt hai đầu   ")).status()).toBe(204);
  expect((await (await a.request.get(`/api/admin/customers/${B.B_IDS.note}`)).json()).banks[0].note).toBe("cắt hai đầu");

  await a.reload();
  await bank1(a).getByRole("button", { name: /^Sửa ghi chú/ }).click();
  const box = a.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("textbox");
  await box.fill("");
  await box.focus();
  await a.keyboard.insertText("Ghi chú dài ".repeat(100));
  expect((await box.inputValue()).length).toBe(1000);
  await a.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("button", { name: "Lưu" }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await expect(bank1(a).getByRole("region", { name: "Ghi chú nội bộ" }).locator("p")).toHaveText(("Ghi chú dài ".repeat(100)).slice(0, 1000).trim());

  await bank1(a).getByRole("button", { name: /^Sửa ghi chú/ }).click();
  await bank1(b).getByRole("button", { name: /^Sửa ghi chú/ }).click();
  await a.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("textbox").fill("Ghi chú của tab A");
  await b.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("textbox").fill("Ghi chú của tab B");
  await a.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("button", { name: "Lưu" }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await b.getByRole("dialog", { name: "Ghi chú nội bộ" }).getByRole("button", { name: "Lưu" }).click();
  await expect(b.getByRole("dialog")).toHaveCount(0);
  await a.reload();
  await expect(bank1(a).getByRole("region", { name: "Ghi chú nội bộ" }).locator("p")).toHaveText("Ghi chú của tab B");

  const noteUrl = "**/api/admin/customer-banks/*/note";
  await a.route(noteUrl, (route) => route.abort());
  await bank1(a).getByRole("button", { name: /^Sửa ghi chú/ }).click();
  const note = a.getByRole("dialog", { name: "Ghi chú nội bộ" });
  await note.getByRole("textbox").fill("Ghi chú lúc mất mạng");
  await note.getByRole("button", { name: "Lưu" }).click();
  await expect(note.getByRole("alert")).toHaveText("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  await expect(note.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
  await a.unroute(noteUrl);
  await note.getByRole("button", { name: "Lưu" }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await expect(bank1(a).getByRole("region", { name: "Ghi chú nội bộ" }).locator("p")).toHaveText("Ghi chú lúc mất mạng");
});

// Giữ request lại tới khi test cho đi; máy chủ giả trả 204 nên dữ liệu không đổi.
async function hold(page: Page, url: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await gate;
    await route.fulfill({ status: 204 });
  });
  return release;
}

test("Trang 4: đang tải ảnh thay thế hay đang lưu ghi chú thì Huỷ bị khoá, Esc và nút Đóng không đóng hộp; máy chủ trả lời xong thì hộp đóng", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await open(page, detail(B.B_IDS.note));
  for (const [url, button, title, fill, submit, busy] of [
    ["**/photos", "Tải ảnh thay thế", "Tải ảnh thay thế", (d: Locator) => d.getByLabel("Ảnh", { exact: true }).setInputFiles(PHOTO), "Tải lên", "Đang tải ảnh"],
    ["**/note", /^Sửa ghi chú/, "Ghi chú nội bộ", (d: Locator) => d.getByRole("textbox").fill("Ghi chú lúc mạng chậm"), "Lưu", "Lưu"],
  ] as const) {
    const release = await hold(page, url);
    await bank1(page).getByRole("button", { name: button }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await fill(dialog);
    await dialog.getByRole("button", { name: submit, exact: true }).click();
    await expect(dialog.getByRole("button", { name: busy, exact: true }), title).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Huỷ" }), title).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog, `${title} sau Esc`).toBeVisible();
    await dialog.getByRole("button", { name: "Đóng" }).click({ timeout: 5_000 });
    await expect(dialog, `${title} sau nút Đóng`).toBeVisible();
    release();
    await expect(page.getByRole("dialog"), title).toHaveCount(0);
    await page.unroute(url);
  }
});

test("Trang 4 tải ảnh thay thế: không chọn file, file 0 byte, file chữ đổi đuôi .jpg, file 21 MB, 23 MB báo dưới ô Ảnh, file trên 20 MB không gửi lên máy chủ; Nginx trả 413 cũng báo dưới ô Ảnh; mất mạng báo ở dòng báo chung; chọn lại đúng ảnh đang chọn thì hộp thoại không đóng; tab khác vừa đánh dấu Đạt thì báo không thay được", async ({ browser }) => {
  const a = await loginAs(browser, B.B_USER1);
  const b = await loginAs(browser, B.B_USER1);
  await open(b, detail(B.B_IDS.replace));
  await b.getByRole("button", { name: "Tải ảnh thay thế" }).click();
  const dialog = b.getByRole("dialog", { name: "Tải ảnh thay thế" });
  const file = dialog.getByLabel("Ảnh", { exact: true });
  const upload = dialog.getByRole("button", { name: "Tải lên" });
  const posts: string[] = [];
  b.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/photos")) posts.push(r.url());
  });
  const big = (mb: number) => Buffer.concat([readFileSync(PHOTO), Buffer.alloc(mb * 1024 * 1024)]);
  for (const [label, input, message, sent] of [
    ["không chọn", null, "Chọn ảnh.", 0],
    ["0 byte", { name: "rong.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) }, "Chọn ảnh.", 0],
    ["chữ đổi đuôi", { name: "chu.jpg", mimeType: "image/jpeg", buffer: Buffer.from("đây không phải ảnh") }, "Chỉ nhận ảnh jpg, png, webp hoặc heic.", 1],
    ["21 MB", { name: "lon.jpg", mimeType: "image/jpeg", buffer: big(21) }, "Ảnh lớn hơn 20 MB.", 0],
    ["23 MB", { name: "lon.jpg", mimeType: "image/jpeg", buffer: big(23) }, "Ảnh lớn hơn 20 MB.", 0],
  ] as const) {
    const before = posts.length;
    await file.setInputFiles(input ? [input] : []);
    await upload.click();
    await expect(dialog.getByText(message, { exact: true }), label).toBeVisible({ timeout: 30_000 });
    await expect(file, label).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();
    expect([label, posts.length - before]).toEqual([label, sent]);
  }

  // Máy chủ vẫn là chốt thật: gọi thẳng API với file lớn thì nhận 400 gắn ô Ảnh, 23 MB bị chặn theo Content-Length.
  const row = (await (await b.request.get(`/api/admin/customers/${B.B_IDS.replace}`)).json()).banks.find((x: { name: string }) => x.name === B.B_BANK1);
  for (const mb of [21, 23]) {
    const res = await b.request.post(`/api/admin/customer-banks/${row.id}/photos`, { headers: { Origin: ADMIN }, multipart: { slotId: row.slots[0].id, file: { name: "lon.jpg", mimeType: "image/jpeg", buffer: big(mb) } } });
    expect([mb, res.status(), await res.json()]).toEqual([mb, 400, { message: "Ảnh lớn hơn 20 MB.", field: "file" }]);
  }

  await b.route("**/photos", (route) => route.abort());
  await file.setInputFiles(PHOTO);
  await upload.click();
  await expect(dialog.getByRole("alert")).toHaveText("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  await expect(file).not.toHaveAttribute("aria-invalid", "true");
  await b.unroute("**/photos");

  // Production có Nginx đứng trước: request quá client_max_body_size bị trả trang HTML 413, không vào tới app.
  await b.route("**/photos", (route) => route.fulfill({ status: 413, contentType: "text/html", body: "<html><body><center><h1>413 Request Entity Too Large</h1></center></body></html>" }));
  await upload.click();
  await expect(dialog.getByText("Ảnh lớn hơn 20 MB.", { exact: true })).toBeVisible();
  await expect(file).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await b.unroute("**/photos");

  await open(a, detail(B.B_IDS.replace));
  await markPassed(a);
  await file.setInputFiles(PHOTO);
  await expect(dialog, "chọn lại đúng ảnh đang chọn").toBeVisible();
  await upload.click();
  await expect(dialog.getByRole("alert")).toHaveText("Ngân hàng đã Đạt, không thay được ảnh.", { timeout: 30_000 });
});

test("Trang 4 hai tab: tab A đánh dấu Đạt, tab B bấm Đạt hay Không đạt đều báo đã có người đánh dấu; tab B đang sửa thông tin thì báo hồ sơ đã có voucher", async ({ browser }) => {
  const a = await loginAs(browser, B.B_USER1);
  const b = await loginAs(browser, "zz_e2e_admin");
  await open(a, detail(B.B_IDS.twoTabs));
  await open(b, detail(B.B_IDS.twoTabs));
  await markPassed(a);
  await expect(a.getByRole("region", { name: "SMS cho phụ huynh" }).locator("dd").first()).toHaveText(/^ZZE2E/);

  for (const [button, title] of [
    ["Đạt", "Đánh dấu Đạt"],
    ["Không đạt", "Đánh dấu Không đạt"],
  ]) {
    await bank1(b).getByRole("button", { name: button, exact: true }).click();
    const dialog = b.getByRole("dialog", { name: title });
    await dialog.getByRole("button", { name: button, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(TAKEN);
    await dialog.getByRole("button", { name: "Huỷ" }).click();
  }
  await b.reload();
  await expect(bank1(b).getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);
  await expect(bank1(b).locator("header")).toContainText("Đạt");

  await open(a, detail(B.B_IDS.editTabs));
  await open(b, detail(B.B_IDS.editTabs));
  await b.getByRole("button", { name: "Sửa thông tin" }).click();
  await markPassed(a);
  const edit = b.getByRole("dialog", { name: "Sửa thông tin" });
  await edit.getByLabel("Họ tên", { exact: true }).fill("Biên Sửa Hai Tab Mới");
  await edit.getByRole("button", { name: "Lưu" }).click();
  await expect(edit.getByRole("alert")).toHaveText("Hồ sơ đã có voucher, không sửa được thông tin.");
  await expect(edit.locator('[aria-invalid="true"]')).toHaveCount(0);
  await b.reload();
  await expect(b.getByRole("heading", { level: 1 })).toHaveText(B.B_NAMES.editTabs);
  await expect(b.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);
});

test("Trang 4 hai tab: tab A tải ảnh thay thế, tab B đang mở trang cũ bấm Đạt thì báo ảnh vừa được thay, không cấp voucher; tải lại trang thì thấy ảnh mới, Đạt được và cấp đúng 1 voucher", async ({ browser }) => {
  const a = await loginAs(browser, B.B_USER1);
  const b = await loginAs(browser, "zz_e2e_admin");
  await open(a, detail(B.B_IDS.oldPhoto));
  await open(b, detail(B.B_IDS.oldPhoto));
  await expect(bank1(b).getByRole("img")).toHaveCount(0);

  await bank1(a).getByRole("button", { name: "Tải ảnh thay thế" }).click();
  const replace = a.getByRole("dialog", { name: "Tải ảnh thay thế" });
  await replace.getByLabel("Ảnh", { exact: true }).setInputFiles(PHOTO);
  await replace.getByRole("button", { name: "Tải lên" }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  await expect(bank1(a).getByRole("img")).toHaveCount(1);

  await bank1(b).getByRole("button", { name: "Đạt", exact: true }).click();
  const confirm = b.getByRole("dialog", { name: "Đánh dấu Đạt" });
  await confirm.getByRole("button", { name: "Đạt", exact: true }).click();
  await expect(confirm.getByRole("alert")).toHaveText("Ảnh vừa được thay. Tải lại trang để xem ảnh mới.");
  await confirm.getByRole("button", { name: "Huỷ" }).click();
  expect(await voucherCount(b, B.B_NAMES.oldPhoto)).toBe(0);

  await open(b, detail(B.B_IDS.oldPhoto));
  await expect(bank1(b).getByRole("img")).toHaveCount(1);
  await markPassed(b);
  expect(await voucherCount(b, B.B_NAMES.oldPhoto)).toBe(1);
});

test("Trang 4 phân quyền: Nhân viên mở hồ sơ ngoài phạm vi và gọi mọi API của dòng ngoài phạm vi nhận 404; thẻ ngân hàng không quản không có ảnh và nút; request ghi thiếu Origin nhận 403", async ({ browser }) => {
  const admin = await loginAs(browser, "zz_e2e_admin");
  const staff = await loginAs(browser, B.B_USER1);
  const only2Row = await bankRowId(admin, B.B_IDS.only2, B.B_BANK2);
  const headers = { Origin: ADMIN };

  expect(await open(staff, detail(B.B_IDS.only2))).toBe(404);
  expect(await open(staff, detail(B.B_IDS.none))).toBe(404);
  expect((await staff.request.get(`/api/admin/customers/${B.B_IDS.only2}`)).status()).toBe(404);
  expect((await staff.request.patch(`/api/admin/customers/${B.B_IDS.only2}`, { headers, data: { fullName: "Đổi Tên", className: "10A1", phone: B.bPhone(208), parentName: "A", parentPhone: B.bParentPhone(208) } })).status()).toBe(404);
  expect((await staff.request.post(`/api/admin/customer-banks/${only2Row}/review`, { headers, data: { result: "passed", expected: "pending" } })).status()).toBe(404);
  expect((await staff.request.put(`/api/admin/customer-banks/${only2Row}/note`, { headers, data: { note: "x" } })).status()).toBe(404);
  expect((await staff.request.post(`/api/admin/customer-banks/${only2Row}/photos`, { headers, multipart: { slotId: randomUUID(), file: { name: "a.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO) } } })).status()).toBe(404);

  await open(admin, detail(B.B_IDS.both));
  const otherPhoto = await bank2(admin).getByRole("img").first().getAttribute("src");
  expect(otherPhoto).toMatch(/^\/api\/admin\/photos\//);
  expect((await admin.request.get(otherPhoto!, { maxRedirects: 0 })).status()).toBe(302);

  await open(staff, detail(B.B_IDS.both));
  await expect(bank1(staff).getByRole("img")).toHaveCount(1);
  await expect(bank2(staff).getByRole("img")).toHaveCount(0);
  await expect(bank2(staff).getByRole("button")).toHaveCount(0);
  await expect(bank2(staff).getByText("Ghi chú nội bộ")).toHaveCount(0);
  expect((await staff.request.get(otherPhoto!, { maxRedirects: 0 })).status()).toBe(404);

  const bothRow = await bankRowId(staff, B.B_IDS.both, B.B_BANK1);
  for (const origin of [undefined, "http://bank.localhost:3100", "https://evil.example"]) {
    const h = origin ? { Origin: origin } : undefined;
    expect([origin, (await staff.request.post(`/api/admin/customer-banks/${bothRow}/review`, { headers: h, data: { result: "failed", expected: "pending" } })).status()]).toEqual([origin, 403]);
    expect([origin, (await staff.request.put(`/api/admin/customer-banks/${bothRow}/note`, { headers: h, data: { note: "x" } })).status()]).toEqual([origin, 403]);
    expect([origin, (await staff.request.patch(`/api/admin/customers/${B.B_IDS.both}`, { headers: h, data: {} })).status()]).toEqual([origin, 403]);
  }
  await staff.reload();
  await expect(bank1(staff).getByRole("button", { name: "Không đạt" })).toBeVisible();
});

test("Trang 4 rỗng và giờ: hồ sơ chưa chọn ngân hàng chỉ có thẻ Thông tin và SMS; chưa có ảnh, chưa có ghi chú; voucher cấp 23:45 ngày 31/10 giờ Việt Nam; hồ sơ trùng tên và SĐT có link sang nhau", async ({ browser }) => {
  for (const device of [DESKTOP, PHONE]) {
    const page = await loginAs(browser, "zz_e2e_admin", device);
    await open(page, detail(B.B_IDS.none));
    await expect(page.getByRole("main").getByRole("region")).toHaveCount(2);
    await expect(page.getByRole("region", { name: "SMS cho phụ huynh" })).toContainText("Chưa gửi");

    await open(page, detail(B.B_IDS.long));
    await expect(bank1(page).getByText("Chưa có ảnh")).toBeVisible();
    await expect(bank1(page).getByText("Chưa có ghi chú")).toBeVisible();

    await open(page, detail(B.B_IDS.late));
    const sms = page.getByRole("region", { name: "SMS cho phụ huynh" });
    await expect(sms).toContainText(B.B_LATE_VOUCHER);
    await expect(sms).toContainText("31/10/2026 23:45");
    await expect(sms).toContainText("31/10/2026 23:50");

    await open(page, detail(B.B_IDS.dup1));
    await page.getByRole("link", { name: `${B.B_NAMES.dup2} - ${B.B_SCHOOL2}` }).click();
    await page.waitForURL(new RegExp(B.B_IDS.dup2));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: `${B.B_NAMES.dup1} - ${B.B_SCHOOL}` })).toHaveAttribute("href", detail(B.B_IDS.dup1));
    expect([device.viewport.width, await pageOverflow(page)]).toEqual([device.viewport.width, 0]);
    await page.context().close();
  }
});
