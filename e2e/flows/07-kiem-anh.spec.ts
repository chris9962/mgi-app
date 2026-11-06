import { readFileSync } from "node:fs";
import { bankScreen } from "../../tests/support/bankScreen";
import { apiStudent, chapter, expect, logLines, loginAs, note, openMenu, photoCheckWorker, search, test, type Screen } from "./support";

const VPB = "ZZE2E HS VPBank";
const TPB = "ZZE2E HS TPBank";
const WRONG = "Lý Thị Kiểm Ảnh";
const RIGHT = "Lâm Văn Kiểm Ảnh";
// Worker đọc OCR_PYTHON từ .env.local; máy chưa cài OCR thì bỏ qua flow này.
const ocrReady = /^OCR_PYTHON=.+$/m.test(readFileSync(".env.local", "utf8"));

const screen = async (name: string, code: string): Promise<Screen> => ({ name: "man-hinh.png", mimeType: "image/png", buffer: Buffer.from(await bankScreen({ name, code }, "png")) });

test("Flow 7: ảnh lưu WebP, worker kiểm ảnh một vòng, Trang 4 hiện kết quả từng khung, Trang 3 lọc theo kết quả", async ({ page }) => {
  test.skip(!ocrReady, "Thiếu OCR_PYTHON trong .env.local");
  await loginAs(page, "zz_e2e_admin");
  // Ảnh TPBank của học sinh thứ nhất có mã dư một số (HS-TPBANK-010) nên phải không đạt.
  await apiStudent(page, { fullName: WRONG, className: "10a4", phone: "0977000111", parentName: "Lý Văn Ảnh", parentPhone: "0977000222" }, [VPB, TPB], {
    screens: { [VPB]: await screen("LÝ THỊ KIỂM ẢNH", "HS-VPBANK-01"), [TPB]: await screen("LÝ THỊ KIỂM ẢNH", "HS-TPBANK-010") },
  });
  await apiStudent(page, { fullName: RIGHT, className: "10a4", phone: "0977000333", parentName: "Lâm Văn Bố", parentPhone: "0977000444" }, [VPB, TPB], {
    screens: { [VPB]: await screen("LÂM VĂN KIỂM ẢNH", "HS-VPBANK-01"), [TPB]: await screen("LÂM VĂN KIỂM ẢNH", "HS-TPBANK-01") },
  });

  const vpb = page.getByRole("region", { name: VPB });
  const tpb = page.getByRole("region", { name: TPB });

  await test.step("Ảnh học sinh nộp lưu ở dạng WebP, chưa kiểm", async () => {
    await openMenu(page, "Hồ sơ học sinh");
    await search(page, "Họ tên, SĐT phụ huynh…", "ly thi kiem anh");
    await page.getByRole("link", { name: WRONG }).click();
    await expect(page.getByRole("heading", { level: 1, name: WRONG })).toBeVisible();
    await expect(vpb.getByRole("region", { name: "Xác thực ảnh" })).toContainText("Đang kiểm");
    const src = (await vpb.getByRole("img", { name: `Ảnh màn hình chính của ${WRONG}` }).getAttribute("src"))!;
    const redirect = await page.request.get(src, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const location = redirect.headers().location;
    const key = /proofs\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.webp$/.exec(new URL(location).pathname)?.[0];
    expect(key).toBeTruthy();
    const image = await page.request.get(location);
    expect(image.headers()["content-type"]).toBe("image/webp");
    await note(page, ["Ảnh màn hình chính trên S3:", key!, `${image.headers()["content-type"]}, ${Math.round((await image.body()).length / 1024)} KB`], 4000);
  });

  await test.step("Worker kiểm ảnh chạy một vòng", async () => {
    await chapter(page, "Worker kiểm ảnh chạy một vòng");
    const out = photoCheckWorker();
    await note(page, ["Log của worker kiểm ảnh:", ...logLines(out, "[photo-check-worker]")], 3000);
  });

  await test.step("Trang 4 hiện kết quả từng khung", async () => {
    await page.reload();
    const vpbCheck = vpb.getByRole("region", { name: "Xác thực ảnh" });
    await expect(vpbCheck.getByRole("listitem")).toHaveCount(1);
    await expect(vpbCheck.getByRole("listitem")).toContainText("Đạt");
    await expect(vpbCheck).toContainText("Ảnh màn hình chính");
    await expect(vpbCheck).toContainText(`Hệ thống: ${WRONG} - HS-VPBANK-01`);
    const tpbCheck = tpb.getByRole("region", { name: "Xác thực ảnh" });
    await tpbCheck.scrollIntoViewIfNeeded();
    await expect(tpbCheck).toContainText("Không đạt");
    await expect(tpbCheck).toContainText("Không tìm thấy mã giới thiệu HS-TPBANK-01 trong ảnh.");
    await expect(vpb.getByText("Chờ kiểm tra")).toBeVisible();
  });

  await test.step("Trang 3 hiện x/y từng ngân hàng", async () => {
    await openMenu(page, "Hồ sơ học sinh");
    await search(page, "Họ tên, SĐT phụ huynh…", "kiem anh");
    const wrong = page.getByRole("row", { name: new RegExp(WRONG) });
    await expect(wrong).toContainText("Xác thực ảnh 1/1");
    await expect(wrong).toContainText("Xác thực ảnh 0/1");
    await expect(page.getByRole("row", { name: new RegExp(RIGHT) }).getByText("Xác thực ảnh 1/1")).toHaveCount(2);
  });

  await test.step("Trang 3 lọc theo kết quả xác thực ảnh", async () => {
    const rows = page.getByRole("region", { name: "Hồ sơ học sinh" }).getByRole("row");
    await page.getByRole("button", { name: "Bộ lọc" }).click();
    await page.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Xác thực ảnh" }).click();
    await page.getByRole("radio", { name: "Đủ khung đạt" }).check();
    await expect(page).toHaveURL(/check=full/);
    await expect(rows).toHaveCount(3);
    await page.getByRole("radio", { name: "Có khung không đạt" }).check();
    await expect(page).toHaveURL(/check=missing/);
    await expect(rows).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Xác thực ảnh: Có khung không đạt")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(WRONG) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(RIGHT) })).toHaveCount(0);
  });
});
