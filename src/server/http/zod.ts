import type { ZodError } from "zod";

export const zodFail = (error: ZodError) => {
  const issue = error.issues[0];
  return Response.json({ message: issue?.message ?? "Dữ liệu không hợp lệ.", field: issue?.path[0] }, { status: 400 });
};

export const failResponse = (r: { message: string; status: number; field?: string }) => Response.json({ message: r.message, field: r.field }, { status: r.status });
