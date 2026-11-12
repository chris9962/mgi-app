import { Search, X } from "lucide-react";
import Link from "next/link";
import { SEARCH_MAX_LENGTH } from "@/lib/search";

type Props = { action: string; placeholder: string; defaultValue: string; hidden?: Record<string, string>; label?: string };

// Ô tìm gửi bằng form GET: kết quả lọc ở máy chủ, giữ được trên URL. Số đo chép SearchField.module.scss của mgst-app; viền giữ --field-border để đạt 3:1.
export function SearchBox({ action, placeholder, defaultValue, hidden = {}, label = placeholder }: Props) {
  const id = `search${action.replace(/\W/g, "-")}`;
  const rest = new URLSearchParams(hidden).toString();
  return (
    <form role="search" action={action} className="relative inline-flex items-center mobile:min-w-40">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Search size={15} aria-hidden className="pointer-events-none absolute left-[11px] text-text-3" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name="q"
        maxLength={SEARCH_MAX_LENGTH}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-h-[34px] w-[210px] rounded-[10px] border border-field-border bg-card py-1.5 pr-[30px] pl-8 text-[13px] leading-[1.55] text-text caret-accent placeholder:text-text-3 hover:border-text/45 focus-visible:border-accent focus-visible:outline-offset-0 mobile:w-full"
      />
      {/* Vùng bấm 44 px bằng ::after, hình nút vẫn 24 px trong ô. */}
      {defaultValue !== "" && (
        <Link
          href={rest ? `${action}?${rest}` : action}
          aria-label="Xoá từ khoá tìm"
          className="absolute right-[5px] grid size-6 place-items-center rounded-full text-text-2 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 hover:bg-surface hover:text-text"
        >
          <X size={15} aria-hidden />
        </Link>
      )}
    </form>
  );
}
