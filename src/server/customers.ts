import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { and, asc, count, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "./db/client";
import { bankPhotoSlots, banks, customerBanks, customerExistingBanks, customers, proofPhotos, referralCodeMonths, referralCodeSchools, referralCodes, schools, smsMessages, vouchers } from "./db/schema";
import { s3PhotoStore, type PhotoStore } from "./customerPhotos";
import { syncCustomerStatus } from "./customerStatus";
import { queuePhotoChecks, type Tx } from "./photoChecks";
import { hashToken } from "./auth/session";
import { publicSchool } from "./schools";
import { getSettings } from "./settings";
import { giftState } from "./gift";
import { INSURANCE_PRODUCTS, type StudentInsurance } from "@/lib/insurance";
import { CONSENT_VERSION } from "@/lib/consent";
import { currentYearMonth, isYearMonth } from "@/lib/month";
import { maskPhone, plain } from "@/lib/text";
import type { CustomerFormValues, CustomerSelfEditInput, CustomerSelfEditValues } from "@/lib/customerForm";
import type { StudentBank, StudentBankInfo, StudentState } from "@/lib/studentState";

export type Customer = typeof customers.$inferSelect;

type Fail = { ok: false; message: string; status: 400 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });

type Executor = Pick<typeof db, "select">;

type Candidate = { id: string; bankId: string; bankName: string; bankLogoKey: string | null; bankHotline: string | null; bankOverview: string | null; bankWebsite: string | null; bankAppName: string | null; bankFoundedYear: number | null; bankHeadquarters: string | null; bankGuide: unknown; bankSort: number; code: string | null; priority: number; createdAt: Date; quota: number; used: number };

// Mã ứng viên của trường: mã đang dùng của ngân hàng đang mở, gắn cho trường. Giữ chỗ thì khoá các dòng mã trước khi đếm lượt.
async function loadCandidates(ex: Executor, schoolId: string, month: string, lock = false): Promise<Candidate[]> {
  const query = ex
    .select({
      id: referralCodes.id,
      bankId: referralCodes.bankId,
      bankName: banks.name,
      bankLogoKey: banks.logoKey,
      bankHotline: banks.hotline,
      bankOverview: banks.overview,
      bankWebsite: banks.website,
      bankAppName: banks.appName,
      bankFoundedYear: banks.foundedYear,
      bankHeadquarters: banks.headquarters,
      bankGuide: banks.guide,
      bankSort: banks.sortOrder,
      code: referralCodes.code,
      priority: referralCodes.priority,
      monthlyQuota: referralCodes.monthlyQuota,
      createdAt: referralCodes.createdAt,
    })
    .from(referralCodes)
    .innerJoin(referralCodeSchools, and(eq(referralCodeSchools.referralCodeId, referralCodes.id), eq(referralCodeSchools.schoolId, schoolId)))
    .innerJoin(banks, eq(banks.id, referralCodes.bankId))
    .where(and(eq(referralCodes.active, true), eq(banks.active, true)))
    .orderBy(referralCodes.id);
  const codes = lock ? await query.for("update", { of: referralCodes }) : await query;
  if (!codes.length) return [];
  const ids = codes.map((c) => c.id);
  // Đếm ở câu riêng sau khi đã khoá: câu đếm chạy sau lượt chờ khoá mới thấy các dòng giữ chỗ vừa commit.
  const [months, used] = await Promise.all([
    ex.select({ id: referralCodeMonths.referralCodeId, quota: referralCodeMonths.quota }).from(referralCodeMonths).where(and(inArray(referralCodeMonths.referralCodeId, ids), eq(referralCodeMonths.yearMonth, month))),
    ex
      .select({ id: customerBanks.referralCodeId, n: count() })
      .from(customerBanks)
      .where(and(inArray(customerBanks.referralCodeId, ids), eq(customerBanks.yearMonth, month)))
      .groupBy(customerBanks.referralCodeId),
  ]);
  const quotaOf = new Map(months.map((m) => [m.id, m.quota]));
  const usedOf = new Map(used.map((u) => [u.id, u.n]));
  return codes.map(({ monthlyQuota, ...c }) => ({ ...c, quota: quotaOf.get(c.id) ?? monthlyQuota, used: usedOf.get(c.id) ?? 0 }));
}

