import { expect, test, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createUser, open, pageScroll, PHONE } from "./edge-config-support";

type Settings = { smsTemplate: string; zaloUrl: string; pviAppUrl: string };

const template = (page: Page) => page.getByLabel("Nội dung, không dấu");
const zalo = (page: Page) => page.getByLabel("Link Zalo");
const save = (page: Page) => page.getByRole("button", { name: "Lưu cấu hình" }).click();
const zaloCard = (page: Page) => page.getByRole("region", { name: "QR kết bạn Zalo" });

// Cài đặt là cấu hình dùng chung của DB local: đọc giá trị đang lưu trên trang trước khi sửa, test xong ghi lại đúng giá trị đó.
async function current(page: Page): Promise<Settings> {
  await open(page, "/settings");
  return { smsTemplate: await template(page).inputValue(), zaloUrl: await zalo(page).inputValue(), pviAppUrl: await page.getByLabel("Link app PVI").inputValue() };
}

async function restore(page: Page, before: Settings) {
  const r = await api(page, "PATCH", "/api/admin/settings", before);
  expect(r.status, JSON.stringify(r.body)).toBe(204);
}

test("Cài đặt: mẫu SMS 400 ký tự đếm 3 tin; mẫu có dấu, emoji, xuống dòng, trống, biến lạ, ngoặc lẻ, thiếu MA_VOUCHER đều báo lỗi đúng nghĩa; lưu được rồi gõ sai thì không còn câu Đã lưu", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const before = await current(page);
  try {
    await template(page).fill("A".repeat(380) + "{MA_VOUCHER}");
    await expect(page.getByText("400/160 ký tự, 3 tin", { exact: true })).toBeVisible();
    await save(page);
    await expect(page.getByRole("status")).toHaveText("Đã lưu cấu hình.");

    for (const [bad, msg] of [
      ["Ma có dấu {MA_VOUCHER}", "Mẫu SMS viết không dấu"],
      ["Ma 😀 {MA_VOUCHER}", "Mẫu SMS viết không dấu"],
      ["Dong mot\nDong hai {MA_VOUCHER}", "Mẫu SMS viết trên một dòng"],
      ["", "Nhập mẫu SMS"],
      ["    ", "Nhập mẫu SMS"],
      ["{HOTEN} {MA_VOUCHER}", "Mẫu SMS có biến không có thật: {HOTEN}"],
      ["{ho_ten} {MA_VOUCHER}", "Mẫu SMS có biến không có thật: {ho_ten}"],
      ["{} {MA_VOUCHER}", "Mẫu SMS có biến không có thật: {}"],
      ["{HO_TEN {MA_VOUCHER}", "Mẫu SMS có dấu ngoặc { } lẻ"],
      ["Chao {HO_TEN}", "Mẫu SMS phải có {MA_VOUCHER}"],
    ]) {
      await template(page).fill(bad);
      await save(page);
      await expect(page.getByText(msg, { exact: true }), JSON.stringify(bad)).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      const r = await api(page, "PATCH", "/api/admin/settings", { ...before, smsTemplate: bad });
      expect([bad, r.status, (r.body as { message?: string }).message]).toEqual([bad, 400, msg]);
    }
  } finally {
    await restore(page, before);
  }
});

test("Cài đặt: link Zalo javascript:, thiếu https://, có dấu cách, data: báo lỗi ô và ô QR ghi Chưa có link; link 3.000 ký tự không làm vỡ trang và bị từ chối; link trống lưu được; HTTPS viết hoa lưu được", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const before = await current(page);
  try {
    for (const [bad, msg] of [
      ["javascript:alert(1)", "Link phải bắt đầu bằng http:// hoặc https://"],
      ["zalo.me/abc", "Link phải bắt đầu bằng http:// hoặc https://"],
      ["data:text/html,x", "Link phải bắt đầu bằng http:// hoặc https://"],
      ["https://zalo.me/ abc", "Link không được có dấu cách"],
    ]) {
      await zalo(page).fill(bad);
      await expect(zaloCard(page)).toContainText("Chưa có link");
      await save(page);
      await expect(zalo(page), bad).toHaveAccessibleDescription(msg);
    }

    const long = "https://zalo.me/" + "a".repeat(3000);
    await zalo(page).fill(long);
    await expect(page.getByRole("heading", { name: "Cài đặt", level: 1 })).toBeVisible();
    await expect(zaloCard(page)).toContainText("Link quá dài");
    await save(page);
    await expect(zalo(page)).toHaveAccessibleDescription("Link tối đa 500 ký tự");
    const r = await api(page, "PATCH", "/api/admin/settings", { ...before, zaloUrl: long });
    expect(r).toEqual({ status: 400, body: { message: "Link tối đa 500 ký tự", field: "zaloUrl" } });
    await page.setViewportSize(PHONE.viewport);
    expect(await pageScroll(page).then((s) => s.scroll - s.client)).toBe(0);
    await page.setViewportSize({ width: 1366, height: 768 });

    await zalo(page).fill("");
    await expect(zaloCard(page)).toContainText("Chưa có link");
    await save(page);
    await expect(page.getByRole("status")).toHaveText("Đã lưu cấu hình.");
    await zalo(page).fill("HTTPS://ZALO.ME/X");
    await expect(zaloCard(page).getByRole("img", { name: "QR kết bạn Zalo" })).toBeVisible();
    await save(page);
    await expect(page.getByRole("status")).toHaveText("Đã lưu cấu hình.");
    await open(page, "/settings");
    await expect(zalo(page)).toHaveValue("HTTPS://ZALO.ME/X");
  } finally {
    await restore(page, before);
  }
});

test("Cài đặt: Quản lý và Nhân viên mở Cài đặt, Vận hành nhận 404, gọi API lưu cài đặt nhận 403", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const m = await createUser(admin, { fullName: "E2E C Quản lý cài đặt", username: "zz_e2e_c_cdql", role: "manager" });
  const body = { smsTemplate: "x {MA_VOUCHER}", zaloUrl: "", pviAppUrl: "" };
  for (const [username, password] of [["zz_e2e_c_cdql", m.password], ["zz_e2e_noperm", undefined]] as const) {
    const page = await asUser(browser, username, password);
    for (const path of ["/settings", "/ops"]) expect([username, path, (await page.goto(path))?.status()]).toEqual([username, path, 404]);
    expect((await api(page, "PATCH", "/api/admin/settings", body)).status).toBe(403);
  }
});
