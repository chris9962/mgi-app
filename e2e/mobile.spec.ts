import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { E2E_MOBILE_CUSTOMER } from "../scripts/e2e-data";

const PASSWORD = "e2e23test";
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1366, height: 768 } };

async function loginAs(browser: Browser, username: string, device: object): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: "http://admin.localhost:3100", ...device })).newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
  return page;
}

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Điều hướng chính" });
const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Điều hướng nhanh" });

test("điện thoại: thanh đáy có 3 trang nghiệp vụ và nút Thêm, Thêm mở sidebar, chọn mục thì sidebar đóng và chuyển trang", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await expect(sidebar(page)).toBeHidden();
  await expect(bottomNav(page).getByRole("link")).toHaveText(["Hồ sơ học sinh", "Ngân hàng", "Mã voucher"]);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await expect(more).toBeVisible();

  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng menu điều hướng" })).toBeFocused();
  await sidebar(page).getByRole("link", { name: "Cài đặt" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
  await expect(sidebar(page)).toBeHidden();

  await bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" })).toHaveAttribute("aria-current", "page");
  await expect(bottomNav(page).getByRole("link", { name: "Ngân hàng" })).not.toHaveAttribute("aria-current", "page");
});

test("điện thoại: Esc và bấm lớp phủ đóng sidebar, Esc trả focus về nút Thêm", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeHidden();
  await expect(more).toBeFocused();

  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await page.mouse.click(370, 300);
  await expect(sidebar(page)).toBeHidden();
});

test("điện thoại: Nhân viên không có quyền trang nghiệp vụ nào thì thanh đáy chỉ có nút Thêm", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_noperm", PHONE);
  await expect(bottomNav(page).getByRole("link")).toHaveCount(0);
  await expect(bottomNav(page).getByRole("button", { name: "Thêm" })).toBeVisible();
});

const bodyOverflow = (page: Page) => page.evaluate(() => getComputedStyle(document.body).overflow);

test("điện thoại: ngăn đóng thì phím Tab không vào link của ngăn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  const inDrawer: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(() => (document.activeElement?.closest("#main-nav") ? document.activeElement.textContent : null));
    if (hit !== null) inDrawer.push(hit);
  }
  expect(inDrawer).toEqual([]);
});

test("điện thoại: ngăn mở thì Tab và Shift+Tab không ra nội dung bị ngăn che, nội dung rời cây trợ năng", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await bottomNav(page).getByRole("button", { name: "Thêm" }).click();
  await expect(sidebar(page)).toBeVisible();
  // Bộ chọn role của Playwright không xét inert; hỏi thẳng cây trợ năng của Chromium.
  const { nodes } = await (await page.context().newCDPSession(page)).send("Accessibility.getFullAXTree");
  expect(nodes.filter((n) => !n.ignored && ["main", "banner"].includes(String(n.role?.value)))).toEqual([]);
  expect(nodes.some((n) => !n.ignored && n.role?.value === "navigation" && n.name?.value === "Điều hướng chính")).toBe(true);
  const outside = () => page.evaluate(() => (document.activeElement && document.activeElement !== document.body && !document.activeElement.closest("#main-nav") ? document.activeElement.outerHTML.slice(0, 80) : null));

  await page.locator('#main-nav button[aria-controls="account-menu"]').focus();
  await page.keyboard.press("Tab");
  expect(await outside()).toBeNull();
  await page.getByRole("button", { name: "Đóng menu điều hướng" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await outside()).toBeNull();
});

test("điện thoại: menu tài khoản mở trong ngăn thì Esc đầu chỉ đóng menu, Esc sau mới đóng ngăn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await more.click();
  const trigger = page.locator('#main-nav button[aria-controls="account-menu"]');
  await trigger.click();
  await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toHaveCount(0);
  await expect(sidebar(page)).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeHidden();
  await expect(more).toBeFocused();
});

test("điện thoại: bấm Quay lại của trình duyệt khi ngăn đang mở thì ngăn đóng, trang hết khoá cuộn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await bottomNav(page).getByRole("button", { name: "Thêm" }).click();
  await expect(sidebar(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/users$/);
  await expect(sidebar(page)).toBeHidden();
  expect(await bodyOverflow(page)).toBe("visible");
});

