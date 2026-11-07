import { expect, test } from "@playwright/test";
import { BANK, CODE, NAME, SCHOOL } from "../scripts/e2e-data-student";
import {
  LATER,
  NETWORK,
  PHONE,
  PHONE_ERROR,
  STUDENT,
  apiCreate,
  apiPhotos,
  apiPick,
  apiSubmit,
  dbOp,
  device,
  expectBoxSize,
  expectInsideScreen,
  expectNoSideScroll,
  fillInfo,
  fromDevice,
  info,
  onDevice,
  withEdgeData,
  watchDialogs,
} from "./edge-student-support";

test.use(PHONE);
withEdgeData();

const UNKNOWN = "e2e0a000-0000-4000-8000-0000000fffff";
const next = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Tiếp tục" });

test.describe("A. Mở link và chọn trường", () => {
  test("A1 máy mới mở link trường không có thì thấy Chưa có trường, URL về /", async ({ page }) => {
    await page.goto(`/t/${UNKNOWN}`);
    await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();
    await expect(page).toHaveURL(`${STUDENT}/`);
  });

  test("A2 máy đã có trường, link id sai dạng thì giữ trường đang lưu", async ({ page }) => {
    await onDevice(page, device(SCHOOL.photo));
    await page.goto("/t/abc");
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
    await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();
    await expect(page).toHaveURL(`${STUDENT}/`);
  });

  test("A3, A5, B13 trường đã đóng và trường tên dài có ký tự đặc biệt: chữ nguyên văn, không alert, không cuộn ngang", async ({ page }) => {
    const dialogs = watchDialogs(page);
    await page.goto(`/t/${SCHOOL.closed}`);
    await expect(page.getByRole("heading", { name: "Trường đã đóng" })).toBeVisible();
    await expect(page.getByText(NAME.schoolClosed)).toBeVisible();

    await page.goto(`/t/${SCHOOL.long}`);
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
    await expect(page.getByText(NAME.schoolLong, { exact: true })).toBeVisible();
    const banks = page.getByRole("group", { name: "Ngân hàng đã có tài khoản" });
    await expect(banks.getByRole("checkbox", { name: NAME.bankLongSpace })).toBeVisible();
    await expect(banks.getByRole("checkbox", { name: NAME.bankLongWord })).toBeVisible();
    await expectNoSideScroll(page);
    await expectInsideScreen(page, banks.locator("label"));
    await expectInsideScreen(page, page.getByRole("button", { name: "Tiếp tục" }));

    await dbOp("school", SCHOOL.long, "closed");
    try {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Trường đã đóng" })).toBeVisible();
      await expect(page.getByText(NAME.schoolLong, { exact: true })).toBeVisible();
      await expectNoSideScroll(page);
    } finally {
      await dbOp("school", SCHOOL.long, "open");
    }
    expect(dialogs).toEqual([]);
  });

  test("A4, A5 máy có hồ sơ ở trường khác: hỏi đổi trường, Giữ trường cũ về hồ sơ cũ, Đổi trường vào B1 trường mới", async ({ page, request }) => {
    const dialogs = watchDialogs(page);
    const s = await apiCreate(request, SCHOOL.long, info("Nguyễn Văn Đổi"));
    await onDevice(page, device(SCHOOL.long, s));
    await page.goto(`/t/${SCHOOL.photo}`);
    const ask = page.getByRole("region", { name: "Đổi trường" });
    await expect(ask).toContainText(`Máy này đang dùng ${NAME.schoolLong}. Link vừa mở là của ${NAME.schoolPhoto}.`);
    await expectNoSideScroll(page);
    await page.getByRole("button", { name: "Giữ trường cũ" }).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await expect(page.getByText(NAME.schoolLong, { exact: true })).toBeVisible();
    await expectNoSideScroll(page);

    await page.goto(`/t/${SCHOOL.photo}`);
    await page.getByRole("button", { name: "Đổi trường" }).click();
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
    await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("mgi.token"))).toBeNull();
    expect((await s.me()).customer.status).toBe("new");
    expect(dialogs).toEqual([]);
  });

  test("A6 máy giữ token của hồ sơ không còn: quên token, hiện B1 của trường đang lưu", async ({ page }) => {
    await onDevice(page, { "mgi.schoolId": SCHOOL.photo, "mgi.customerId": UNKNOWN, "mgi.token": "A".repeat(43) });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("mgi.token"))).toBeNull();
  });

  test("A7 máy giữ id trường hỏng thì thấy Chưa có trường", async ({ page }) => {
    await onDevice(page, { "mgi.schoolId": "khong-phai-uuid" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();
  });

  test("A8 máy chủ trả 502 lúc mở web: báo thử lại sau ít phút, không bảo kiểm tra mạng, không ghi Không lưu được; Thử lại vào đúng bước", async ({ page, request }) => {
    const s = await apiCreate(request, SCHOOL.photo, info("Trần Thị Năm Lẻ Hai"));
    await onDevice(page, device(SCHOOL.photo, s));
    await page.route("**/api/customers/me", (r) => r.fulfill({ status: 502, contentType: "text/html", body: "<html><body>502 Bad Gateway</body></html>" }));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible();
    await expect(page.getByText(LATER, { exact: true })).toBeVisible();
    await expect(page.getByText(NETWORK)).toHaveCount(0);
    await expect(page.getByText(/Không lưu được/)).toHaveCount(0);
    await page.unroute("**/api/customers/me");
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
  });

  test("A9 mất mạng lúc mở web: báo không kết nối được, Thử lại khi có mạng", async ({ page }) => {
    await onDevice(page, device(SCHOOL.photo));
    await page.route("**/api/schools/**", (r) => r.abort("internetdisconnected"));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible();
    await expect(page.getByText(NETWORK)).toBeVisible();
    await page.unroute("**/api/schools/**");
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
  });

  test("A19 bấm Thử lại khi mạng vẫn lỗi: nút ghi Đang thử lại và không gửi thêm request trong lúc chờ, lỗi thì về Thử lại, tiêu điểm giữ ở nút", async ({ page }) => {
    await onDevice(page, device(SCHOOL.photo));
    let calls = 0;
    let gate = Promise.resolve();
    await page.route("**/api/schools/**", async (route) => {
      calls += 1;
      await gate;
      await route.abort("internetdisconnected");
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible();
    let release = () => {};
    gate = new Promise<void>((resolve) => (release = resolve));
    await page.getByRole("button", { name: "Thử lại" }).click();
    const busy = page.getByRole("button", { name: "Đang thử lại" });
    await expect(busy).toHaveAttribute("aria-disabled", "true");
    await busy.click({ force: true });
    expect(calls).toBe(2);
    release();
    const retry = page.getByRole("button", { name: "Thử lại", exact: true });
    await expect(retry).toBeVisible();
    await expect(retry).not.toHaveAttribute("aria-disabled");
    await expect(retry).toBeFocused();
    await expect(page.getByText(NETWORK)).toBeVisible();
    expect(calls).toBe(2);
  });

  test("A17 mất mạng lần đầu mở link trường: Thử lại vào B1 của trường đó; máy có hồ sơ trường khác thì Thử lại hỏi đổi trường", async ({ page, request }) => {
    let calls = 0;
    await page.route("**/api/schools/**", (r) => (calls++ === 0 ? r.abort("internetdisconnected") : r.continue()));
    await page.goto(`/t/${SCHOOL.photo}`);
    await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible();
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
    await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();

    const s = await apiCreate(request, SCHOOL.long, info("Mở Link Lúc Mất Mạng"));
    await onDevice(page, device(SCHOOL.long, s));
    calls = 0;
    await page.goto(`/t/${SCHOOL.photo}`);
    await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible();
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("region", { name: "Đổi trường" })).toContainText(`Link vừa mở là của ${NAME.schoolPhoto}.`);
  });

  test("A10 đường dẫn lạ ở tên miền học sinh trả 404, không 500", async ({ page, request }) => {
    for (const path of [`/t/${SCHOOL.photo}/thua`, "/abc", "/admin", "/student", "/t/"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    for (const path of ["/api/admin/users", "/api/khong-co", `/api/schools/${SCHOOL.photo}/thua`]) {
      expect((await request.get(`${STUDENT}${path}`)).status(), path).toBe(404);
    }
  });

  test("A11 đang ở B2 bấm Quay lại của trình duyệt rồi Tới: web hiện lại B2", async ({ page }) => {
    await page.goto("about:blank");
    await page.goto(`${STUDENT}/t/${SCHOOL.photo}`);
    await fillInfo(page, info("Lê Văn Quay Lại"));
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("about:blank");
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
  });

  test("A12 tải lại trang: B1 gõ dở thì trống, B2 chưa chọn, B3 giữ ảnh đã nộp", async ({ page }) => {
    await onDevice(page, device(SCHOOL.photo));
    await page.goto("/");
    await page.getByLabel("Họ và tên", { exact: true }).fill("Đang Gõ Dở");
    await page.reload();
    await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("");
    await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();

    await fillInfo(page, info("Phạm Tải Lại"));
    await next(page).click();
    await page.getByRole("button", { name: NAME.p1 }).click();
    await expect(page.getByText("Đã chọn 1/2.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Đã chọn 0/2.")).toBeVisible();

    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    await next(page).click();
    const panel = page.getByRole("tabpanel");
    await panel.getByLabel("Ảnh màn hình chính: chọn ảnh").setInputFiles("public/brand/photo.jpg");
    await expect(panel.getByLabel("Ảnh màn hình chính: chọn lại")).toBeAttached({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByLabel("Ảnh màn hình chính: chọn lại")).toBeAttached();
  });

  test("A13 hai tab ở B3: tab kia đã gửi kiểm tra, bấm Gửi kiểm tra thì sang màn kết quả", async ({ page, request }) => {
    const who = info("Hai Tab Gửi");
    const s = await apiCreate(request, SCHOOL.photo, who);
    await apiPick(request, s, [BANK.p1, BANK.p3]);
    await apiPhotos(request, s);
    await onDevice(page, device(SCHOOL.photo, s));
    await page.goto("/");
    const send = page.getByRole("button", { name: "Gửi kiểm tra" });
    await expect(send).toBeEnabled();
    await apiSubmit(request, s);
    await send.click();
    await expect(page.getByRole("heading", { name: `${who.fullName} - ${who.className}` })).toBeVisible();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  });

  test("A14 máy không có camera: hộp thoại Quét mã QR báo không mở được camera, Đóng thì hết hộp thoại", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Quét mã QR" }).click();
    const dialog = page.getByRole("dialog", { name: "Quét mã QR" });
    await expect(dialog.getByRole("alert")).toHaveText("Không mở được camera. Quét mã QR bằng camera của điện thoại.");
    await dialog.getByRole("button", { name: "Đóng" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();
  });
});

test.describe("B. B1 khai thông tin", () => {
  test.beforeEach(async ({ page }) => {
    await onDevice(page, device(SCHOOL.photo));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
  });

  test("B1, B2 bỏ trống hoặc chỉ khoảng trắng: nút khoá, lỗi hiện dưới đúng ô khi rời ô", async ({ page }) => {
    await expect(next(page)).toBeDisabled();
    const fields = [
      ["Họ và tên", "Nhập họ và tên"],
      ["Lớp", "Nhập lớp"],
      ["SĐT", PHONE_ERROR],
      ["Họ và tên phụ huynh", "Nhập họ và tên phụ huynh"],
      ["SĐT phụ huynh", PHONE_ERROR],
    ];
    for (const [label, error] of fields) {
      const box = page.getByLabel(label, { exact: true });
      await box.fill("   ");
      await box.blur();
      await expect(box).toHaveAccessibleDescription(error);
    }
    await expect(next(page)).toBeDisabled();
  });

  test("B3 họ tên đúng 100 ký tự thì qua, 101 ký tự báo Tối đa 100 ký tự", async ({ page }) => {
    const name100 = `Nguyễn ${"A".repeat(93)}`;
    expect(name100.length).toBe(100);
    await fillInfo(page, info(name100));
    await expect(next(page)).toBeEnabled();
    const box = page.getByLabel("Họ và tên", { exact: true });
    await box.fill(`${name100}B`);
    await box.blur();
    await expect(box).toHaveAccessibleDescription("Tối đa 100 ký tự");
    await expect(next(page)).toBeDisabled();
  });

  test("B6 tới B9 lớp quá dài, SĐT sai dạng, SĐT có dấu chấm, hai SĐT trùng khác cách viết", async ({ page }) => {
    await fillInfo(page, info("Võ Thị Số Điện Thoại"));
    const cls = page.getByLabel("Lớp");
    await cls.fill("A".repeat(21));
    await cls.blur();
    await expect(cls).toHaveAccessibleDescription("Tối đa 20 ký tự");
    await cls.fill("11 a3");

    const phone = page.getByLabel("SĐT", { exact: true });
    for (const bad of ["091234567", "09123456789", "1912345678", "+84912345678", "0912-345-678", "abcdefghij"]) {
      await phone.fill(bad);
      await phone.blur();
      await expect(phone, bad).toHaveAccessibleDescription(PHONE_ERROR);
      await expect(next(page)).toBeDisabled();
    }
    await phone.fill("0912.345.678");
    await expect(phone).not.toHaveAccessibleDescription(PHONE_ERROR);
    const parent = page.getByLabel("SĐT phụ huynh");
    await parent.fill("0912 345 678");
    await parent.blur();
    await expect(parent).toHaveAccessibleDescription("SĐT phụ huynh phải khác SĐT học sinh.");
    await expect(next(page)).toBeDisabled();
  });

  test("B10 Enter gửi form; Enter hai lần liền và bấm đúp chỉ tạo một hồ sơ", async ({ page }) => {
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/customers") posts += 1;
    });
    await fillInfo(page, info("Đỗ Bấm Hai Lần"));
    await page.getByLabel("SĐT phụ huynh").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    expect(posts).toBe(1);

    await page.evaluate(() => localStorage.removeItem("mgi.token"));
    await page.reload();
    await fillInfo(page, info("Đỗ Bấm Đúp"));
    await next(page).dblclick();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
    expect(posts).toBe(2);
  });

  test("B11 mất mạng lúc bấm Tiếp tục: báo lỗi mạng, nút bật lại, gửi lại được", async ({ page }) => {
    await fillInfo(page, info("Hồ Mất Mạng"));
    await page.route("**/api/customers", (r) => r.abort("internetdisconnected"));
    await next(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(NETWORK);
    await expect(next(page)).toBeEnabled();
    await page.unroute("**/api/customers");
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
  });

  test("B12 trường đóng sau khi mở form: bấm Tiếp tục báo Trường đã đóng., không tạo hồ sơ", async ({ page }) => {
    await onDevice(page, device(SCHOOL.closing));
    await page.goto("/");
    await expect(page.getByText(NAME.schoolClosing)).toBeVisible();
    await fillInfo(page, info("Trường Vừa Đóng"));
    await dbOp("school", SCHOOL.closing, "closed");
    try {
      await next(page).click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText("Trường đã đóng.");
      expect(await page.evaluate(() => localStorage.getItem("mgi.token"))).toBeNull();
    } finally {
      await dbOp("school", SCHOOL.closing, "open");
    }
  });

  test("B4, B5 họ tên có khoảng trắng thừa và ký tự đặc biệt: màn kết quả hiện nguyên văn đã gọn, không có hộp alert", async ({ page, request }) => {
    const dialogs = watchDialogs(page);
    const raw = `  <img src=x onerror=alert(1)>   '"\\%_  😀 '; DROP TABLE customers;--  `;
    const name = raw.trim().replace(/\s+/g, " ");
    await fillInfo(page, info(raw, { className: " 12 a1 " }));
    await next(page).click();
    await page.getByRole("button", { name: NAME.p1 }).click();
    await page.getByRole("button", { name: NAME.p3 }).click();
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
    const s = await fromDevice(page);
    await apiPhotos(request, s);
    await apiSubmit(request, s);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${name} - 12A1`);
    expect(dialogs).toEqual([]);
    expect(await page.locator("img[src='x']").count()).toBe(0);
  });

  test("B14 trường chưa có ngân hàng: không có khối ngân hàng đã có, gửi xong thấy hết lượt", async ({ page }) => {
    await onDevice(page, device(SCHOOL.empty));
    await page.goto("/");
    await expect(page.getByText(NAME.schoolEmpty)).toBeVisible();
    await expect(page.getByRole("group", { name: "Ngân hàng đã có tài khoản" })).toHaveCount(0);
    await fillInfo(page, info("Không Ngân Hàng"));
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Ngân hàng đã hết lượt trong tháng này" })).toBeVisible();
  });

  test("B16 mọi ngân hàng của trường hết lượt: vẫn có ô tick đủ ngân hàng, tick đủ thì thấy Không có ngân hàng nào phù hợp", async ({ page, request }) => {
    dbOp("reset", SCHOOL.quota);
    dbOp("quota", CODE.q2, "1");
    try {
      await apiPick(request, await apiCreate(request, SCHOOL.quota, info("Lấy Hết Lượt B1")), [BANK.q1, BANK.q2]);
      await onDevice(page, device(SCHOOL.quota));
      await page.goto("/");
      await expect(page.getByText(NAME.schoolQuota)).toBeVisible();
      const banks = page.getByRole("group", { name: "Ngân hàng đã có tài khoản" });
      await expect(banks.getByRole("checkbox")).toHaveCount(2);
      await fillInfo(page, info("Có Đủ Ngân Hàng Hết Lượt"));
      for (const name of [NAME.q1, NAME.q2]) await banks.getByRole("checkbox", { name, exact: true }).check();
      await next(page).click();
      await expect(page.getByRole("heading", { name: "Không có ngân hàng nào phù hợp" })).toBeVisible();
    } finally {
      dbOp("reset", SCHOOL.quota);
    }
  });

  test("B17 ô tick cạnh tên ngân hàng rất dài, có và không có dấu cách, cạnh tên ngắn: ô tick giữ 18 px", async ({ page }) => {
    for (const school of [SCHOOL.long, SCHOOL.mixed]) {
      await onDevice(page, device(school));
      await page.goto("/");
      const boxes = page.getByRole("group", { name: "Ngân hàng đã có tài khoản" }).getByRole("checkbox");
      await expect(boxes).toHaveCount(2);
      await expectBoxSize(boxes, 18, 18);
      await expectNoSideScroll(page);
    }
  });

  test("B15 tick đủ mọi ngân hàng của trường thì thấy Không có ngân hàng nào phù hợp", async ({ page }) => {
    await fillInfo(page, info("Có Đủ Ngân Hàng"));
    for (const name of [NAME.p1, NAME.p3, NAME.p4]) await page.getByRole("checkbox", { name }).check();
    await next(page).click();
    await expect(page.getByRole("heading", { name: "Không có ngân hàng nào phù hợp" })).toBeVisible();
  });
});