type ProgramBank = Omit<StudentBankInfo, "logoUrl"> & { logoKey: string | null };

function banksOf(candidates: Candidate[]): ProgramBank[] {
  const unique = new Map<string, Candidate>();
  for (const c of candidates) unique.set(c.bankId, c);
  return [...unique.values()].sort((a, b) => a.bankSort - b.bankSort || a.bankName.localeCompare(b.bankName, "vi")).map((c) => ({ id: c.bankId, name: c.bankName, logoKey: c.bankLogoKey, hotline: c.bankHotline, overview: c.bankOverview, website: c.bankWebsite, appName: c.bankAppName, foundedYear: c.bankFoundedYear, headquarters: c.bankHeadquarters, steps: Array.isArray(c.bankGuide) ? (c.bankGuide as string[]) : [] }));
}

const openBanksOf = (candidates: Candidate[], exclude: Set<string>) => banksOf(candidates.filter((c) => c.used < c.quota && !exclude.has(c.bankId)));

const withLogoUrls = (list: ProgramBank[], store: PhotoStore) => Promise.all(list.map(async ({ logoKey, ...b }) => ({ ...b, logoUrl: logoKey ? await store.signGet(logoKey) : null })));

// no_bank là điểm dừng: chỉ khi ngân hàng đã có phủ hết ngân hàng của chương trình ở trường (bỏ qua lượt). Hết lượt chỉ là tạm.
function hasAllBanks(candidates: Candidate[], existing: Set<string>): boolean {
  const program = new Set(candidates.map((c) => c.bankId));
  return program.size > 0 && [...program].every((id) => existing.has(id));
}

export const openBanksAtSchool = async (schoolId: string, month = currentYearMonth()) => openBanksOf(await loadCandidates(db, schoolId, month), new Set());

// Ô tick ngân hàng đã có ở B1 dùng cùng tập với hasAllBanks: ngân hàng đang hết lượt vẫn phải tick được, không thì học sinh đủ ngân hàng kẹt ở màn hết lượt.
export const programBanksAtSchool = async (schoolId: string, month = currentYearMonth(), store: PhotoStore = s3PhotoStore) => withLogoUrls(banksOf(await loadCandidates(db, schoolId, month)), store);

// Học sinh không có tài khoản: token trên điện thoại là thứ duy nhất chứng minh hồ sơ là của mình.
export function newCustomerToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

export async function customerFromRequest(request: Request): Promise<Customer | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const [row] = await db.select().from(customers).where(eq(customers.tokenHash, hashToken(token)));
  return row ?? null;
}

export async function touchCustomer(id: string): Promise<void> {
  await db.update(customers).set({ lastSeenAt: new Date() }).where(eq(customers.id, id));
}

export async function createCustomer(values: CustomerFormValues, ip: string | null, month = currentYearMonth()): Promise<{ ok: true; id: string; token: string } | Fail> {
  const school = await publicSchool(values.schoolId);
  if (!school) return fail("Không tìm thấy trường.", 404, "schoolId");
  if (!school.active) return fail("Trường đã đóng.", 409, "schoolId");
  const existing = [...new Set(values.existingBankIds)];
  if (existing.length && (await db.select({ id: banks.id }).from(banks).where(inArray(banks.id, existing))).length !== existing.length) {
    return fail("Ngân hàng không có trong danh sách.", 400, "existingBankIds");
  }
  const candidates = await loadCandidates(db, school.id, month);
  const noBank = hasAllBanks(candidates, new Set(existing));
  const { token, tokenHash } = newCustomerToken();
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customers)
      .values({
        schoolId: school.id,
        fullName: values.fullName,
        nameSearch: plain(values.fullName),
        className: values.className,
        parentPhone: values.parentPhone,
        tokenHash,
        createdIp: ip && isIP(ip) ? ip : null,
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
        status: noBank ? "no_bank" : "new",
      })
      .returning({ id: customers.id });
    if (existing.length) await tx.insert(customerExistingBanks).values(existing.map((bankId) => ({ customerId: row.id, bankId })));
    return row.id;
  });
  return { ok: true, id, token };
}

