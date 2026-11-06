import { STUDENT, apiStudent, chapter, expect, loginAs, openMenu, search, test, useStudentDevice } from "./support";

const NAME = "Ngô Thị Hậu Kiểm";
const VPB = "ZZE2E HS VPBank";
const TPB = "ZZE2E HS TPBank";

test("Flow 5: hậu kiểm Đạt ngân hàng 1, Không đạt ngân hàng 2 rồi đổi sang Đạt; voucher ở Trang 4, Trang 12; học sinh chỉ thấy QR PVI", async ({ page }) => {
  let voucher = "";

  await test.step("Học sinh đã khai, chọn VPBank và TPBank, nộp ảnh, gửi kiểm tra", async () => {
    const student = await apiStudent(page, { fullName: NAME, className: "12c2", phone: "0933222444", parentName: "Ngô Văn Phụ", parentPhone: "0977123456" }, [VPB, TPB]);
    await useStudentDevice(page, student);
  });

  await test.step("Nhân viên quản hai ngân hàng mở hồ sơ ở Trang 3", async () => {
    await chapter(page, "Nhân viên hậu kiểm", "E2E Kiểm hai ngân hàng quản VPBank và TPBank");
    await loginAs(page, "zz_e2e_kiem");
    await openMenu(page, "Hồ sơ học sinh");
    await search(page, "Họ tên, SĐT phụ huynh…", "ngo thi hau kiem");
    await expect(page.getByRole("row", { name: new RegExp(NAME) })).toContainText("Chờ");
    await page.getByRole("link", { name: NAME }).click();
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  const vpb = page.getByRole("region", { name: VPB });
  const tpb = page.getByRole("region", { name: TPB });

  await test.step("Xem ảnh từng khung và khối Xác thực ảnh", async () => {
    for (const slot of ["Ảnh màn hình chính", "Ảnh chuyển khoản"]) {
      const img = vpb.getByRole("img", { name: `${slot} của ${NAME}` });
      await img.scrollIntoViewIfNeeded();
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(vpb.getByRole("region", { name: "Xác thực ảnh" })).toContainText("Đang kiểm");
    await expect(tpb.getByRole("img", { name: `Ảnh màn hình chính của ${NAME}` })).toBeVisible();
  });

  await test.step("Đánh dấu Đạt ngân hàng 1, voucher hiện ở khối SMS", async () => {
    await vpb.getByRole("button", { name: "Đạt", exact: true }).click();
    await page.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt" }).click();
    await expect(vpb.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);
    const sms = page.getByRole("region", { name: "SMS cho phụ huynh" });
    await expect(sms.locator("dd").first()).toHaveText(/^ZZE2ETHPTHS-NTHK-12C2-[23456789A-HJKMNP-Z]{4}$/);
    voucher = (await sms.locator("dd").first().textContent())!.trim();
  });

  await test.step("Đánh dấu Không đạt ngân hàng 2", async () => {
    await tpb.getByRole("button", { name: "Không đạt", exact: true }).click();
    await page.getByRole("dialog", { name: "Đánh dấu Không đạt" }).getByRole("button", { name: "Không đạt" }).click();
    await expect(tpb.getByRole("button", { name: "Không đạt", exact: true })).toHaveCount(0);
    await expect(tpb.getByText("Không đạt").first()).toBeVisible();
  });

  await test.step("Đổi Không đạt sang Đạt, không cấp thêm voucher", async () => {
    await tpb.getByRole("button", { name: "Đạt", exact: true }).click();
    await page.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt" }).click();
    await expect(tpb.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "SMS cho phụ huynh" }).locator("dd").first()).toHaveText(voucher);
  });

  await test.step("Voucher hiện ở Trang 12 Mã voucher", async () => {
    await openMenu(page, "Mã voucher");
    await search(page, "Mã voucher, họ tên…", "ngo thi hau kiem");
    await expect(page.getByRole("row", { name: new RegExp(voucher) })).toContainText(NAME);
    await expect(page.getByRole("region", { name: "Mã voucher" }).getByRole("row")).toHaveCount(2);
  });

  await test.step("Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher", async () => {
    await chapter(page, "Học sinh mở lại web");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STUDENT}/`);
    await expect(page.getByRole("heading", { name: `${NAME} - 12C2` })).toBeVisible();
    await expect(page.getByRole("list", { name: "Ngân hàng đã gửi" }).getByRole("listitem").filter({ hasText: /Đạt$/ })).toHaveCount(2);
    await expect(page.getByRole("img", { name: "QR mở app PVI" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mở app PVI" })).toBeVisible();
    await expect(page.getByText(/voucher/i)).toHaveCount(0);
    await expect(page.getByText(voucher)).toHaveCount(0);
  });
});
