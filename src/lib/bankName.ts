// Tên ngân hàng cấu hình dạng "Ngân hàng TMCP Quân đội (MB Bank)": tên ngắn trong ngoặc cuối dùng ở thẻ nhỏ, tên dài ở hộp thông tin.
export function splitBankName(name: string): { short: string; long: string | null } {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(name);
  return m ? { short: m[2].trim(), long: m[1] } : { short: name, long: null };
}

export const shortName = (name: string) => splitBankName(name).short;