async function existingBankIds(ex: Executor, customerId: string): Promise<Set<string>> {
  const rows = await ex.select({ id: customerExistingBanks.bankId }).from(customerExistingBanks).where(eq(customerExistingBanks.customerId, customerId));
  return new Set(rows.map((r) => r.id));
}

// Thông tin đầy đủ chỉ trả trước khi gửi kiểm tra; gửi rồi thì web chỉ còn thấy SĐT đã che.
export async function ownCustomerInfo(customer: Customer): Promise<{ ok: true; info: CustomerSelfEditInput } | Fail> {
  if (customer.status === "pending_review" || customer.status === "reviewed") return fail("Hồ sơ đã gửi kiểm tra.", 409);
  const existing = await existingBankIds(db, customer.id);
  return {
    ok: true,
    info: { fullName: customer.fullName, className: customer.className, parentPhone: customer.parentPhone, existingBankIds: [...existing] },
  };
}

// Sửa B1 chỉ khi hồ sơ chưa giữ chỗ: web xoá ngân hàng đang giữ (cancelBanks) xong mới gọi tới đây.
export async function updateOwnCustomer(customer: Customer, values: CustomerSelfEditValues, month = currentYearMonth()): Promise<{ ok: true } | Fail> {
  const existing = [...new Set(values.existingBankIds)];
  if (existing.length && (await db.select({ id: banks.id }).from(banks).where(inArray(banks.id, existing))).length !== existing.length) {
    return fail("Ngân hàng không có trong danh sách.", 400, "existingBankIds");
  }
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: customers.status, schoolId: customers.schoolId, schoolActive: schools.active })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .where(eq(customers.id, customer.id))
      .for("update", { of: customers });
    if (current?.status === "banks_selected") return fail("Hồ sơ đã chọn ngân hàng.", 409);
    if (current?.status !== "new" && current?.status !== "no_bank") return fail("Hồ sơ đã gửi kiểm tra.", 409);
    if (!current.schoolActive) return fail("Trường đã đóng.", 409);
    const noBank = hasAllBanks(await loadCandidates(tx, current.schoolId, month), new Set(existing));
    await tx
      .update(customers)
      .set({ fullName: values.fullName, nameSearch: plain(values.fullName), className: values.className, parentPhone: values.parentPhone, status: noBank ? "no_bank" : "new" })
      .where(eq(customers.id, customer.id));
    await tx.delete(customerExistingBanks).where(eq(customerExistingBanks.customerId, customer.id));
    if (existing.length) await tx.insert(customerExistingBanks).values(existing.map((bankId) => ({ customerId: customer.id, bankId })));
    return { ok: true as const };
  });
}

// Mã có priority cao nhất còn lượt; cùng priority thì mã tạo trước.
const pickCode = (candidates: Candidate[], bankId: string) =>
  candidates
    .filter((c) => c.bankId === bankId && c.used < c.quota)
    .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0];

