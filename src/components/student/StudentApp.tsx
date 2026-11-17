"use client";

import { QrCode, TriangleAlert } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { clsx } from "clsx";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { BRAND_SHORT } from "@/lib/brand";
import type { CustomerSelfEditInput } from "@/lib/customerForm";
import { clearProfile, decideLink, isSchoolId, readDevice, saveSchool } from "@/lib/studentDevice";
import { studentApi } from "@/lib/studentApi";
import type { StudentSchool, StudentState } from "@/lib/studentState";
import { AppHead, Bottom, EndBlock, HeadSlotContext, StepNavContext, Steps } from "./parts";
import { BanksFull, ChooseBanks, NoBank } from "./ChooseBanks";
import { GiftDialog } from "./GiftDialog";
import { InfoForm } from "./InfoForm";
import { OpenAccount } from "./OpenAccount";
import { Result } from "./Result";
import { QrScanner } from "./QrScanner";

type Screen =
  | { kind: "loading" }
  // link: id trường của link hay QR chưa kiểm xong; Thử lại phải kiểm lại đúng trường đó.
  | { kind: "error"; message: string; link?: string }
  | { kind: "noSchool" }
  | { kind: "closed"; school: StudentSchool }
  | { kind: "ask"; current: StudentSchool; next: StudentSchool }
  | { kind: "form"; school: StudentSchool }
  | { kind: "edit"; school: StudentSchool; info: CustomerSelfEditInput }
  | { kind: "profile"; state: StudentState; notice?: string };

const NETWORK = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
// Như màn đăng nhập của mgst-app: máy chủ có trả lời mà lỗi (502 lúc khởi động lại, 500, 429) thì không bảo học sinh kiểm tra mạng.
const LATER = "Thử lại sau ít phút.";
const loadFailed = (status: number, link?: string): Screen => ({ kind: "error", message: status === 0 ? NETWORK : LATER, link });

const PROFILE_STEP = { new: 2, no_bank: 2, banks_selected: 3, pending_review: 4, reviewed: 4 };
// Còn ngân hàng đang chọn thì vẫn ở bước 3 dù đã gửi ngân hàng khác; đang mở thêm thì ở bước 2.
const stepOf = (s: Screen, adding = false) =>
  s.kind === "form" || s.kind === "edit" ? 1 : s.kind === "profile" ? (adding ? 2 : s.state.banks.some((b) => b.status === "selected") ? 3 : PROFILE_STEP[s.state.customer.status]) : 0;

async function fetchSchool(id: string): Promise<StudentSchool | null | { failed: number }> {
  const r = await studentApi<StudentSchool>("GET", `/api/schools/${id}`);
  if (r.ok) return r.data;
  return r.status === 404 ? null : { failed: r.status };
}

async function resolveScreen(linkId?: string): Promise<Screen> {
  const device = readDevice(localStorage);
  if (linkId !== undefined) {
    const linked = isSchoolId(linkId) ? await fetchSchool(linkId) : null;
    if (linked && "failed" in linked) return loadFailed(linked.failed, linkId);
    // Cắt URL về / để lần sau mở web là vào đúng trường và bước đang dở.
    history.replaceState(null, "", "/");
    const decision = decideLink({ linkId, linkFound: Boolean(linked), storedId: device.schoolId, hasProfile: Boolean(device.token) });
    if (decision.kind === "ask" && linked) {
      const current = await fetchSchool(device.schoolId!);
      if (current && "failed" in current) return loadFailed(current.failed, linkId);
      if (current) return { kind: "ask", current, next: linked };
    }
    if (decision.kind !== "keep") {
      clearProfile(localStorage);
      saveSchool(localStorage, linkId);
      return resolveScreen();
    }
  }
  if (!device.schoolId) return { kind: "noSchool" };
  if (device.token) {
    const me = await studentApi<StudentState>("GET", "/api/customers/me");
    if (me.ok) return { kind: "profile", state: me.data };
    // Câu mặc định "Không lưu được" của studentApi sai nghĩa ở màn tải.
    if (me.status !== 401) return loadFailed(me.status);
    clearProfile(localStorage);
  }
  const school = await fetchSchool(device.schoolId);
  if (school && "failed" in school) return loadFailed(school.failed);
  if (!school) {
    localStorage.removeItem("mgi.schoolId");
    return { kind: "noSchool" };
  }
  return school.active ? { kind: "form", school } : { kind: "closed", school };
}

