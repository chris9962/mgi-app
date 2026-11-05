"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Số đo là trạng thái hiện tại: mở trang rồi để đó mà số đứng yên thì người xem tưởng hàng chờ không nhúc nhích.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