export async function reserveBanks(customer: Customer, bankIds: string[], month = currentYearMonth()): Promise<{ ok: true } | Fail> {
  if (!isYearMonth(month)) throw new Error(`Tháng giữ chỗ sai dạng: ${month}`);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: customers.status, schoolId: customers.schoolId, schoolActive: schools.active })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .where(eq(customers.id, customer.id))
      .for("update", { of: customers });
    if (!current || current.status === "no_bank") return fail("Hồ sơ đã chọn ngân hàng.", 409);
    // Mở thêm sau khi đã gửi hết ngân hàng đã chọn: còn dòng đang chọn thì phải xong bước 3 trước.
    const taken = await tx.select({ bankId: customerBanks.bankId, status: customerBanks.status, slot: customerBanks.slot }).from(customerBanks).where(eq(customerBanks.customerId, customer.id));
    if (taken.some((r) => r.status === "selected")) return fail("Hồ sơ đã chọn ngân hàng.", 409);
    // Trường đóng thì không giữ chỗ mới; học sinh đã giữ chỗ vẫn nộp ảnh và gửi kiểm tra.
    if (!current.schoolActive) return fail("Trường đã đóng.", 409);
    const candidates = await loadCandidates(tx, current.schoolId, month, true);
    const existing = new Set([...(await existingBankIds(tx, customer.id)), ...taken.map((r) => r.bankId)]);
    const open = openBanksOf(candidates, existing);
    if (!open.length) {
      if (!hasAllBanks(candidates, existing)) return fail("Ngân hàng đã hết lượt trong tháng này.", 409);
      if (taken.length) return fail("Không còn ngân hàng nào để mở thêm.", 409);
      await tx.update(customers).set({ status: "no_bank" }).where(eq(customers.id, customer.id));
      return fail("Không còn ngân hàng nào phù hợp.", 409);
    }
    const chosen = [...new Set(bankIds)];
    if (chosen.some((id) => !open.some((b) => b.id === id))) return fail("Ngân hàng vừa hết lượt. Chọn lại.", 409, "bankIds");
    // Chọn từ 1 tới hết ngân hàng còn lượt (chủ dự án chốt 2026-11-17); lượt theo tháng của từng mã vẫn tính như cũ.
    if (!chosen.length) return fail("Chọn ngân hàng.", 400, "bankIds");
    if (chosen.length !== bankIds.length) return fail("Ngân hàng bị trùng.", 400, "bankIds");
    const base = Math.max(0, ...taken.map((r) => r.slot));
    for (const [i, bankId] of chosen.entries()) {
      const code = pickCode(candidates, bankId);
      await tx.insert(referralCodeMonths).values({ referralCodeId: code.id, yearMonth: month, quota: code.quota }).onConflictDoNothing();
      await tx.insert(customerBanks).values({ customerId: customer.id, bankId, slot: base + i + 1, referralCodeId: code.id, referralCode: code.code ?? "", yearMonth: month });
    }
    await syncCustomerStatus(tx, customer.id);
    return { ok: true as const };
  });
}

// Gửi mọi ngân hàng còn đang chọn trong một lần (route /submit cũ); từng ngân hàng thì submitBank.
export async function submitForReview(customer: Customer): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    // Khoá hồ sơ trước khi kiểm ảnh: ảnh ghi cùng lúc phải chờ, không lọt vào hồ sơ đã gửi.
    const [current] = await tx.select({ status: customers.status }).from(customers).where(eq(customers.id, customer.id)).for("update");
    if (!current) return fail("Không tìm thấy hồ sơ.", 404);
    const rows = await tx
      .select({ id: customerBanks.id, bankId: customerBanks.bankId })
      .from(customerBanks)
      .where(and(eq(customerBanks.customerId, customer.id), eq(customerBanks.status, "selected")));
    if (!rows.length) return fail("Hồ sơ đã gửi kiểm tra.", 409);
    return submitRows(tx, customer.id, rows);
  });
}

// Học sinh nộp đủ ảnh một ngân hàng thì gửi riêng ngân hàng đó (chủ dự án chốt 2026-11-17); ngân hàng khác vẫn nộp tiếp.
export async function submitBank(customer: Customer, customerBankId: string): Promise<{ ok: true; submitted: number } | Fail> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ status: customers.status }).from(customers).where(eq(customers.id, customer.id)).for("update");
    if (!current) return fail("Không tìm thấy hồ sơ.", 404);
    const [row] = await tx
      .select({ id: customerBanks.id, bankId: customerBanks.bankId, status: customerBanks.status })
      .from(customerBanks)
      .where(and(eq(customerBanks.id, customerBankId), eq(customerBanks.customerId, customer.id)));
    if (!row) return fail("Không tìm thấy ngân hàng.", 404);
    if (row.status !== "selected") return fail("Ngân hàng đã gửi kiểm tra.", 409);
    const r = await submitRows(tx, customer.id, [row]);
    if (!r.ok) return r;
    const [{ n }] = await tx.select({ n: count() }).from(customerBanks).where(and(eq(customerBanks.customerId, customer.id), ne(customerBanks.status, "selected")));
    return { ok: true as const, submitted: n };
  });
}

