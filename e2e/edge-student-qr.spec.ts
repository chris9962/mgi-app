import { expect, test } from "@playwright/test";
import { NAME, SCHOOL } from "../scripts/e2e-data-student";
import { PHONE, STUDENT, cameraOptions, qrCamera, withEdgeData } from "./edge-student-support";

// QR in sẵn mang tên miền thật: máy thử vẫn phải đọc ra id trường.
test.use({ ...PHONE, ...cameraOptions(qrCamera(`https://bank.minhgroup-i.com.vn/t/${SCHOOL.photo}`)) });
withEdgeData();

test("A15 camera thấy QR link trường mang tên miền thật: vào B1 của trường đó", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quét mã QR" }).click();
  await expect(page.getByRole("dialog", { name: "Quét mã QR" }).getByLabel("Camera")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(`${STUDENT}/`);
  expect(await page.evaluate(() => localStorage.getItem("mgi.schoolId"))).toBe(SCHOOL.photo);
});

test("A18 quét QR lúc mạng lỗi: Thử lại vào B1 của trường vừa quét", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/schools/**", (r) => (calls++ === 0 ? r.abort("internetdisconnected") : r.continue()));
  await page.goto("/");
  await page.getByRole("button", { name: "Quét mã QR" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Không tải được" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Thông tin" })).toBeVisible();
  await expect(page.getByText(NAME.schoolPhoto)).toBeVisible();
});
