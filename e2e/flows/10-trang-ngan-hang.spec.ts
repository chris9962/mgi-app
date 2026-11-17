import type { Page } from "@playwright/test";
import { E2E_STUDENT_SCHOOL } from "../../scripts/e2e-data";
import { apiStudent, chapter, expect, loginAs, logout, openMenu, search, test } from "./support";

const NAME = "Lương Thị Hai Dòng";
const VPB = "ZZE2E HS VPBank";
const TPB = "ZZE2E HS TPBank";

const table = (page: Page) => page.getByRole("region", { name: "Ngân hàng", exact: true });
const rowsOf = (page: Page) => table(page).getByRole("row", { name: new RegExp(NAME) });
const sections = (page: Page) => page.getByRole("navigation", { name: "Mục lọc" });

test("Flow 10: trang Ngân hàng nhóm Nghiệp vụ: 2 ngân hàng ra 2 dòng, tìm, lọc, Nhân viên chỉ thấy ngân hàng mình quản", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  await apiStudent(page, { fullName: NAME, className: "10a1", parentPhone: "0977555777" }, [VPB, TPB]);

  await test.step("Quản trị mở trang Ngân hàng trong nhóm Nghiệp vụ", async () => {
    await openMenu(page, "Ngân hàng", "Nghiệp vụ");
    await expect(page).toHaveURL(/\/customer-banks$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ngân hàng" })).toBeVisible();
    await expect(table(page).getByRole("columnheader").first()).toHaveText(/^Ngày/);
  });

  await test.step("Lọc theo trường", async () => {
    await page.getByRole("button", { name: "Bộ lọc" }).click();
    await sections(page).getByRole("button", { name: "Trường" }).click();
    await page.getByRole("combobox", { name: "Trường" }).pressSequentially("hoc sinh", { delay: 60 });
    await page.getByRole("option", { name: new RegExp(E2E_STUDENT_SCHOOL) }).click();
    await expect(page).toHaveURL(/school=/);
    await page.getByRole("button", { name: "Xong" }).click();
    await expect(page.getByText(`Trường: ${E2E_STUDENT_SCHOOL}`)).toBeVisible();
    const schools = await table(page).locator("tbody tr td:nth-child(5)").allTextContents();
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.every((s) => s.includes(E2E_STUDENT_SCHOOL))).toBe(true);
  });

  await test.step("Tìm theo tên: học sinh chọn 2 ngân hàng ra 2 dòng", async () => {
    await search(page, "Họ tên, SĐT phụ huynh…", "luong thi hai dong");
    await expect(rowsOf(page)).toHaveCount(2);
    await expect(rowsOf(page).nth(0)).toContainText(VPB);
    await expect(rowsOf(page).nth(0)).toContainText("HS-VPBANK-01");
    await expect(rowsOf(page).nth(1)).toContainText(TPB);
    await expect(rowsOf(page).nth(1)).toContainText("Chờ kiểm tra");
  });

  await test.step("Lọc theo ngân hàng rồi bỏ lọc", async () => {
    await page.getByRole("button", { name: /^Bộ lọc/ }).click();
    await sections(page).getByRole("button", { name: "Ngân hàng" }).click();
    await page.getByRole("checkbox", { name: TPB }).check();
    await expect(page).toHaveURL(/bank=/);
    await page.getByRole("button", { name: "Xong" }).click();
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page)).toContainText(TPB);
    await page.getByRole("link", { name: `Bỏ lọc Ngân hàng: ${TPB}` }).click();
    await expect(rowsOf(page)).toHaveCount(2);
  });

  await test.step("Bấm tên ngân hàng mở Trang 4 của học sinh", async () => {
    await rowsOf(page).nth(1).getByRole("link", { name: TPB }).click();
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await logout(page);
  });

  await test.step("Nhân viên quản VPBank chỉ thấy dòng VPBank, không có mục lọc Ngân hàng", async () => {
    await chapter(page, "Nhân viên quản một ngân hàng");
    await loginAs(page, "zz_e2e_reviewer");
    await openMenu(page, "Ngân hàng", "Nghiệp vụ");
    await search(page, "Họ tên, SĐT phụ huynh…", "luong thi hai dong");
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page)).toContainText(VPB);
    await page.getByRole("button", { name: "Bộ lọc" }).click();
    await expect(sections(page).getByRole("button", { name: "Ngân hàng" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
});