// Mọi khung chưa bỏ của từng ngân hàng phải có ảnh; giờ gửi của hồ sơ là lần gửi đầu tiên; xếp lượt kiểm ảnh cho ngân hàng có khung bật kiểm.
async function submitRows(tx: Tx, customerId: string, rows: { id: string; bankId: string }[]): Promise<{ ok: true } | Fail> {
  {
    const [slots, photos] = await Promise.all([
      tx
        .select({ id: bankPhotoSlots.id, bankId: bankPhotoSlots.bankId, checkName: bankPhotoSlots.checkName, checkCode: bankPhotoSlots.checkCode })
        .from(bankPhotoSlots)
        .where(and(inArray(bankPhotoSlots.bankId, rows.map((r) => r.bankId)), isNull(bankPhotoSlots.removedAt))),
      tx
        .select({ customerBankId: proofPhotos.customerBankId, slotId: proofPhotos.slotId })
        .from(proofPhotos)
        .where(and(inArray(proofPhotos.customerBankId, rows.map((r) => r.id)), isNull(proofPhotos.replacedAt))),
    ]);
    const has = new Set(photos.map((p) => `${p.customerBankId}:${p.slotId}`));
    const missing = rows.some((r) => slots.some((sl) => sl.bankId === r.bankId && !has.has(`${r.id}:${sl.id}`)));
    if (missing) return fail("Còn khung chưa có ảnh.", 400);
    const now = new Date();
    await tx.update(customerBanks).set({ status: "pending", submittedAt: now }).where(inArray(customerBanks.id, rows.map((r) => r.id)));
    await tx.update(customers).set({ submittedAt: sql`coalesce(${customers.submittedAt}, ${now})` }).where(eq(customers.id, customerId));
    await syncCustomerStatus(tx, customerId);
    // Ngân hàng không có khung nào bật kiểm thì không xếp lượt kiểm ảnh.
    const checked = rows.filter((r) => slots.some((sl) => sl.bankId === r.bankId && (sl.checkName || sl.checkCode))).map((r) => r.id);
    await queuePhotoChecks(tx, checked);
    return { ok: true as const };
  }
}

async function chosenBanks(customer: Customer, store: PhotoStore): Promise<StudentBank[]> {
  const rows = await db
    .select({
      id: customerBanks.id,
      bankId: customerBanks.bankId,
      name: banks.name,
      logoKey: banks.logoKey,
      slot: customerBanks.slot,
      status: customerBanks.status,
      referralCode: customerBanks.referralCode,
      guide: banks.guide,
      qrKey: referralCodes.qrKey,
      openUrl: referralCodes.openUrl,
    })
    .from(customerBanks)
    .innerJoin(banks, eq(banks.id, customerBanks.bankId))
    .innerJoin(referralCodes, eq(referralCodes.id, customerBanks.referralCodeId))
    .where(eq(customerBanks.customerId, customer.id))
    .orderBy(asc(customerBanks.slot));
  // Hướng dẫn, mã và khung ảnh chỉ cần cho dòng đang chọn ở B3; dòng đã gửi web chỉ hiện trạng thái.
  const guide = rows.some((r) => r.status === "selected");
  const [slots, photos] = guide
    ? await Promise.all([
        db
          .select()
          .from(bankPhotoSlots)
          .where(and(inArray(bankPhotoSlots.bankId, rows.map((r) => r.bankId)), isNull(bankPhotoSlots.removedAt)))
          .orderBy(asc(bankPhotoSlots.sortOrder), asc(bankPhotoSlots.name)),
        db
          .select()
          .from(proofPhotos)
          .where(and(inArray(proofPhotos.customerBankId, rows.map((r) => r.id)), isNull(proofPhotos.replacedAt))),
      ])
    : [[], []];
  const sign = (key: string | null) => (key ? store.signGet(key) : Promise.resolve(null));
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      bankId: r.bankId,
      name: r.name,
      logoUrl: await sign(r.logoKey),
      slot: r.slot,
      status: r.status,
      referralCode: r.status === "selected" ? r.referralCode : "",
      qrUrl: r.status === "selected" ? await sign(r.qrKey) : null,
      openUrl: r.status === "selected" ? r.openUrl : null,
      steps: r.status === "selected" && Array.isArray(r.guide) ? (r.guide as string[]) : [],
      slots: await Promise.all(
        slots
          .filter((s) => r.status === "selected" && s.bankId === r.bankId)
          .map(async (s) => {
            const photo = photos.find((p) => p.customerBankId === r.id && p.slotId === s.id);
            return { id: s.id, name: s.name, sampleUrl: await sign(s.sampleKey), photo: photo ? { url: await store.signGet(photo.s3Key), sizeBytes: photo.sizeBytes ?? 0 } : null };
          }),
      ),
    })),
  );
}

