import { readFileSync } from "node:fs";
import { bankScreen } from "../../../tests/support/bankScreen";
import { VIDEO_PASSWORD, VIDEO_USERS } from "../../../scripts/video-data";
import { expect, loginAs, openMenu, test } from "../support";

const BANK = "Vietcombank";
const { manager, lan, mai } = VIDEO_USERS;
const logo = (file: string) => ({ name: file, mimeType: "image/webp", buffer: readFileSync(`scripts/data/bank-logos/${file}`) });
const label = (u: { staffCode: string; fullName: string; title: string }) => `${u.staffCode} - ${u.fullName} - ${u.title}`;

test("Ngân hàng: thêm ngân hàng có logo, giao người quản, cài hướng dẫn mở tài khoản, tắt và bật lại", async ({ page }) => {
  const row = () => page.getByRole("row", { name: new RegExp(BANK) });

  await test.step("Manager đăng nhập, mở Ngân hàng & mã giới thiệu", async () => {
    await loginAs(page, manager.username, VIDEO_PASSWORD);
    await openMenu(page, "Ngân hàng", "Cấu hình dữ liệu");
    await expect(page.getByRole("row", { name: /MB Bank/ })).toContainText(lan.fullName);
  });

  await test.step("Thêm ngân hàng: nhập mã, độ ưu tiên, tên", async () => {
    await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
    const form = page.getByRole("dialog", { name: "Thêm ngân hàng" });
    await form.getByLabel("Mã ngân hàng").fill("VCB");
    await form.getByLabel("Độ ưu tiên").fill("10");
    await form.getByLabel("Tên ngân hàng").fill(BANK);
  });

  await test.step("Chọn logo; chọn nhầm ảnh thì bấm vào ô Logo để đổi", async () => {
    const form = page.getByRole("dialog", { name: "Thêm ngân hàng" });
    const pick = async (button: string, file: string) => {
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), form.getByRole("button", { name: button }).click()]);
      await chooser.setFiles(logo(file));
      await expect(form.getByRole("button", { name: "Đổi logo" }).locator("img")).toHaveJSProperty("complete", true, { timeout: 30_000 });
    };
    await pick("Chọn logo", "ctg.webp");
    const first = await form.getByRole("button", { name: "Đổi logo" }).locator("img").getAttribute("src");
    await page.waitForTimeout(1000);
    await pick("Đổi logo", "vcb.webp");
    await expect(form.getByRole("button", { name: "Đổi logo" }).locator("img")).not.toHaveAttribute("src", first!);
  });

  await test.step("Giao người quản: gõ mã tài khoản hoặc tên", async () => {
    const form = page.getByRole("dialog", { name: "Thêm ngân hàng" });
    const box = form.getByRole("combobox", { name: "Người quản ngân hàng này" });
    await box.pressSequentially(mai.staffCode, { delay: 80 });
    await page.getByRole("option", { name: label(mai) }).click();
    await box.clear();
    await box.pressSequentially("lan", { delay: 80 });
    await page.getByRole("option", { name: label(lan) }).click();
    await form.getByRole("button", { name: "Tạo ngân hàng" }).click();
    await expect(form).toHaveCount(0);
    for (const u of [mai, lan]) await expect(row()).toContainText(u.fullName);
    await expect.poll(() => row().locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  await test.step("Sửa ngân hàng: logo hiện tại, gỡ một người quản, đổi độ ưu tiên", async () => {
    await page.getByRole("button", { name: `Sửa ngân hàng ${BANK}` }).click();
    const form = page.getByRole("dialog", { name: "Sửa ngân hàng" });
    await expect(form.getByRole("button", { name: "Đổi logo" }).locator("img")).toBeVisible();
    await form.getByRole("button", { name: `Bỏ ${lan.fullName}` }).click();
    await form.getByLabel("Độ ưu tiên").fill("3");
    await form.getByRole("button", { name: "Lưu" }).click();
    await expect(form).toHaveCount(0);
    await expect(row()).not.toContainText(lan.fullName);
    await expect(row().getByRole("cell").nth(2)).toHaveText("3");
  });

  await test.step("Cài hướng dẫn mở tài khoản: các bước, ảnh cần nộp có ảnh mẫu, mục kiểm trên ảnh", async () => {
    await page.getByRole("button", { name: `Hướng dẫn mở tài khoản ${BANK}` }).click();
    const guide = page.getByRole("dialog", { name: `Hướng dẫn mở tài khoản - ${BANK}` });
    await guide.getByLabel("Các bước").fill(
      ["Tải app VCB Digibank, chọn Mở tài khoản.", "Chụp CCCD hai mặt và khuôn mặt theo hướng dẫn trên app.", "Nhập mã giới thiệu ghim bên dưới.", "Chụp màn hình mở tài khoản thành công."].join("\n"),
    );
    const slot = (n: number) => guide.locator("div", { has: page.getByLabel(`Tên ảnh ${n}`) }).last();
    // Ngân hàng chưa có hướng dẫn thì hộp có sẵn khung ảnh 1, tick sẵn cả hai mục kiểm; khung thêm sau không tick mục nào.
    const fillSlot = async (n: number, name: string) => {
      await guide.getByLabel(`Tên ảnh ${n}`).fill(name);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), guide.getByRole("button", { name: `Đổi ảnh mẫu của ${name}` }).click()]);
      await chooser.setFiles({ name: "anh-mau.png", mimeType: "image/png", buffer: Buffer.from(await bankScreen({ name: "NGUYEN VAN AN", code: "LQD-VCB-01" }, "png")) });
      await expect(guide.getByRole("button", { name: `Đổi ảnh mẫu của ${name}` }).locator("img")).toBeVisible({ timeout: 30_000 });
    };
    await fillSlot(1, "Ảnh nhập mã giới thiệu");
    await slot(1).getByLabel("Họ tên").uncheck();
    await guide.getByRole("button", { name: "Thêm ảnh" }).click();
    await fillSlot(2, "Ảnh thông tin tài khoản");
    await slot(2).getByLabel("Họ tên").check();
    await guide.getByRole("button", { name: "Thêm ảnh" }).click();
    await guide.getByLabel("Tên ảnh 3").fill("Ảnh giao dịch");
    await guide.getByRole("button", { name: "Bỏ Ảnh giao dịch" }).click();
    await expect(guide.getByLabel("Tên ảnh 3")).toHaveCount(0);
    await guide.getByRole("button", { name: "Lưu" }).click();
    await expect(guide).toHaveCount(0);
    await expect(row().getByText("2 ảnh")).toBeVisible();
  });

  await test.step("Tắt ngân hàng", async () => {
    await row().getByRole("button", { name: "Tắt", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Tắt ngân hàng" });
    await expect(confirm).toContainText(`Tắt ${BANK}?`);
    await confirm.getByRole("button", { name: "Tắt", exact: true }).click();
    await expect(row()).toContainText("Đã tắt");
  });

  await test.step("Bật lại ngân hàng", async () => {
    await row().getByRole("button", { name: "Bật lại", exact: true }).click();
    await page.getByRole("dialog", { name: "Bật lại ngân hàng" }).getByRole("button", { name: "Bật lại", exact: true }).click();
    await expect(row()).toContainText("Đang triển khai");
  });
});
