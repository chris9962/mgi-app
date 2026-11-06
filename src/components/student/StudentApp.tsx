"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
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
  | { kind: "profile"; state: StudentState; notice?: string };

const NETWORK = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";

async function fetchSchool(id: string): Promise<StudentSchool | null | "error"> {
  const r = await studentApi<StudentSchool>("GET", `/api/schools/${id}`);
  if (r.ok) return r.data;
  return r.status === 404 ? null : "error";
}

async function resolveScreen(linkId?: string): Promise<Screen> {
  const device = readDevice(localStorage);
  if (linkId !== undefined) {
    const linked = isSchoolId(linkId) ? await fetchSchool(linkId) : null;
    if (linked === "error") return { kind: "error", message: NETWORK, link: linkId };
    // Cắt URL về / để lần sau mở web là vào đúng trường và bước đang dở.
    history.replaceState(null, "", "/");
    const decision = decideLink({ linkId, linkFound: Boolean(linked), storedId: device.schoolId, hasProfile: Boolean(device.token) });
    if (decision.kind === "ask" && linked) {
      const current = await fetchSchool(device.schoolId!);
      if (current === "error") return { kind: "error", message: NETWORK, link: linkId };
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
    // Đọc hồ sơ chỉ hỏng vì mạng hoặc máy chủ chưa trả lời (502 lúc khởi động lại): câu mặc định "Không lưu được" sai nghĩa ở màn tải.
    if (me.status !== 401) return { kind: "error", message: NETWORK };
    clearProfile(localStorage);
  }
  const school = await fetchSchool(device.schoolId);
  if (school === "error") return { kind: "error", message: NETWORK };
  if (!school) {
    localStorage.removeItem("mgi.schoolId");
    return { kind: "noSchool" };
  }
  return school.active ? { kind: "form", school } : { kind: "closed", school };
}

export function StudentApp({ linkId }: { linkId?: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [scanning, setScanning] = useState(false);

  // Đồng bộ với localStorage và máy chủ lúc mở web: máy giữ trường và token, máy chủ giữ hồ sơ.
  useEffect(() => {
    let stale = false;
    resolveScreen(linkId).then((s) => !stale && setScreen(s));
    return () => {
      stale = true;
    };
  }, [linkId]);

  const go = async (link?: string, notice?: string) => {
    const next = await resolveScreen(link);
    setScreen(next.kind === "profile" ? { ...next, notice } : next);
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

  switch (screen.kind) {
    case "loading":
      return (
        <p role="status" className="py-10 text-center text-sm text-text-2">
          Đang tải
        </p>
      );
    case "error":
      return (
        <>
          <EndBlock main title="Không tải được" hint={screen.message} />
          <Bottom>
            <Button large block onClick={() => go(screen.link)}>
              Thử lại
            </Button>
          </Bottom>
        </>
      );
    case "noSchool":
      return (
        <>
          <EndBlock main title="Chưa có trường" hint="Quét mã QR dán ở trường." />
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
          <InfoForm school={screen.school} onCreated={() => go()} />
        </>
      );
    case "profile":
      return <Profile state={screen.state} notice={screen.notice} onChange={(notice) => go(undefined, notice)} />;
  }
}

function Profile({ state, notice, onChange }: { state: StudentState; notice?: string; onChange: (notice?: string) => Promise<void> }) {
  const { status } = state.customer;
  if (!state.school.active && (status === "new" || status === "no_bank")) return <AppHead school={state.school.name} title="Trường đã đóng" />;
  switch (status) {
    case "new":
      if (!state.eligibleBanks.length) return <BanksFull state={state} />;
      return <ChooseBanks key={state.eligibleBanks.map((b) => b.id).join()} state={state} notice={notice} onDone={onChange} />;
    case "no_bank":
      return <NoBank state={state} />;
    case "banks_selected":
      return <OpenAccount state={state} onChange={() => onChange()} />;
    case "pending_review":
    case "reviewed":
      return <Result state={state} />;
  }
}

function SwitchSchool({ current, next, onSwitch, onKeep }: { current: StudentSchool; next: StudentSchool; onSwitch: () => void; onKeep: () => void }) {
  return (
    <section aria-labelledby="switch-title" className="my-auto flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
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