export function StudentApp({ linkId }: { linkId?: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [scanning, setScanning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const loads = useRef(0);
  // Lùi bước (Quay lại chọn ngân hàng) thì màn mới trượt vào từ bên trái.
  const [back, setBack] = useState(false);
  const lastStep = useRef(0);
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null);
  const [pendingStep, setPendingStep] = useState<1 | 2 | null>(null);
  const backHandle = useRef<((step: 1 | 2) => void) | null>(null);
  // Màn Kết quả bấm Mở thêm ngân hàng: về bước 2 chọn trong số ngân hàng còn lại.
  const [adding, setAdding] = useState(false);
  // Hộp khai tài khoản nhận quà 20.000 đồng: mở ngay sau khi gửi ngân hàng thứ hai, hay từ màn Kết quả.
  const [giftOpen, setGiftOpen] = useState(false);

  // Đồng bộ với localStorage và máy chủ lúc mở web: máy giữ trường và token, máy chủ giữ hồ sơ.
  useEffect(() => {
    let stale = false;
    resolveScreen(linkId).then((s) => {
      if (stale) return;
      lastStep.current = stepOf(s);
      setScreen(s);
    });
    return () => {
      stale = true;
    };
  }, [linkId]);

  // Lần tải cũ về muộn (trang hiện lại lúc mạng chậm rồi ảnh vừa nộp xong) không được đè màn của lần tải mới.
  const go = async (link?: string, notice?: string) => {
    const load = ++loads.current;
    const next = await resolveScreen(link);
    if (load !== loads.current) return;
    setBack(stepOf(next) < lastStep.current);
    lastStep.current = stepOf(next);
    setPendingStep(null);
    setAdding(false);
    setScreen(next.kind === "profile" ? { ...next, notice } : next);
  };

  // Trả câu lỗi cho màn đang đứng; mở được màn sửa thì trả null.
  const editInfo = async (schoolId: string): Promise<string | null> => {
    const load = ++loads.current;
    const [info, school] = await Promise.all([studentApi<CustomerSelfEditInput>("GET", "/api/customers/me/info"), fetchSchool(schoolId)]);
    if (load !== loads.current) return null;
    // 401, 409: hồ sơ đã đổi ở máy chủ (đã gửi kiểm tra ở tab khác): tải lại để màn khớp máy chủ.
    if (!info.ok && (info.status === 401 || info.status === 409)) {
      await go();
      return null;
    }
    if (!info.ok) return info.status === 0 ? NETWORK : LATER;
    if (!school || "failed" in school) return school?.failed === 0 ? NETWORK : LATER;
    setBack(true);
    lastStep.current = 1;
    setPendingStep(null);
    setScreen({ kind: "edit", school, info: info.data });
    return null;
  };

  // Học sinh qua app ngân hàng rồi quay lại web: tải lại hồ sơ để có link ảnh mới và trạng thái mới.
  const refresh = useEffectEvent(() => {
    if (document.visibilityState === "visible") go();
  });
  const onProfile = screen.kind === "profile";
  useEffect(() => {
    if (!onProfile) return;
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [onProfile]);

  const hasHead = screen.kind === "closed" || screen.kind === "form" || screen.kind === "edit" || screen.kind === "profile";
  const step = stepOf(screen, adding);
  const profile = screen.kind === "profile" ? screen.state : null;
  // Trường đóng lúc chưa chọn ngân hàng thì màn chỉ có tiêu đề "Trường đã đóng", không có thanh bước.
  const showSteps = step >= 1 && step <= 3 && (!profile || profile.school.active || step === 3);
  const canBack = profile !== null && profile.school.active;
  return (
    <HeadSlotContext value={headSlot}>
      <StepNavContext value={{ pending: pendingStep, setPending: setPendingStep, handle: backHandle }}>
        <header className="mb-4 flex items-center gap-2.5 py-3">
          <Image src="/brand/logo.png" alt="" width={36} height={36} priority className="flex-none rounded-full shadow-sm" />
          {!hasHead && <span className="text-[13px] font-semibold tracking-wide text-text-2">{BRAND_SHORT}</span>}
          <div ref={setHeadSlot} className={clsx("min-w-0 flex-1 flex-col", hasHead ? "flex" : "hidden")} />
          {showSteps && <Steps current={step as 1 | 2 | 3} pendingStep={pendingStep} onBack={canBack ? (target) => backHandle.current?.(target) : undefined} />}
        </header>
        {/* Khoá theo bước: tải lại hồ sơ trong cùng bước (nộp ảnh, quay lại web) không chạy lại chuyển động và không mất state của màn. */}
        <div key={`${screen.kind}:${step}`} data-dir={back ? "back" : undefined} className={clsx("flex flex-1 flex-col", screen.kind !== "loading" && "anim-step")}>
          {body()}
        </div>
      </StepNavContext>
    </HeadSlotContext>
  );

  function body() {
    switch (screen.kind) {
      case "loading":
        return (
          // Trễ 200 ms: mạng nhanh thì không chớp vòng xoay.
          <p role="status" className="anim-fade flex flex-col items-center gap-3 py-16 text-center text-sm text-text-2 [animation-delay:200ms]">
            <span aria-hidden className="size-7 animate-spin rounded-full border-[3px] border-line border-t-accent" />
            Đang tải
          </p>
        );
      case "error":
        return (
          <>
            <EndBlock main icon={<TriangleAlert size={26} />} title="Không tải được" hint={screen.message} />
            <Bottom>
              {/* Như ErrorState của mgst-app: aria-disabled thay disabled để tiêu điểm không rời nút giữa lúc chờ. */}
              <Button
                large
                block
                aria-disabled={retrying || undefined}
                onClick={async () => {
                  if (retrying) return;
                  setRetrying(true);
                  await go(screen.link);
                  setRetrying(false);
                }}
              >
                {retrying ? "Đang thử lại" : "Thử lại"}
              </Button>
            </Bottom>
          </>
        );
      case "noSchool":
        return (
          <>
            <EndBlock main icon={<QrCode size={26} />} title="Chưa có trường" hint="Quét mã QR dán ở trường." />
            <Bottom>
              <Button large block onClick={() => setScanning(true)}>
                Quét mã QR
              </Button>
            </Bottom>
            {scanning && (
              <QrScanner
                onClose={() => setScanning(false)}
                onSchool={(id) => {
                  setScanning(false);
                  setScreen({ kind: "loading" });
                  go(id);
                }}
              />
            )}
          </>
        );
      case "closed":
        return <AppHead title="Trường đã đóng" subtitle={screen.school.name} />;
      case "ask":
        return <SwitchSchool current={screen.current} next={screen.next} onSwitch={() => go()} onKeep={() => go()} />;
      case "form":
        return (
          <>
            <AppHead title="Thông tin" subtitle={screen.school.name} />
            <InfoForm school={screen.school} onSaved={() => go()} />
          </>
        );
      case "edit":
        return (
          <>
            <AppHead title="Thông tin" subtitle={screen.school.name} />
            <InfoForm school={screen.school} initial={screen.info} onSaved={() => go()} />
          </>
        );
      case "profile":
        return (
          <Profile
            state={screen.state}
            notice={screen.notice}
            adding={adding}
            onAddMore={() => {
              setBack(true);
              lastStep.current = 2;
              setAdding(true);
            }}
            giftOpen={giftOpen}
            onGift={setGiftOpen}
            onChange={(notice) => go(undefined, notice)}
            onEdit={() => editInfo(screen.state.school.id)}
          />
        );
    }
  }
}

type ProfileProps = {
  state: StudentState;
  notice?: string;
  adding: boolean;
  onAddMore: () => void;
  giftOpen: boolean;
  onGift: (open: boolean) => void;
  onChange: (notice?: string) => Promise<void>;
  onEdit: () => Promise<string | null>;
};

const INFO_LOCKED = "Đã gửi kiểm tra, không sửa được thông tin.";

function Profile({ state, notice, adding, onAddMore, giftOpen, onGift, onChange, onEdit }: ProfileProps) {
  const { status } = state.customer;
  if (!state.school.active && (status === "new" || status === "no_bank")) return <AppHead title="Trường đã đóng" subtitle={state.school.name} />;
  const gift = giftOpen && state.gift.eligible && !state.gift.claim && <GiftDialog gift={state.gift} fullName={state.customer.fullName} onClose={() => onGift(false)} onSaved={() => onChange()} />;
  // Gửi xong ngân hàng thứ hai thì hỏi tài khoản nhận quà ngay.
  const onSubmitted = (submitted: number) => submitted >= 2 && onGift(true);
  switch (status) {
    case "new":
      if (!state.eligibleBanks.length) return <BanksFull state={state} onEdit={onEdit} />;
      return <ChooseBanks key={state.eligibleBanks.map((b) => b.id).join()} state={state} notice={notice} onDone={onChange} onEdit={onEdit} />;
    case "no_bank":
      return <NoBank state={state} onEdit={onEdit} />;
    case "banks_selected":
      return <OpenAccount state={state} onChange={() => onChange()} onEdit={onEdit} onSubmitted={onSubmitted} />;
    case "pending_review":
    case "reviewed":
      // Gửi kiểm tra từng ngân hàng: còn ngân hàng đang chọn thì vẫn ở bước 3; đã gửi hết thì xem kết quả, mở thêm được nếu còn ngân hàng.
      if (state.banks.some((b) => b.status === "selected"))
        return (
          <>
            <OpenAccount
              state={state}
              onChange={() => onChange()}
              onEdit={onEdit}
              onSubmitted={onSubmitted}
              onBackToBanks={async () => {
                await onChange();
                onAddMore();
              }}
            />
            {gift}
          </>
        );
      if (adding && state.eligibleBanks.length) return <ChooseBanks key={state.eligibleBanks.map((b) => b.id).join()} state={state} notice={notice} onDone={onChange} onEdit={async () => INFO_LOCKED} />;
      return (
        <>
          <Result state={state} onAddMore={state.school.active && state.eligibleBanks.length > 0 ? onAddMore : undefined} onGift={() => onGift(true)} />
          {gift}
        </>
      );
  }
}

function SwitchSchool({ current, next, onSwitch, onKeep }: { current: StudentSchool; next: StudentSchool; onSwitch: () => void; onKeep: () => void }) {
  return (
    <section aria-labelledby="switch-title" className="my-auto flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h1 id="switch-title" className="text-lg font-semibold">
        Đổi trường
      </h1>
      <p className="text-sm">
        Máy này đang dùng {current.name}. Link vừa mở là của {next.name}.
      </p>
      <p className="text-sm">Đổi trường thì thông tin đã khai trên máy này sẽ mất.</p>
      <Button
        variant="danger"
        large
        block
        onClick={() => {
          clearProfile(localStorage);
          saveSchool(localStorage, next.id);
          onSwitch();
        }}
      >
        Đổi trường
      </Button>
      <Button variant="secondary" large block onClick={onKeep}>
        Giữ trường cũ
      </Button>
    </section>
  );
}
