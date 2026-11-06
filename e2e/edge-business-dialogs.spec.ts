import { expect, test, type Locator, type Page } from "@playwright/test";
import * as B from "../scripts/e2e-data-business";
import { closeContexts, loginAs, open } from "./edge-business-support";

// Hộp thoại dùng chung (`src/components/ui/Dialog.tsx`) ở các trang ngoài nghiệp vụ; hộp của Trang 4 và Tin SMS lỗi test ở file của trang đó.
test.afterEach(closeContexts);

const SAVE_FAILED = "Không lưu được. Thử lại sau ít phút.";

// Giữ request ghi lại tới khi test cho đi; máy chủ giả trả lời nên dữ liệu không đổi.
async function hold(page: Page, url: string, reply: { status: number; json?: object }) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    if (route.request().method() === "GET") return route.continue();
    await gate;
    await route.fulfill(reply);
  });
  return release;
}

test("Tài khoản, Trường, Cá nhân: hộp đang lưu thì Huỷ bị khoá, không có nút Đóng, nhấn Esc 4 lần không đóng hộp; máy chủ báo lỗi thì câu báo hiện trong hộp, Huỷ đóng được", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  const password = async (d: Locator) => {
    await d.getByLabel("Mật khẩu hiện tại").fill("e2e-cu");
    await d.getByLabel("Mật khẩu mới", { exact: true }).fill("e2e-moi");
    await d.getByLabel("Nhập lại mật khẩu mới").fill("e2e-moi");
  };
  const cases: { path: string; button: string; title: string; url: string; submit: string; fill?: (d: Locator) => Promise<void> }[] = [
    { path: `/users?q=${B.B_USER1}`, button: "Sửa tài khoản E2E Biên Một", title: "Sửa tài khoản", url: "**/api/admin/users/*", submit: "Lưu" },
    { path: `/schools?q=${encodeURIComponent("Biên Nghiệp Vụ")}`, button: `Sửa trường ${B.B_SCHOOL}`, title: "Sửa trường", url: "**/api/admin/schools/*", submit: "Lưu" },
    { path: "/profile", button: "Sửa thông tin", title: "Sửa thông tin", url: "**/api/admin/profile", submit: "Lưu" },
    { path: "/profile", button: "Đổi mật khẩu", title: "Đổi mật khẩu", url: "**/api/admin/profile/password", submit: "Đổi mật khẩu", fill: password },
  ];
  for (const c of cases) {
    await open(page, c.path);
    const release = await hold(page, c.url, { status: 500 });
    await page.getByRole("button", { name: c.button, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: c.title });
    await c.fill?.(dialog);
    await dialog.getByRole("button", { name: c.submit, exact: true }).click();
    await expect(dialog.getByRole("button", { name: c.submit, exact: true }), c.title).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Huỷ" }), c.title).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Đóng" }), c.title).toHaveCount(0);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");
    await expect(dialog, c.title).toBeVisible();
    release();
    await expect(dialog.getByRole("alert"), c.title).toHaveText(SAVE_FAILED);
    await expect(dialog.getByRole("button", { name: "Đóng" }), c.title).toBeVisible();
    await dialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(page.getByRole("dialog"), c.title).toHaveCount(0);
    await page.unroute(c.url);
  }
});
