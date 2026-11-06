import { describe, expect, test } from "bun:test";
import { videoCopies } from "../../scripts/e2e-videos";

const video = (path: string) => ({ name: "video", contentType: "video/webm", path });
const spec = (file: string, title: string, projectName: string, results: { status: string; attachments: { name: string; path?: string }[] }[]) => ({ file, title, tests: [{ projectName, results }] });

describe("scripts/e2e-videos.ts", () => {
  test("mỗi flow một file đặt theo tên file spec, lấy video đầu của lượt chạy cuối", () => {
    const report = {
      suites: [
        {
          file: "01-dang-nhap.spec.ts",
          specs: [spec("01-dang-nhap.spec.ts", "Flow 1", "flows", [{ status: "failed", attachments: [video("/r/a/video.webm")] }, { status: "passed", attachments: [{ name: "trace", path: "/r/b/trace.zip" }, video("/r/b/video.webm"), video("/r/b/video-1.webm")] }])],
          suites: [],
        },
        { file: "04-hoc-sinh.spec.ts", specs: [], suites: [{ specs: [spec("04-hoc-sinh.spec.ts", "Flow 4", "flows", [{ status: "passed", attachments: [video("/r/c/video.webm")] }])] }] },
      ],
    };
    expect(videoCopies(report, "/out")).toEqual([
      { from: "/r/b/video.webm", to: "/out/01-dang-nhap.webm", title: "Flow 1", status: "passed" },
      { from: "/r/c/video.webm", to: "/out/04-hoc-sinh.webm", title: "Flow 4", status: "passed" },
    ]);
  });

  test("bỏ test không có video và test của project khác", () => {
    const report = {
      suites: [
        { file: "02-tai-khoan.spec.ts", specs: [spec("02-tai-khoan.spec.ts", "Flow 2", "flows", [{ status: "skipped", attachments: [] }])] },
        { file: "auth.spec.ts", specs: [spec("auth.spec.ts", "Đăng nhập", "chromium", [{ status: "passed", attachments: [video("/r/d/video.webm")] }])] },
      ],
    };
    expect(videoCopies(report, "/out")).toEqual([]);
  });
});
