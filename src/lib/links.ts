export const studentLink = (schoolId: string) => `${(process.env.STUDENT_ORIGIN ?? "https://bank.mgst.com.vn").replace(/\/+$/, "")}/t/${schoolId}`;