test("ngăn đang mở mà màn rộng quá 900 px thì ngăn đóng, trang hết khoá cuộn, Esc không cướp focus", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  await bottomNav(page).getByRole("button", { name: "Thêm" }).click();
  await expect(sidebar(page)).toBeVisible();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(() => bodyOverflow(page)).toBe("visible");
  const search = page.getByRole("search").getByRole("textbox");
  await search.focus();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar(page)).toBeHidden();
});

test("điện thoại: đóng ngăn bằng Esc hay lớp phủ thì trang cuộn lại được", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await more.click();
  await expect(sidebar(page)).toBeVisible();
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeHidden();
  expect(await bodyOverflow(page)).toBe("visible");

  await more.click();
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.mouse.click(370, 300);
  await expect(sidebar(page)).toBeHidden();
  expect(await bodyOverflow(page)).toBe("visible");
});

test("điện thoại: không trang quản lý nào cuộn ngang cả trang", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  const menu = await page.locator("#main-nav a").evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
  await page.goto("/users?q=zz_e2e_staff");
  const user = await page.getByRole("link", { name: "E2E Nhân viên" }).getAttribute("href");
  await page.goto(`/customers?q=${encodeURIComponent(E2E_MOBILE_CUSTOMER)}`);
  const customer = await page.getByRole("link", { name: E2E_MOBILE_CUSTOMER }).getAttribute("href");
  const paths = [...new Set([...menu, "/profile", user!, customer!])];
  expect(paths.length).toBeGreaterThan(10);

  const wide: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (scroll !== client) wide.push(`${path}: ${scroll} > ${client}`);
  }
  expect(wide).toEqual([]);
});

const box = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; width: number });

test("điện thoại: ô tìm rộng hết thanh tiêu đề, bảng Bộ lọc nằm trọn trong màn hình, mục lọc thành một hàng ở trên", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  const search = await box(page.getByRole("search"));
  expect([search.left, search.right]).toEqual([16, 374]);

  await page.getByRole("button", { name: "Bộ lọc" }).click();
  const nav = page.getByRole("navigation", { name: "Mục lọc" });
  const panel = await box(nav.locator("xpath=../.."));
  expect(panel.left).toBeGreaterThanOrEqual(16);
  expect(panel.right).toBeLessThanOrEqual(374);
  const [first, second] = [await box(nav.getByRole("button").nth(0)), await box(nav.getByRole("button").nth(1))];
  expect(second.top).toBe(first.top);
  expect(second.left).toBeGreaterThan(first.left);
  await expect(page.getByRole("button", { name: "Xong" })).toBeInViewport();
});

test("điện thoại: nội dung lề 16 px như thanh tiêu đề, bảng rỗng hiện trọn câu báo trong khung", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/users?q=zz-e2e-khong-co-ai");
  await page.waitForLoadState("networkidle");
  expect((await box(page.getByRole("search"))).right).toBe(374);
  const card = await box(page.getByRole("region", { name: "Tài khoản" }));
  expect([card.left, card.right]).toEqual([16, 374]);
  const text = await page.getByText("Không có tài khoản").evaluate((td) => {
    const range = document.createRange();
    range.selectNodeContents(td);
    return range.getBoundingClientRect().toJSON() as { left: number; right: number };
  });
  expect(text.left).toBeGreaterThanOrEqual(card.left);
  expect(text.right).toBeLessThanOrEqual(card.right);
});

test("điện thoại: hộp thoại nằm trọn bề ngang màn hình, nút gửi cuộn tới được", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/schools");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm trường" });
  const d = await box(dialog);
  expect(d.left).toBeGreaterThanOrEqual(16);
  expect(d.right).toBeLessThanOrEqual(374);
  const submit = dialog.getByRole("button", { name: "Tạo trường" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
});

test("điện thoại: hộp thoại mở thì trang phía sau không cuộn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await page.goto("/banks/codes");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Thêm mã" }).click();
  await expect(page.getByRole("dialog", { name: "Thêm mã giới thiệu" })).toBeVisible();
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.mouse.move(8, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await bodyOverflow(page)).toBe("visible");
});

test("máy tính 1366x768: không có thanh đáy, sidebar hiện sẵn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", DESKTOP);
  await expect(bottomNav(page)).toBeHidden();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng menu điều hướng" })).toBeHidden();
  expect(await sidebar(page).evaluate((el) => el.getBoundingClientRect().left)).toBe(0);
});
