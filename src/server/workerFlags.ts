const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cờ --truong=<id>[,<id>] của worker. Gõ sai cờ mà bị bỏ qua thì worker xử lý cả DB: dừng với lỗi thay vì đoán.
export function schoolsFlag(argv: string[]): string[] | undefined {
  const flags = argv.filter((a) => a.startsWith("--truong"));
  if (!flags.length) return undefined;
  const ids = flags.length === 1 && flags[0].startsWith("--truong=") ? flags[0].slice("--truong=".length).split(",") : [];
  if (!ids.length || !ids.every((id) => UUID.test(id))) throw new Error(`Không đọc được cờ ${flags.join(" ")}. Dùng --truong=<id>[,<id>], id là uuid của trường.`);
  return ids;
}
