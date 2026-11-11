"use client";

import { QrCode, TriangleAlert } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import type { CustomerSelfEditInput } from "@/lib/customerForm";
import { clearProfile, decideLink, isSchoolId, readDevice, saveSchool } from "@/lib/studentDevice";
import { studentApi } from "@/lib/studentApi";
import type { StudentSchool, StudentState } from "@/lib/studentState";
import { AppHead, Bottom, EndBlock, Steps } from "./parts";
import { BanksFull, ChooseBanks, NoBank } from "./ChooseBanks";
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
const stepOf = (s: Screen) => (s.kind === "form" || s.kind === "edit" ? 1 : s.kind === "profile" ? PROFILE_STEP[s.state.customer.status] : 0);

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

  // Khoá theo bước: tải lại hồ sơ trong cùng bước (nộp ảnh, quay lại web) không chạy lại chuyển động và không mất state của màn.
  return (
    <div key={`${screen.kind}:${stepOf(screen)}`} data-dir={back ? "back" : undefined} className={clsx("flex flex-1 flex-col", screen.kind !== "loading" && "anim-step")}>
      {body()}
    </div>
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
        return <AppHead school={screen.school.name} title="Trường đã đóng" />;
      case "ask":
        return <SwitchSchool current={screen.current} next={screen.next} onSwitch={() => go()} onKeep={() => go()} />;
      case "form":
        return (
          <>
            <AppHead school={screen.school.name} title="Thông tin" />
            <Steps current={1} />
            <InfoForm school={screen.school} onSaved={() => go()} />
          </>
        );
      case "edit":
        return (
          <>
            <AppHead school={screen.school.name} title="Thông tin" />
            <Steps current={1} />
            <InfoForm school={screen.school} initial={screen.info} onSaved={() => go()} />
          </>
        );
      case "profile":
        return <Profile state={screen.state} notice={screen.notice} onChange={(notice) => go(undefined, notice)} onEdit={() => editInfo(screen.state.school.id)} />;
    }
  }
}

type ProfileProps = { state: StudentState; notice?: string; onChange: (notice?: string) => Promise<void>; onEdit: () => Promise<string | null> };

function Profile({ state, notice, onChange, onEdit }: ProfileProps) {
  const { status } = state.customer;
  if (!state.school.active && (status === "new" || status === "no_bank")) return <AppHead school={state.school.name} title="Trường đã đóng" />;
  switch (status) {
    case "new":
      if (!state.eligibleBanks.length) return <BanksFull state={state} onEdit={onEdit} />;
      return <ChooseBanks key={state.eligibleBanks.map((b) => b.id).join()} state={state} notice={notice} onDone={onChange} onEdit={onEdit} />;
    case "no_bank":
      return <NoBank state={state} onEdit={onEdit} />;
    case "banks_selected":
      return <OpenAccount state={state} onChange={() => onChange()} onEdit={onEdit} />;
    case "pending_review":
    case "reviewed":
      return <Result state={state} />;
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
