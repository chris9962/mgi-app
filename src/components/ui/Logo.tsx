import Image from "next/image";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

export function Logo({ size = 32, withAppName = false, priority = false }: { size?: number; withAppName?: boolean; priority?: boolean }) {
  const mark = <Image src="/brand/logo.png" alt={withAppName ? "" : BRAND_NAME} width={size} height={size} priority={priority} className="flex-none rounded-full" />;
  if (!withAppName) return mark;
  return (
    <span className="inline-flex items-center gap-3">
      {mark}
      <span className="flex flex-col leading-[1.15]">
        <strong className="text-xl font-semibold">{BRAND_NAME}</strong>
        <span className="text-[13px] text-text-2">{BRAND_SLOGAN}</span>
      </span>
    </span>
  );
}
