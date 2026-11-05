import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { CUSTOMER_BANK_STATUS_LABEL } from "@/lib/customerBankFilters";
import { CUSTOMER_STATUS_LABEL } from "@/lib/customerFilters";
import type { CustomerBankStatus, CustomerStatus } from "@/lib/studentState";

const BANK_TONE: Record<CustomerBankStatus, Tone> = { selected: "neutral", pending: "progress", passed: "ok", failed: "danger" };
// Ô ngân hàng của Trang 3 hẹp nên ghi "Chờ"; nơi khác dùng nhãn đủ.
const BANK_SHORT: Record<CustomerBankStatus, string> = { ...CUSTOMER_BANK_STATUS_LABEL, pending: "Chờ" };

const CUSTOMER_TONE: Record<CustomerStatus, Tone> = { new: "neutral", banks_selected: "neutral", pending_review: "progress", reviewed: "neutral", no_bank: "neutral" };

export const bankTag = (status: CustomerBankStatus, long = false) => <StatusTag tone={BANK_TONE[status]}>{(long ? CUSTOMER_BANK_STATUS_LABEL : BANK_SHORT)[status]}</StatusTag>;

export const customerTag = (status: CustomerStatus) => <StatusTag tone={CUSTOMER_TONE[status]}>{CUSTOMER_STATUS_LABEL[status]}</StatusTag>;
