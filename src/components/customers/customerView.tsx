import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { CUSTOMER_STATUS_LABEL } from "@/lib/customerFilters";
import type { CustomerBankStatus, CustomerStatus } from "@/lib/studentState";

const BANK_TONE: Record<CustomerBankStatus, Tone> = { selected: "neutral", pending: "progress", passed: "ok", failed: "danger" };
const BANK_SHORT: Record<CustomerBankStatus, string> = { selected: "Đang tạo", pending: "Chờ", passed: "Đạt", failed: "Không đạt" };
const BANK_LONG: Record<CustomerBankStatus, string> = { selected: "Đang tạo", pending: "Chờ kiểm tra", passed: "Đạt", failed: "Không đạt" };

const CUSTOMER_TONE: Record<CustomerStatus, Tone> = { new: "neutral", banks_selected: "neutral", pending_review: "progress", reviewed: "neutral", no_bank: "neutral" };

export const bankTag = (status: CustomerBankStatus, long = false) => <StatusTag tone={BANK_TONE[status]}>{(long ? BANK_LONG : BANK_SHORT)[status]}</StatusTag>;

export const customerTag = (status: CustomerStatus) => <StatusTag tone={CUSTOMER_TONE[status]}>{CUSTOMER_STATUS_LABEL[status]}</StatusTag>;
