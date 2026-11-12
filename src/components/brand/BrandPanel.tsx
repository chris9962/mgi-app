import Image from "next/image";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

// Chép bố cục khối nhận diện của mgst-app. Màu cam #e8763a là màu bộ nhận diện, không phải màu nhấn của giao diện.
export function BrandPanel() {
  return (
    <div aria-hidden className="relative flex-[6] overflow-hidden bg-white mobile:hidden">
      <div className="absolute inset-0 bg-[#e8763a] [clip-path:polygon(0_0,40%_0,72%_100%,0_100%)]" />
      <div className="absolute top-11 right-[46px] flex items-center gap-[13px]">
        <Image src="/brand/logo.png" alt="" width={50} height={50} className="rounded-full" />
        <span className="whitespace-nowrap text-[clamp(18px,2.2vw,25px)] font-bold text-[#1b1b1b] uppercase">{BRAND_NAME}</span>
      </div>
      <div className="absolute top-[47%] left-1/2 aspect-square w-[clamp(200px,42%,318px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-[15px] shadow-[0_10px_34px_rgb(27_27_27/14%)]">
        <Image src="/brand/photo.jpg" alt="" width={318} height={318} sizes="318px" className="size-full rounded-full object-cover" />
      </div>
      <div className="absolute bottom-16 left-12 flex flex-col gap-1 text-white">
        <span className="text-[clamp(15px,1.7vw,20px)] font-semibold tracking-[0.13em]">CÔNG TY TNHH</span>
        <span className="self-start border-b-[3px] border-white/85 pb-[9px] text-[clamp(26px,3.4vw,40px)] leading-[1.1] font-extrabold whitespace-pre-line uppercase">
          {/* Tên dài hơn tên cũ: một dòng thì tràn ra ngoài khối cam, chữ trắng nằm trên nền trắng. */}
          {BRAND_NAME.replace(/ (\S+)$/, "\n$1")}
        </span>
        <span className="mt-[9px] text-[15px] font-semibold text-[#1b1b1b] italic">“{BRAND_SLOGAN}”</span>
      </div>
    </div>
  );
}
