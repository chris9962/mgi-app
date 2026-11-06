// Hai request cùng qua bước kiểm trùng rồi cùng ghi: request sau vấp ràng buộc unique, phải báo như trùng chứ không lỗi 500.
export const isUniqueViolation = (e: unknown, constraint: string): boolean => {
  const err = (e as { cause?: unknown })?.cause ?? e;
  const pg = err as { code?: string; constraint?: string };
  return pg.code === "23505" && pg.constraint === constraint;
};
