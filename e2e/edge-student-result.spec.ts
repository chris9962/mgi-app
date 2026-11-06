import { expect, test, type Page } from "@playwright/test";
import { BANK, NAME, SCHOOL } from "../scripts/e2e-data-student";
import { PHONE, apiCreate, apiPhotos, apiPick, apiSubmit, dbOp, device, expectInsideScreen, expectNoSideScroll, info, onDevice, withEdgeData, type ApiStudent } from "./edge-student-support";

// Máy đặt múi giờ khác Việt Nam: màn kết quả vẫn phải hiện giờ Việt Nam.
test.use({ ...PHONE, timezoneId: "America/New_York" });
withEdgeData();

const LONG_NAME = "NguyễnThịMinhKhai".repeat(6).slice(0, 100);
const LONG_CLASS = "12A1CHUYENTOANTINHOC";

async function submitted(request: import("@playwright/test").APIRequestContext, fullName = LONG_NAME): Promise<ApiStudent> {
  const s = await apiCreate(request, SCHOOL.long, info(fullName, { className: LONG_CLASS }));
  await apiPick(request, s, [BANK.longSpace, BANK.longWord]);
  await apiPhotos(request, s);
  await apiSubmit(request, s);
  return s;
}

const banks = (page: Page) => page.getByRole("list", { name: "Ngân hàng đã gửi" });

test("F1, F2, F4, F5 họ tên 100 ký tự không dấu cách, tên ngân hàng dài, gửi lúc 23:30 giờ Việt Nam: chữ xuống dòng, giờ Việt Nam, chưa có khối App PVI", async ({ page, request }) => {
  expect(LONG_NAME.length).toBe(100);
  const s = await submitted(request);
  dbOp("submitted", s.id, "2026-11-05T16:30:00Z");
  await onDevice(page, device(SCHOOL.long, s));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${LONG_NAME} - ${LONG_CLASS}`);
  await expect(page.getByText("Đã gửi 05/11/2026 23:30. Nhân viên kiểm tra trong giờ làm việc.")).toBeVisible();
  await expect(banks(page).getByRole("listitem")).toHaveCount(2);
  await expect(banks(page).getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "App PVI" })).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectInsideScreen(page, banks(page).getByText("Chờ kiểm tra"));
  await expectInsideScreen(page, page.getByRole("heading", { level: 1 }));

  dbOp("submitted", s.id, "2026-11-05T17:30:00Z");
  await page.reload();
  await expect(page.getByText("Đã gửi 06/11/2026 00:30. Nhân viên kiểm tra trong giờ làm việc.")).toBeVisible();
});

test("F3, F6, F7 có voucher, một ngân hàng Đạt một Không đạt: khối App PVI có QR và nút Mở app PVI, không có chữ voucher, câu không đạt xuống dòng", async ({ page, request }) => {
  const s = await submitted(request, "Phạm Có Quà");
  dbOp("voucher", s.id);
  dbOp("review", s.id, "passed,failed");
  const { pviAppUrl } = await s.me();
  await onDevice(page, device(SCHOOL.long, s));
  await page.goto("/");
  await expect(page.getByText(/^Kiểm tra xong \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
  await expect(banks(page).getByText(/^(✓\s*)?Đạt$/)).toHaveCount(1);
  await expect(banks(page).getByText("Không đạt", { exact: true })).toHaveCount(1);
  await expect(page.getByText(`${NAME.bankLongWord} không đạt: nhân viên gọi cho phụ huynh để hướng dẫn.`)).toBeVisible();
  await expect(page.getByText(`${NAME.bankLongSpace} không đạt`)).toHaveCount(0);
  if (pviAppUrl) {
    const pvi = page.getByRole("region", { name: "App PVI" });
    await expect(pvi.getByRole("img", { name: "QR mở app PVI" })).toBeVisible();
    const open = pvi.getByRole("link", { name: "Mở app PVI" });
    await expect(open).toHaveAttribute("href", pviAppUrl);
    await expect(open).toHaveAttribute("target", "_blank");
    await expectInsideScreen(page, open);
  }
  await expect(page.getByText(/voucher/i)).toHaveCount(0);
  await expect(page.getByText(/ZZE2E-HSB/)).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectInsideScreen(page, banks(page).locator("li > *"));

  await page.reload();
  await expect(banks(page).getByText("Không đạt", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Gửi kiểm tra" })).toHaveCount(0);
});
