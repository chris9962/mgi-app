export type CustomerStatus = "new" | "banks_selected" | "pending_review" | "reviewed" | "no_bank";

export type StudentSchool = { id: string; name: string; active: boolean };

export type StudentState = {
  customer: { id: string; fullName: string; className: string; status: CustomerStatus };
  school: { id: string; name: string };
};
