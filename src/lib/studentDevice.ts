type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = { schoolId: "mgi.schoolId", customerId: "mgi.customerId", token: "mgi.token" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSchoolId = (v: string | null | undefined): v is string => typeof v === "string" && UUID.test(v);

export type Device = { schoolId: string | null; customerId: string | null; token: string | null };

export function readDevice(store: Store): Device {
  const schoolId = store.getItem(KEY.schoolId);
  return { schoolId: isSchoolId(schoolId) ? schoolId : null, customerId: store.getItem(KEY.customerId), token: store.getItem(KEY.token) };
}

export const saveSchool = (store: Store, schoolId: string) => store.setItem(KEY.schoolId, schoolId);

export function saveProfile(store: Store, customerId: string, token: string) {
  store.setItem(KEY.customerId, customerId);
  store.setItem(KEY.token, token);
}

// Hồ sơ cũ vẫn nằm trong DB cho hậu kiểm; máy chỉ quên token.
export function clearProfile(store: Store) {
  store.removeItem(KEY.customerId);
  store.removeItem(KEY.token);
}

const SCHOOL_LINK = /\/t\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

// Bỏ qua tên miền trong QR: QR in sẵn cho tên miền thật vẫn mở được ở máy thử.
export const schoolIdInLink = (text: string): string | null => SCHOOL_LINK.exec(text)?.[1].toLowerCase() ?? null;

export type LinkDecision = { kind: "keep" } | { kind: "switch"; schoolId: string } | { kind: "ask"; schoolId: string };

// Id sai thì bỏ, không báo gì; chỉ hỏi khi đổi trường làm mất hồ sơ đang có trên máy.
export function decideLink({ linkId, linkFound, storedId, hasProfile }: { linkId: string; linkFound: boolean; storedId: string | null; hasProfile: boolean }): LinkDecision {
  if (!linkFound || linkId === storedId) return { kind: "keep" };
  return storedId && hasProfile ? { kind: "ask", schoolId: linkId } : { kind: "switch", schoolId: linkId };
}
