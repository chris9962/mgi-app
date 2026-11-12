"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

type Theme = "light" | "dark";
type Accent = "orange" | "blue" | "cyan" | "pink" | "slate";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

const ACCENTS: { value: Accent; label: string }[] = [
  { value: "orange", label: "Cam" },
  { value: "blue", label: "Xanh dương" },
  { value: "cyan", label: "Xanh ngọc" },
  { value: "pink", label: "Hồng" },
  { value: "slate", label: "Xám than" },
];

const previewVars = (theme: Theme) =>
  ({
    "--p-bg": `var(--preview-${theme}-bg)`,
    "--p-card": `var(--preview-${theme}-card)`,
    "--p-line": `var(--preview-${theme}-line)`,
    "--p-text": `var(--preview-${theme}-text)`,
    "--p-accent": `var(--preview-${theme}-accent)`,
  }) as CSSProperties;

const LEGEND = "mb-3 p-0 text-[13px] font-semibold text-text-2";
// Vòng màu quanh ảnh đã báo mục đang chọn, nên tiêu điểm bàn phím vẽ ở nhãn chữ.
const LABEL = "rounded-md px-1.5 py-px text-[13.5px] text-text-2 peer-checked:font-semibold peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";

// Thẻ html và localStorage là hệ ngoài React: ghi ở hàm ngoài component, gọi từ event handler.
function apply(key: "theme" | "accent", value: string) {
  document.documentElement.dataset[key] = value;
  localStorage.setItem(key, value);
}

// mb-2 ở mỗi nhóm cộng khoảng 14 px của Dialog thành 22 px như .group của mgst-app.
// Chép hộp Giao diện của mgst-app: đổi là áp ngay, không có nút Lưu. Chỉ dựng khi mở nên đọc được thẻ html ngay lúc khởi tạo.
export function AppearanceDialog({ onClose }: { onClose: () => void }) {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  const [accent, setAccentState] = useState<Accent>(() => (document.documentElement.dataset.accent as Accent | undefined) ?? "orange");

  function setTheme(value: Theme) {
    apply("theme", value);
    setThemeState(value);
  }

  function setAccent(value: Accent) {
    apply("accent", value);
    setAccentState(value);
  }

  return (
    <Dialog open title="Giao diện" onClose={onClose} footer={<Button onClick={onClose}>Xong</Button>}>
      <fieldset className="m-0 mb-2 min-w-0 border-0 p-0">
        <legend className={LEGEND}>Chế độ</legend>
        <div className="grid grid-cols-2 gap-[18px]">
          {THEMES.map((t) => (
            <label key={t.value} className="group flex cursor-pointer flex-col items-center gap-2">
              <input type="radio" name="appearance-theme" className="peer sr-only" checked={theme === t.value} onChange={() => setTheme(t.value)} />
              <span
                aria-hidden
                style={previewVars(t.value)}
                className="flex aspect-[16/10] w-full overflow-hidden rounded-[10px] border border-(--p-line) bg-(--p-bg) shadow-(--elev-sm) outline-offset-2 not-peer-checked:group-hover:outline-[3px] not-peer-checked:group-hover:outline-line-strong peer-checked:outline-[3px] peer-checked:outline-accent"
              >
                <span className="flex w-[28%] flex-none flex-col gap-1.5 border-r border-(--p-line) bg-(--p-card) px-[7px] py-2.5">
                  <span className="h-[7px] rounded-[3px] bg-(--p-accent)" />
                  <span className="h-[7px] rounded-[3px] bg-(--p-text) opacity-[0.14]" />
                  <span className="h-[7px] rounded-[3px] bg-(--p-text) opacity-[0.14]" />
                  <span className="h-[7px] rounded-[3px] bg-(--p-text) opacity-[0.14]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
                  <span className="flex flex-1 flex-col gap-1.5 rounded-md border border-(--p-line) bg-(--p-card) p-2">
                    <span className="h-[5px] w-[85%] rounded-[3px] bg-(--p-text) opacity-30" />
                    <span className="h-[5px] w-[55%] rounded-[3px] bg-(--p-text) opacity-[0.16]" />
                    <span className="mt-auto h-[5px] w-[45%] rounded-[3px] bg-(--p-accent)" />
                  </span>
                  <span className="h-[11px] w-[34%] self-end rounded bg-(--p-accent)" />
                </span>
              </span>
              <span className={LABEL}>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 mb-2 min-w-0 border-0 p-0">
        <legend className={LEGEND}>Màu chủ đạo</legend>
        <div className="flex flex-wrap gap-[22px]">
          {ACCENTS.map((a) => (
            <label key={a.value} className="group flex min-w-11 cursor-pointer flex-col items-center gap-2 pt-1">
              <input type="radio" name="appearance-accent" className="peer sr-only" checked={accent === a.value} onChange={() => setAccent(a.value)} />
              <span
                aria-hidden
                style={{ background: `var(--swatch-${a.value})` }}
                className="grid size-[30px] place-items-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--text)_15%,transparent)] outline-offset-[3px] not-peer-checked:group-hover:outline-2 not-peer-checked:group-hover:outline-line-strong peer-checked:outline-2 peer-checked:outline-text peer-checked:[&>span]:opacity-100"
              >
                <span className="size-[9px] rounded-full bg-(--preview-light-card) opacity-0" />
              </span>
              <span className={LABEL}>{a.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}
