export const studentLink = (schoolId: string) => `${(process.env.STUDENT_ORIGIN ?? "https://bank.minhgroup-i.com.vn").replace(/\/+$/, "")}/t/${schoolId}`;
