import { Search } from "lucide-react";

// Ô tìm gửi bằng form GET: kết quả lọc ở máy chủ, giữ được trên URL.
export function SearchBox({ action, placeholder, defaultValue, hidden = {} }: { action: string; placeholder: string; defaultValue: string; hidden?: Record<string, string> }) {
  return (
    <form role="search" action={action} className="relative narrow:w-full">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3" />
      <label htmlFor={`search${action.replace(/\W/g, "-")}`} className="sr-only">
        {placeholder}
      </label>
      <input
        id={`search${action.replace(/\W/g, "-")}`}
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-9 w-64 rounded-[10px] border border-field-border bg-card pr-3 pl-9 text-sm placeholder:text-text-3 narrow:w-full"
      />
    </form>
  );
}
