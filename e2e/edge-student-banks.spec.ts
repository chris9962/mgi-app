import { expect, test, type Page } from "@playwright/test";
import { BANK, CODE, GUIDE_LONG, LONG_CODE, NAME, SCHOOL, SLOT } from "../scripts/e2e-data-student";
import {
  PHONE,
  PHOTO,
  STUDENT,
  apiCreate,
  apiPhotos,
  apiPick,
  apiSubmit,
  dbOp,
  device,
  expectBoxSize,
  expectInsideBox,
  expectInsideScreen,
  expectNoSideScroll,
  info,
  onDevice,
  textLines,
  withEdgeData,
  watchDialogs,
  type ApiStudent,
} from "./edge-student-support";

test.use(PHONE);
withEdgeData();

const next = (page: Page) => page.getByRole("button", { name: "Tiếp tục" });
const alertIn = (page: Page) => page.getByRole("main").getByRole("alert");
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });

async function openAt(page: Page, schoolId: string, s: ApiStudent) {
  await onDevice(page, device(schoolId, s));
  await page.goto("/");
}

async function uploadIn(page: Page, slot: string) {
  const panel = page.getByRole("tabpanel");
  await panel.getByLabel(`${slot}: chụp hoặc chọn ảnh`).setInputFiles(PHOTO);
  await expect(panel.getByLabel(`${slot}: chụp lại`)).toBeAttached({ timeout: 30_000 });
}

