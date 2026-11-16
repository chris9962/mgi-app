import { apiReview, apiStudent, bankOf, chapter, expect, logLines, loginAs, note, openMenu, search, smsRefused, smsWorker, test } from "./support";

const VPB = "ZZE2E HS VPBank";
const TPB = "ZZE2E HS TPBank";
const SENT = { fullName: "Vũ Thị Gửi Được", className: "10a2", phone: "0933100200", parentPhone: "0977100200" };
const REFUSED = { fullName: "Đặng Văn Lỗi Số", className: "10a2", phone: "0933300400", parentPhone: "0977300400" };
const FIXED_PHONE = "0977300499";

test("Flow 6: worker gửi SMS ghi log; tin lỗi 3 lần hiện ở Tin SMS lỗi, sửa SĐT, Gửi lại", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  const sent = await apiStudent(page, SENT, [VPB, TPB]);
  const refused = await apiStudent(page, REFUSED, [VPB, TPB]);

  await test.step("Ngân hàng đầu Đạt: tin SMS cho phụ huynh đang chờ gửi", async () => {
    await apiReview(page, bankOf(sent, VPB).id, "passed");
    await page.goto(`/customers/${sent.id}`);
    const sms = page.getByRole("region", { name: "SMS cho phụ huynh" });
    await expect(sms).toContainText("Đang gửi");
    await expect(sms).toContainText("Lần gửi 0/3");
  });

  await test.step("Worker SMS chạy một vòng: gửi tin, ghi log", async () => {
    await chapter(page, "Worker SMS chạy một vòng");
    const out = smsWorker();
    const lines = logLines(out, "[sms]");
    expect(lines.some((l) => l.includes(`tới ${SENT.parentPhone}`))).toBe(true);
    await note(page, ["Log của worker SMS:", ...lines.map((l) => l.slice(0, 160))], 4000);
    await page.reload();
    const sms = page.getByRole("region", { name: "SMS cho phụ huynh" });
    await expect(sms).toContainText("Đã gửi");
    await expect(sms).toContainText("0977 100 200");
  });

  await test.step("Học sinh thứ hai Đạt; nhà mạng từ chối số phụ huynh 3 lần", async () => {
    await apiReview(page, bankOf(refused, VPB).id, "passed");
    const out = smsRefused(REFUSED.parentPhone, 3);
    expect(out).toContain("vòng 3: gửi 0, chờ thử lại 0, lỗi 1");
    await note(page, ["Gửi tin cho Đặng Văn Lỗi Số:", ...logLines(out, "[sms-refused]")], 4000);
  });

  await test.step("Tin SMS lỗi: sidebar đếm tin lỗi, bảng ghi lỗi và 3/3 lần gửi", async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: /Tin SMS lỗi/ })).toContainText("tin lỗi");
    await openMenu(page, "Tin SMS lỗi");
    await search(page, "Họ tên, SĐT…", "dang van loi so");
    const row = page.getByRole("row", { name: new RegExp(REFUSED.fullName) });
    await expect(row).toContainText("Nhà mạng từ chối số này");
    await expect(row).toContainText("3/3");
    await expect(row).toContainText("0977 300 400");
  });

  await test.step("Sửa SĐT nhận, bấm Gửi lại", async () => {
    await page.getByRole("button", { name: `Gửi lại tin cho ${REFUSED.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Gửi lại tin SMS" });
    await dialog.getByLabel("SĐT nhận").fill("0977 300 499");
    await dialog.getByRole("button", { name: "Gửi lại" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(REFUSED.fullName) })).toHaveCount(0);
  });

  await test.step("Worker gửi lại tới số mới: tin sang Đã gửi", async () => {
    const out = smsWorker();
    expect(out).toContain(`tới ${FIXED_PHONE}`);
    await note(page, ["Log của worker SMS:", ...logLines(out, "[sms]").map((l) => l.slice(0, 160))], 4000);
    await page.getByRole("link", { name: "Bỏ lọc Trạng thái: Lỗi" }).click();
    await page.waitForURL(/status=all/);
    const row = page.getByRole("row", { name: new RegExp(REFUSED.fullName) });
    await expect(row).toContainText("Đã gửi");
    await expect(row).toContainText("0977 300 499");
    await expect(row).toContainText("1/3");
  });
});
