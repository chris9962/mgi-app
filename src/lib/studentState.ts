export type CustomerStatus = "new" | "banks_selected" | "pending_review" | "reviewed" | "no_bank";

export type StudentSchool = { id: string; name: string; active: boolean; banks: { id: string; name: string }[] };

export type CustomerBankStatus = "selected" | "pending" | "passed" | "failed";

export type StudentPhotoSlot = { id: string; name: string; sampleUrl: string | null; photo: { url: string; sizeBytes: number } | null };

export type StudentBank = {
  id: string;
  bankId: string;
  name: string;
  slot: number;
  status: CustomerBankStatus;
  referralCode: string;
  qrUrl: string | null;
  openUrl: string | null;
  steps: string[];
  slots: StudentPhotoSlot[];
};

export type StudentState = {
  customer: { id: string; fullName: string; className: string; status: CustomerStatus };
  school: { id: string; name: string };
  eligibleBanks: { id: string; name: string }[];
  existingBanks: string[];
  banks: StudentBank[];
  zaloUrl: string;
  pviAppUrl: string;
};