test.describe("C. B2 chọn ngân hàng", () => {
  test("C1 chọn 2 thì ngân hàng thứ 3 khoá, bỏ chọn một thì mở lại", async ({ page, request }) => {
    await openAt(page, SCHOOL.photo, await apiCreate(request, SCHOOL.photo, info("Chọn Ba Ngân Hàng")));
    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    await expect(page.getByRole("button", { name: NAME.p4 })).toBeDisabled();
    await page.getByRole("button", { name: NAME.p1 }).click();
    await expect(page.getByRole("button", { name: NAME.p1 })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: NAME.p4 })).toBeEnabled();
    await expect(page.getByText("Đã chọn 1/2.")).toBeVisible();
  });

  test("C2, C5 còn 1 ngân hàng thì chọn sẵn; lượt được trả lại nên còn 2 thì bấm Tiếp tục tải lại danh sách 2 ngân hàng, câu Chọn đúng 2 ngân hàng hiện một lần", async ({ page, request }) => {
    dbOp("reset", SCHOOL.quota);
    const other = await apiCreate(request, SCHOOL.quota, info("Lấy Lượt Cuối"));
    await apiPick(request, other, [BANK.q1, BANK.q2]);
    const me = await apiCreate(request, SCHOOL.quota, info("Còn Một Ngân Hàng"));
    await openAt(page, SCHOOL.quota, me);
    await expect(page.getByRole("heading", { name: "Chọn ngân hàng", exact: true })).toBeVisible();
    await expect(page.getByText("Chỉ còn 1 ngân hàng chưa có tài khoản.")).toBeVisible();
    await expect(page.getByText(NAME.q2)).toBeVisible();
    await expect(page.getByText(NAME.q1)).toHaveCount(0);

    expect((await request.delete(`${STUDENT}/api/customers/me/banks`, { headers: other.auth })).status()).toBe(204);
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await expect(page.getByText(/Chọn đúng 2 ngân hàng/)).toHaveCount(1);
    await expect(alertIn(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: NAME.q1 })).toBeEnabled();
    await expect(page.getByRole("button", { name: NAME.q2 })).toBeEnabled();
    await page.getByRole("button", { name: NAME.q1 }).click();
    await page.getByRole("button", { name: NAME.q2 }).click();
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
  });

  test("C4 đang xem 2 ngân hàng thì học sinh khác lấy lượt cuối: báo vừa hết lượt, danh sách còn 1 chọn sẵn", async ({ page, request }) => {
    dbOp("reset", SCHOOL.quota);
    const me = await apiCreate(request, SCHOOL.quota, info("Chậm Một Bước"));
    await openAt(page, SCHOOL.quota, me);
    await page.getByRole("button", { name: NAME.q1 }).click();
    await page.getByRole("button", { name: NAME.q2 }).click();
    await apiPick(request, await apiCreate(request, SCHOOL.quota, info("Nhanh Một Bước")), [BANK.q1, BANK.q2]);
    await next(page).click();
    await expect(alertIn(page)).toHaveText("Ngân hàng vừa hết lượt. Chọn lại.");
    await expect(page.getByText("Chỉ còn 1 ngân hàng chưa có tài khoản.")).toBeVisible();
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(1);
  });

  test("C3 hết lượt cả hai ngân hàng thì thấy Ngân hàng đã hết lượt trong tháng này", async ({ page, request }) => {
    dbOp("reset", SCHOOL.quota);
    dbOp("quota", CODE.q2, "1");
    await apiPick(request, await apiCreate(request, SCHOOL.quota, info("Lấy Hết Lượt")), [BANK.q1, BANK.q2]);
    await openAt(page, SCHOOL.quota, await apiCreate(request, SCHOOL.quota, info("Tới Sau Cùng")));
    await expect(page.getByRole("heading", { name: "Ngân hàng đã hết lượt trong tháng này" })).toBeVisible();
    dbOp("reset", SCHOOL.quota);
  });

  test("C6 tên ngân hàng dài có và không có dấu cách: nút và dấu tích nằm trong màn hình, không cuộn ngang", async ({ page, request }) => {
    await openAt(page, SCHOOL.long, await apiCreate(request, SCHOOL.long, info("Tên Ngân Hàng Dài")));
    const buttons = page.getByRole("main").getByRole("listitem").getByRole("button");
    await expect(buttons).toHaveCount(2);
    await buttons.nth(0).click();
    await buttons.nth(1).click();
    await expect(page.getByText("Đã chọn 2/2.")).toBeVisible();
    await expectNoSideScroll(page);
    await expectInsideScreen(page, buttons);
    await expectInsideBox(buttons, ":scope > span");
  });

  test("C7 bấm đúp Tiếp tục: giữ chỗ một lần, vào B3, không có câu lỗi", async ({ page, request }) => {
    await openAt(page, SCHOOL.photo, await apiCreate(request, SCHOOL.photo, info("Bấm Đúp Chọn")));
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/customers/me/banks") posts += 1;
    });
    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    await next(page).dblclick();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    await expect(alertIn(page)).toHaveCount(0);
    expect(posts).toBe(1);
  });

  test("C8 trường đóng lúc học sinh ở B2: bấm Tiếp tục thì thấy Trường đã đóng, không giữ chỗ", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.closing, info("Đóng Lúc Chọn Ngân Hàng"));
    await openAt(page, SCHOOL.closing, s);
    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    dbOp("school", SCHOOL.closing, "closed");
    try {
      await next(page).click();
      await expect(page.getByRole("heading", { level: 1, name: "Trường đã đóng" })).toBeVisible();
      await expect(page.getByText(NAME.schoolClosing)).toBeVisible();
      expect((await s.me()).banks).toEqual([]);
    } finally {
      dbOp("school", SCHOOL.closing, "open");
    }
  });
});