export async function studentState(customer: Customer, month = currentYearMonth(), store: PhotoStore = s3PhotoStore): Promise<StudentState> {
  const [school] = await db.select({ id: schools.id, name: schools.name, active: schools.active }).from(schools).where(eq(schools.id, customer.schoolId));
  const [existing, settings] = await Promise.all([existingBankIds(db, customer.id), getSettings()]);
  const existingBanks = existing.size ? (await db.select({ name: banks.name }).from(banks).where(inArray(banks.id, [...existing])).orderBy(asc(banks.sortOrder), asc(banks.name))).map((b) => b.name) : [];
  let status = customer.status;
  const chosen = await chosenBanks(customer, store);
  const hasSelected = chosen.some((b) => b.status === "selected");
  let eligibleBanks: StudentState["eligibleBanks"] = [];
  // Hồ sơ mới, hay đã gửi hết ngân hàng đã chọn: tính ngân hàng còn mở thêm được, bỏ ngân hàng đã có dòng.
  if (status === "new" || (!hasSelected && (status === "pending_review" || status === "reviewed"))) {
    const candidates = await loadCandidates(db, customer.schoolId, month);
    eligibleBanks = await withLogoUrls(openBanksOf(candidates, new Set([...existing, ...chosen.map((b) => b.bankId)])), store);
    if (status === "new" && !eligibleBanks.length && hasAllBanks(candidates, existing)) {
      await db.update(customers).set({ status: "no_bank" }).where(and(eq(customers.id, customer.id), eq(customers.status, "new")));
      status = "no_bank";
    }
  }
  const done = status === "pending_review" || status === "reviewed";
  const [voucher] = done
    ? await db
        .select({ smsSentAt: smsMessages.sentAt })
        .from(vouchers)
        .leftJoin(smsMessages, and(eq(smsMessages.customerId, vouchers.customerId), eq(smsMessages.kind, "voucher")))
        .where(eq(vouchers.customerId, customer.id))
    : [];
  const [reviewed] = status === "reviewed" ? await db.select({ at: max(customerBanks.reviewedAt) }).from(customerBanks).where(eq(customerBanks.customerId, customer.id)) : [];
  return {
    customer: { id: customer.id, fullName: customer.fullName, className: customer.className, status },
    school,
    submittedAt: customer.submittedAt?.toISOString() ?? null,
    reviewedAt: reviewed?.at ? new Date(reviewed.at).toISOString() : null,
    parentPhone: maskPhone(customer.parentPhone),
    voucher: voucher ? { smsSentAt: voucher.smsSentAt?.toISOString() ?? null } : null,
    eligibleBanks,
    existingBanks,
    banks: chosen,
    zaloUrl: settings.zaloUrl,
    pviAppUrl: settings.pviAppUrl,
    insurance: insuranceOf(settings),
    thanksText: settings.thanksText,
    gift: await giftState(customer.id),
  };
}

// Sản phẩm có link mới hiện ở màn Kết quả.
function insuranceOf(s: Awaited<ReturnType<typeof getSettings>>): StudentInsurance[] {
  const fields = { student: ["insuranceStudentUrl", "insuranceStudentGuide"], moto: ["insuranceMotoUrl", "insuranceMotoGuide"], electric: ["insuranceElectricUrl", "insuranceElectricGuide"] } as const;
  return INSURANCE_PRODUCTS.flatMap((p) => {
    const [url, guide] = fields[p.key];
    return s[url] ? [{ key: p.key, name: p.name, url: s[url], guide: s[guide] }] : [];
  });
}
