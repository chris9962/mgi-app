import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../../deploy/systemd/", import.meta.url);
const unit = (name: string) => readFileSync(new URL(name, DIR), "utf8");

describe("unit systemd mẫu", () => {
  test("mỗi service chạy script có thật trong repo, từ /opt/mgi-bank, đọc .env.local", () => {
    const services = readdirSync(DIR).filter((f) => f.endsWith(".service") && !f.includes("@"));
    expect(services).toEqual(expect.arrayContaining(["mgi-bank-backup.service", "mgi-bank-backup-check.service", "mgi-bank-ops-watch.service", "mgi-bank-s3-orphans.service"]));
    for (const s of services) {
      const text = unit(s);
      const script = text.match(/^ExecStart=\S+ (scripts\/\S+\.ts)/m)?.[1];
      expect(script, s).toBeDefined();
      expect(existsSync(new URL(`../../${script}`, import.meta.url)), s).toBe(true);
      expect(text, s).toContain("WorkingDirectory=/opt/mgi-bank");
      expect(text, s).toContain("EnvironmentFile=/opt/mgi-bank/.env.local");
      expect(text, s).toMatch(/^OnFailure=mgi-bank-alert@%n\.service$/m);
    }
  });

  test("sao lưu mỗi giờ 06:00 tới 23:00, kiểm bản mới nhất lúc 08:00, cả hai chạy bù khi máy chủ bật lại", () => {
    expect(unit("mgi-bank-backup.timer")).toContain("OnCalendar=*-*-* 06..23:00:00");
    expect(unit("mgi-bank-backup-check.timer")).toContain("OnCalendar=*-*-* 08:00:00");
    for (const t of ["mgi-bank-backup.timer", "mgi-bank-backup-check.timer"]) expect(unit(t)).toContain("Persistent=true");
    expect(unit("mgi-bank-backup.service")).toContain("EnvironmentFile=/opt/mgi-bank/.env.backup");
  });

  test("ops-watch chạy mãi và tự chạy lại khi thoát", () => {
    const text = unit("mgi-bank-ops-watch.service");
    expect(text).toContain("Restart=always");
    expect(text).toContain("WantedBy=multi-user.target");
  });

  test("dọn object mồ côi chạy mỗi ngày lúc 03:30", () => {
    expect(unit("mgi-bank-s3-orphans.timer")).toContain("OnCalendar=*-*-* 03:30:00");
    expect(unit("mgi-bank-s3-orphans.service")).toContain("scripts/s3-orphans.ts");
  });
});
