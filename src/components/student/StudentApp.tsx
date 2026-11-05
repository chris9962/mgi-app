"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { clearProfile, decideLink, isSchoolId, readDevice, saveSchool } from "@/lib/studentDevice";
import { studentApi } from "@/lib/studentApi";
import type { StudentSchool, StudentState } from "@/lib/studentState";
import { AppHead, Bottom, EndBlock, Steps } from "./parts";
import { ChooseBanks, NoBank } from "./ChooseBanks";
import { InfoForm } from "./InfoForm";
import { QrScanner } from "./QrScanner";

type Screen =
  | { kind: "loading" }
  | { kind: "error"; message: string }
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
    if (linked === "error") return { kind: "error", message: NETWORK };
    // Cắt URL về / để lần sau mở web là vào đúng trường và bước đang dở.
    history.replaceState(null, "", "/");
    const decision = decideLink({ linkId, linkFound: Boolean(linked), storedId: device.schoolId, hasProfile: Boolean(device.token) });
    if (decision.kind === "ask" && linked) {
      const current = await fetchSchool(device.schoolId!);
      if (current === "error") return { kind: "error", message: NETWORK };
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
    if (me.status !== 401) return { kind: "error", message: me.message };
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
          <EndBlock title="Không tải được" hint={screen.message} />
          <Bottom>
            <Button large block onClick={() => go()}>
              Thử lại
            </Button>
          </Bottom>
        </>
      );
    case "noSchool":
      return (
        <>
          <EndBlock title="Chưa có trường" hint="Quét mã QR dán ở trường." />
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
      return (
        <>
          <AppHead school={screen.school.name} title="Trường đã đóng" />
          <EndBlock title="Trường đã đóng" />
        </>
      );
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

function Profile({ state, notice, onChange }: { state: StudentState; notice?: string; onChange: (notice?: string) => void }) {
  switch (state.customer.status) {
    case "new":
      return <ChooseBanks key={state.eligibleBanks.map((b) => b.id).join()} state={state} notice={notice} onDone={onChange} />;
    case "no_bank":
      return <NoBank state={state} />;
    default:
      return <AppHead school={state.school.name} title={`${state.customer.fullName} - ${state.customer.className}`} />;
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