test.describe("D. B3 mở tài khoản", () => {
  test("D1, D2, D3, D6, D7 chữ dài ở tab, bước hướng dẫn, mã, khung ảnh, ảnh mẫu: nguyên văn, không cuộn ngang, tab dính đầu màn", async ({ page, request }) => {
    const dialogs = watchDialogs(page);
    const s = await apiCreate(request, SCHOOL.long, info("Xem Chữ Dài"));
    await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, s);
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    await expectNoSideScroll(page);
    const tabs = page.getByRole("tablist", { name: "Ngân hàng đã chọn" });
    await expectInsideScreen(page, tabs.getByRole("tab"));
    await expectInsideBox(tabs.getByRole("tab"), ":scope > span[aria-hidden]");

    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("listitem").filter({ hasText: /^Tải app|^Mở https|^Nhập/ })).toHaveText(GUIDE_LONG);
    await expect(panel.getByText(LONG_CODE, { exact: true })).toBeVisible();
    await expectInsideScreen(page, panel.getByRole("button", { name: "Sao chép" }));
    const open = panel.getByRole("link", { name: "Quét QR code" });
    expect(await open.evaluate((a: HTMLAnchorElement) => a.href)).toBe("https://example.com/mo%20tai%20khoan?ref=HSB%20LONG");
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(panel.getByText(`1. ${NAME.slotLongSpace}`)).toBeVisible();
    await expect(panel.getByText(`2. ${NAME.slotLongWord}`)).toBeVisible();
    await expect(panel.getByText("Chưa có ảnh mẫu")).toHaveCount(1);
    await expectInsideScreen(page, panel.locator("label"));

    await panel.getByRole("button", { name: `Xem ảnh mẫu ${NAME.slotLongSpace}` }).click();
    const viewer = page.getByRole("dialog", { name: `Ảnh mẫu ${NAME.slotLongSpace}` });
    await expect(viewer.getByRole("img")).toBeVisible();
    await expect(viewer.getByText(`1. ${NAME.slotLongSpace}`)).toBeVisible();
    await expectInsideScreen(page, viewer.getByText(`1. ${NAME.slotLongSpace}`));
    await viewer.getByRole("button", { name: "Đóng" }).click();
    await expect(viewer).toHaveCount(0);

    await tab(page, NAME.bankLongWord).click();
    await expect(tab(page, NAME.bankLongWord)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("link", { name: "Quét QR code" })).toHaveCount(0);
    await expectNoSideScroll(page);

    await tab(page, NAME.bankLongSpace).click();
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
    await expect.poll(async () => Math.round((await tabs.boundingBox())!.y)).toBe(0);
    expect(dialogs).toEqual([]);
  });

  test("D19 tab tên dài cạnh tab tên ngắn, hai tab tên dài: vòng tròn giữ 16 px, tên ngắn không bị ngắt giữa chữ", async ({ page, request }) => {
    const mixed = await apiCreate(request, SCHOOL.mixed, info("Tab Dài Tab Ngắn"));
    await apiPick(request, mixed, [BANK.longSpace, BANK.p3]);
    await openAt(page, SCHOOL.mixed, mixed);
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expectBoxSize(page.getByRole("tab").locator("span[aria-hidden]"), 16, 16);
    expect(await textLines(tab(page, NAME.p3)), "tên ngắn xuống dòng").toBe(1);
    await expectNoSideScroll(page);

    const twoLong = await apiCreate(request, SCHOOL.long, info("Hai Tab Dài"));
    await apiPick(request, twoLong, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, twoLong);
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expectBoxSize(page.getByRole("tab").locator("span[aria-hidden]"), 16, 16);
    await expectNoSideScroll(page);
  });

  test("D4 Sao chép khi trình duyệt cho ghi clipboard: báo Đã sao chép qua vùng aria-live, clipboard có đúng mã, 2 giây sau về như cũ", async ({ page, request, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: STUDENT });
    const s = await apiCreate(request, SCHOOL.long, info("Sao Chép Được"));
    await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, s);
    const panel = page.getByRole("tabpanel");
    const copy = panel.getByRole("button", { name: "Sao chép" });
    const status = panel.locator('[aria-live="polite"]');
    await expect(status).toHaveText("");
    // Vùng báo rỗng không được thêm một hàng trống giữa nút Sao chép và nút Quét QR code.
    const gap = async () => (await panel.getByRole("link", { name: "Quét QR code" }).boundingBox())!.y - ((await copy.boundingBox())!.y + (await copy.boundingBox())!.height);
    expect(await gap()).toBeLessThanOrEqual(7);
    await copy.click();
    await expect(status).toHaveText("Đã sao chép");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LONG_CODE);
    await expect(status).toHaveText("", { timeout: 5_000 });
    await expect(copy).toBeVisible();
  });

  test("D5 Sao chép khi trình duyệt không có clipboard: không báo Đã sao chép, báo Không sao chép được, 2 giây sau về như cũ", async ({ page, request }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined }));
    const s = await apiCreate(request, SCHOOL.long, info("Không Sao Chép Được"));
    await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, s);
    const panel = page.getByRole("tabpanel");
    const status = panel.locator('[aria-live="polite"]');
    await panel.getByRole("button", { name: "Sao chép" }).click();
    await expect(status).toHaveText("Không sao chép được");
    await expect(panel.getByText("Đã sao chép")).toHaveCount(0);
    await expect(status).toHaveText("", { timeout: 5_000 });
  });

  test("D8 ngân hàng chưa cài hướng dẫn: tab chỉ có mã, ghi đủ ảnh; gửi kiểm tra được khi ngân hàng kia đủ ảnh", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.noGuide, info("Chưa Có Hướng Dẫn"));
    await apiPick(request, s, [BANK.p2, BANK.p3]);
    await openAt(page, SCHOOL.noGuide, s);
    await tab(page, NAME.p2).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("HSB-P2-01")).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(0);
    await expect(tab(page, NAME.p2)).toContainText("đủ ảnh");
    await tab(page, NAME.p3).click();
    await uploadIn(page, "Ảnh màn hình chính");
    await page.getByRole("button", { name: "Gửi kiểm tra" }).click();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  });

  test("D9 Quay lại khi chưa có ảnh thì về B2 không hỏi; đã có ảnh thì hỏi, Huỷ giữ nguyên ảnh", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Quay Lại Chọn"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await openAt(page, SCHOOL.photo, s);
    await page.getByRole("button", { name: "Quay lại chọn ngân hàng" }).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    await next(page).click();
    await uploadIn(page, "Ảnh màn hình chính");
    await page.getByRole("button", { name: "Quay lại chọn ngân hàng" }).click();
    const confirm = page.getByRole("dialog", { name: "Quay lại chọn ngân hàng" });
    await confirm.getByRole("button", { name: "Huỷ" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole("tabpanel").getByLabel("Ảnh màn hình chính: chụp lại")).toBeAttached();
    expect((await s.me()).banks[0].slots[0].photo).not.toBeNull();
  });

  test("D10 trường đóng lúc học sinh ở B3: nút Quay lại ẩn, vẫn nộp ảnh và gửi kiểm tra được", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.closing, info("Trường Đóng Ở B3"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s, [SLOT.p3]);
    await openAt(page, SCHOOL.closing, s);
    await expect(page.getByRole("button", { name: "Quay lại chọn ngân hàng" })).toBeVisible();
    dbOp("school", SCHOOL.closing, "closed");
    try {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Quay lại chọn ngân hàng" })).toHaveCount(0);
      await tab(page, NAME.p3).click();
      await uploadIn(page, "Ảnh màn hình chính");
      await page.getByRole("button", { name: "Gửi kiểm tra" }).click();
      await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    } finally {
      dbOp("school", SCHOOL.closing, "open");
    }
  });

  test("D14 trường vừa đóng mà web chưa tải lại: bấm Quay lại, có ảnh hay chưa, thì web tải lại, nút Quay lại ẩn", async ({ page, request }) => {
    const noPhoto = await apiCreate(request, SCHOOL.closing, info("Quay Lại Trường Đóng"));
    await apiPick(request, noPhoto, [BANK.p1, BANK.p3]);
    const withPhoto = await apiCreate(request, SCHOOL.closing, info("Quay Lại Có Ảnh Trường Đóng"));
    await apiPick(request, withPhoto, [BANK.p1, BANK.p3]);
    await apiPhotos(request, withPhoto, [SLOT.p3]);
    const back = page.getByRole("button", { name: "Quay lại chọn ngân hàng" });
    await openAt(page, SCHOOL.closing, noPhoto);
    await expect(back).toBeVisible();
    dbOp("school", SCHOOL.closing, "closed");
    try {
      await back.click();
      await expect(alertIn(page)).toHaveText("Trường đã đóng.");
      await expect(back).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();

      dbOp("school", SCHOOL.closing, "open");
      await openAt(page, SCHOOL.closing, withPhoto);
      await expect(back).toBeVisible();
      dbOp("school", SCHOOL.closing, "closed");
      await back.click();
      const confirm = page.getByRole("dialog", { name: "Quay lại chọn ngân hàng" });
      await confirm.getByRole("button", { name: "Quay lại", exact: true }).click();
      await expect(confirm).toHaveCount(0);
      await expect(alertIn(page)).toHaveText("Trường đã đóng.");
      await expect(back).toHaveCount(0);
      await expect(page.getByRole("tabpanel").getByLabel("Ảnh màn hình chính: chụp lại")).toBeAttached();
    } finally {
      dbOp("school", SCHOOL.closing, "open");
    }
  });

  test("D20 bấm Quay lại trong hộp hỏi trên mạng chậm: Huỷ khoá, X và Esc không đóng hộp, xong thì về B2", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Huỷ Lúc Đang Quay Lại"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s, [SLOT.p3]);
    await openAt(page, SCHOOL.photo, s);
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/customers/me/banks", async (route) => {
      if (route.request().method() === "DELETE") await gate;
      await route.continue();
    });
    await page.getByRole("button", { name: "Quay lại chọn ngân hàng" }).click();
    const confirm = page.getByRole("dialog", { name: "Quay lại chọn ngân hàng" });
    const deleting = page.waitForRequest((r) => r.method() === "DELETE" && new URL(r.url()).pathname === "/api/customers/me/banks");
    await confirm.getByRole("button", { name: "Quay lại", exact: true }).click();
    await deleting;
    await expect(confirm.getByRole("button", { name: "Huỷ" })).toBeDisabled();
    await confirm.getByRole("button", { name: "Đóng" }).click();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeVisible();
    release();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await expect(confirm).toHaveCount(0);
  });

  test("D15 hai tab ở B3: tab kia đã gửi kiểm tra, bấm Quay lại thì sang màn kết quả", async ({ page, request }) => {
    const who = info("Hai Tab Quay Lại");
    const s = await apiCreate(request, SCHOOL.photo, who);
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s);
    await openAt(page, SCHOOL.photo, s);
    await expect(page.getByRole("button", { name: "Gửi kiểm tra" })).toBeEnabled();
    await apiSubmit(request, s);
    await page.getByRole("button", { name: "Quay lại chọn ngân hàng" }).click();
    await page.getByRole("dialog", { name: "Quay lại chọn ngân hàng" }).getByRole("button", { name: "Quay lại", exact: true }).click();
    await expect(page.getByRole("heading", { name: `${who.fullName} - ${who.className}` })).toBeVisible();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("D16 bấm đúp Quay lại khi chưa có ảnh trên mạng chậm: nút khoá, chỉ một request, về B2", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Quay Lại Bấm Đúp"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await openAt(page, SCHOOL.photo, s);
    let deletes = 0;
    page.on("request", (r) => {
      if (r.method() === "DELETE" && new URL(r.url()).pathname === "/api/customers/me/banks") deletes += 1;
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/customers/me/banks", async (route) => {
      if (route.request().method() === "DELETE") await gate;
      await route.continue();
    });
    const back = page.getByRole("button", { name: "Quay lại chọn ngân hàng" });
    await back.dblclick();
    await expect(back).toBeDisabled();
    release();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await expect(alertIn(page)).toHaveCount(0);
    expect(deletes).toBe(1);
  });

  test("D17 trang ẩn rồi hiện lại lúc đang nộp ảnh: kết quả tải lại cũ về muộn không xoá ảnh vừa nộp", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Chụp Bằng Camera Android"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await openAt(page, SCHOOL.photo, s);
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let markFetched = () => {};
    const fetched = new Promise<void>((resolve) => (markFetched = resolve));
    let first = true;
    // Lần tải lại đầu lấy hồ sơ lúc chưa có ảnh rồi giữ lại, trả về sau lần tải lại của ảnh vừa nộp.
    await page.route("**/api/customers/me", async (route) => {
      if (!first) return route.continue();
      first = false;
      const old = await route.fetch();
      markFetched();
      await gate;
      await route.fulfill({ response: old });
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await fetched;
    await uploadIn(page, "Ảnh màn hình chính");
    const late = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/customers/me");
    release();
    await late;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByLabel("Ảnh màn hình chính: chụp lại")).toBeAttached();
    await expect(panel.getByLabel("Ảnh màn hình chính: chụp hoặc chọn ảnh")).toHaveCount(0);
  });

  test("D18 link ảnh mẫu, ảnh đã nộp, ảnh QR hết hạn trả 403: khung vẫn ghi Đã gửi, khung giữ kích thước, trang không cuộn ngang", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Link Ảnh Hết Hạn"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s, [SLOT.p1Transfer]);
    const denied: string[] = [];
    // Link S3 ký sẵn hết hạn thì S3 trả 403 dạng XML.
    await page.route(
      (url) => url.origin !== STUDENT,
      (route) => {
        if (route.request().resourceType() !== "image") return route.continue();
        denied.push(route.request().url());
        return route.fulfill({ status: 403, contentType: "application/xml", body: "<Error><Code>AccessDenied</Code></Error>" });
      },
    );
    await openAt(page, SCHOOL.photo, s);
    const panel = page.getByRole("tabpanel");
    const qr = panel.getByRole("img", { name: `QR mã giới thiệu ${NAME.p1}` });
    await expect(qr).toBeAttached();
    await expect.poll(() => denied.length).toBeGreaterThanOrEqual(3);
    const main = panel.getByRole("listitem").filter({ hasText: "Ảnh màn hình chính" });
    await expect(main.getByText("Đã gửi")).toBeVisible();
    await expect(main.getByText("Chụp lại")).toBeVisible();
    await expect(main.getByText("Ảnh mẫu", { exact: true })).toBeVisible();
    await expectBoxSize(qr, 96, 96);
    for (const box of [main.locator("label"), main.getByRole("button", { name: "Xem ảnh mẫu Ảnh màn hình chính" })]) expect((await box.boundingBox())!.height).toBeCloseTo(160, 0);
    await expectInsideScreen(page, panel.getByRole("button", { name: "Sao chép" }));
    await expectNoSideScroll(page);
  });

  test("D11 còn khung trống thì Gửi kiểm tra khoá; đủ ảnh bấm đúp chỉ gửi một lần, vào màn kết quả", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Gửi Bấm Đúp"));
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s, [SLOT.p3]);
    await openAt(page, SCHOOL.photo, s);
    const send = page.getByRole("button", { name: "Gửi kiểm tra" });
    await expect(send).toBeDisabled();
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/customers/me/submit") posts += 1;
    });
    await tab(page, NAME.p3).click();
    await uploadIn(page, "Ảnh màn hình chính");
    await send.dblclick();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    await expect(alertIn(page)).toHaveCount(0);
    expect(posts).toBe(1);
  });

  test("D13 người quản lý bỏ một khung trống lúc học sinh ở B3: nộp vào khung đó thì web tải lại, khung biến mất, Gửi kiểm tra bật", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.stale, info("Khung Vừa Bỏ"));
    await apiPick(request, s, [BANK.stale, BANK.p3]);
    await apiPhotos(request, s, [SLOT.stale2]);
    await openAt(page, SCHOOL.stale, s);
    const send = page.getByRole("button", { name: "Gửi kiểm tra" });
    await expect(send).toBeDisabled();
    dbOp("slot-remove", SLOT.stale2);
    try {
      const panel = page.getByRole("tabpanel");
      await panel.getByLabel("Ảnh 2: chụp hoặc chọn ảnh").setInputFiles(PHOTO);
      await expect(panel.getByText("2. Ảnh 2")).toHaveCount(0, { timeout: 30_000 });
      await expect(send).toBeEnabled();
      await send.click();
      await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    } finally {
      dbOp("slot-reset");
    }
  });

  test("D12 người quản lý thêm khung lúc học sinh đã đủ ảnh: Gửi kiểm tra báo còn khung trống, web tải lại hiện khung mới", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.stale, info("Khung Vừa Thêm"));
    await apiPick(request, s, [BANK.stale, BANK.p3]);
    await apiPhotos(request, s);
    await openAt(page, SCHOOL.stale, s);
    const send = page.getByRole("button", { name: "Gửi kiểm tra" });
    await expect(send).toBeEnabled();
    dbOp("slot-add", BANK.stale, SLOT.staleAdded, "Ảnh mới");
    try {
      await send.click();
      await expect(alertIn(page)).toHaveText("Còn khung chưa có ảnh.");
      await tab(page, NAME.stale).click();
      await expect(page.getByRole("tabpanel").getByLabel("Ảnh mới: chụp hoặc chọn ảnh")).toBeAttached();
      await expect(send).toBeDisabled();
      await uploadIn(page, "Ảnh mới");
      await expect(alertIn(page)).toHaveCount(0);
      await send.click();
      await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    } finally {
      dbOp("slot-reset");
    }
  });
});
