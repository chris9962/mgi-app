import { describe, expect, test } from "bun:test";
import { lineHasName, linesHaveExactCode, nameKey } from "../../src/server/ocr/text";

// Chữ mẫu theo đúng kiểu VietOCR trả về: dính từ, dư chữ ở mép, dấu đọc lệch.
const has = (line: string, fullName: string) => lineHasName(line, nameKey(fullName));

describe("họ tên trên ảnh", () => {
  test("bỏ dấu, viết hoa, bỏ khoảng trắng: tên dính khoảng trắng vẫn đạt", () => {
    expect(has("TRẦN MINH ANH", "Trần Minh Anh")).toBe(true);
    expect(has("TRANMINH ANH", "Trần Minh Anh")).toBe(true);
    expect(has("Tô ThịCẩm Hơn", "Tô Thị Cẩm Hơn")).toBe(true);
    expect(has("Đỗ Văn Đạt", "ĐỖ VĂN ĐẠT")).toBe(true);
  });

  test("dư tối đa 2 chữ cái mỗi đầu, dư 3 thì không đạt", () => {
    expect(has("VW NGUYEN THI NHIEU", "Nguyễn Thị Nhiêu")).toBe(true);
    expect(has("Xin chào, TRAN MINH ANH ơi", "Trần Minh Anh")).toBe(false);
    expect(has("AB TRAN MINH ANH CD", "Trần Minh Anh")).toBe(true);
    expect(has("ABC TRAN MINH ANH", "Trần Minh Anh")).toBe(false);
    expect(has("TRAN MINH ANH CDE", "Trần Minh Anh")).toBe(false);
    expect(has("NGUYEN THI NHIEU HOA", "Nguyễn Thị Nhiêu")).toBe(false);
  });

  test("số và dấu câu không tính là chữ dư", () => {
    expect(has("1. TRAN MINH ANH - 0987654321", "Trần Minh Anh")).toBe(true);
  });

  test("sai một chữ cái hay thiếu chữ thì không đạt", () => {
    expect(has("TRAN MlNH ANH", "Trần Minh Anh")).toBe(false);
    expect(has("TRAN MINH", "Trần Minh Anh")).toBe(false);
    expect(has("TRAN MINH AN", "Trần Minh Anh")).toBe(false);
  });

  test("lời nhắn chuyển khoản app tự điền: tên nối liền chuyen tien", () => {
    expect(has("Nội dung: TRAN MINH ANH chuyen tien", "Trần Minh Anh")).toBe(true);
  });

  test("tên rỗng không đạt", () => {
    expect(has("TRAN MINH ANH", "")).toBe(false);
  });
});

describe("mã giới thiệu trên ảnh", () => {
  test("so nguyên văn, chỉ bỏ dấu và viết hoa", () => {
    expect(linesHaveExactCode(["Mã giới thiệu", "AT105"], "AT105")).toBe(true);
    expect(linesHaveExactCode(["Mã giới thiệu: at105."], "AT105")).toBe(true);
    expect(linesHaveExactCode(["Ma gioi thieu ND-TPB-01"], "ND-TPB-01")).toBe(true);
  });

  test("AT1050 không chứa mã AT105: trước và sau mã không được dính chữ hay số", () => {
    expect(linesHaveExactCode(["AT1050"], "AT105")).toBe(false);
    expect(linesHaveExactCode(["XAT105"], "AT105")).toBe(false);
    expect(linesHaveExactCode(["AT105 AT1050"], "AT105")).toBe(true);
  });

  test("không gộp O với 0, I với 1", () => {
    expect(linesHaveExactCode(["BOO8"], "BO08")).toBe(false);
    expect(linesHaveExactCode(["B008"], "BO08")).toBe(false);
    expect(linesHaveExactCode(["BO08"], "BO08")).toBe(true);
    expect(linesHaveExactCode(["A183"], "AI83")).toBe(false);
    expect(linesHaveExactCode(["ND-TPB-O1"], "ND-TPB-01")).toBe(false);
  });

  test("không bỏ ký tự, không ghép cụm", () => {
    expect(linesHaveExactCode(["AT 105"], "AT105")).toBe(false);
    expect(linesHaveExactCode(["NDTPB01"], "ND-TPB-01")).toBe(false);
    expect(linesHaveExactCode(["AT10"], "AT105")).toBe(false);
  });

  test("mã rỗng không đạt", () => {
    expect(linesHaveExactCode(["AT105"], "")).toBe(false);
  });
});
