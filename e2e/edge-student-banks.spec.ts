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
  expectInsideScreen,
  expectNoSideScroll,
  info,
  onDevice,
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

  test("C2, C5 còn 1 ngân hàng thì chọn sẵn; lượt được trả lại nên còn 2 thì bấm Tiếp tục tải lại danh sách 2 ngân hàng", async ({ page, request }) => {
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
    await expectInsideScreen(page, buttons.locator("svg"));
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

  test("D4 Sao chép khi trình duyệt cho ghi clipboard: báo Đã sao chép, clipboard có đúng mã", async ({ page, request, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: STUDENT });
    const s = await apiCreate(request, SCHOOL.long, info("Sao Chép Được"));
    await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, s);
    await page.getByRole("tabpanel").getByRole("button", { name: "Sao chép" }).click();
    await expect(page.getByRole("tabpanel").getByRole("button", { name: "Đã sao chép" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LONG_CODE);
  });

  test("D5 Sao chép khi trình duyệt không có clipboard: không báo Đã sao chép, báo Không sao chép được", async ({ page, request }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined }));
    const s = await apiCreate(request, SCHOOL.long, info("Không Sao Chép Được"));
    await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
    await openAt(page, SCHOOL.long, s);
    const panel = page.getByRole("tabpanel");
    await panel.getByRole("button", { name: "Sao chép" }).click();
    await expect(panel.getByText("Không sao chép được")).toBeVisible();
    await expect(panel.getByText("Đã sao chép")).toHaveCount(0);
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
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Ảnh 2: chụp hoặc chọn ảnh").setInputFiles(PHOTO);
    await expect(panel.getByText("2. Ảnh 2")).toHaveCount(0, { timeout: 30_000 });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  });

  test("D12 người quản lý thêm khung lúc học sinh đã đủ ảnh: Gửi kiểm tra báo còn khung trống, web tải lại hiện khung mới", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.stale, info("Khung Vừa Thêm"));
    await apiPick(request, s, [BANK.stale, BANK.p3]);
    await apiPhotos(request, s);
    await openAt(page, SCHOOL.stale, s);
    const send = page.getByRole("button", { name: "Gửi kiểm tra" });
    await expect(send).toBeEnabled();
    dbOp("slot-add", BANK.stale, SLOT.staleAdded, "Ảnh mới");
    await send.click();
    await expect(alertIn(page)).toHaveText("Còn khung chưa có ảnh.");
    await tab(page, NAME.stale).click();
    await expect(page.getByRole("tabpanel").getByLabel("Ảnh mới: chụp hoặc chọn ảnh")).toBeAttached();
    await expect(send).toBeDisabled();
    await uploadIn(page, "Ảnh mới");
    await send.click();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  });
});
