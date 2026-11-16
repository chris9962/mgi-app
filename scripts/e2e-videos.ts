import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

type Attachment = { name: string; path?: string };
type Spec = { file: string; title: string; tests: { projectName: string; results: { status: string; attachments: Attachment[] }[] }[] };
type Suite = { specs?: Spec[]; suites?: Suite[] };
export type VideoCopy = { from: string; to: string; title: string; status: string };

const specsOf = (suite: Suite): Spec[] => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specsOf)];

// Trang chính của flow mở đầu tiên nên video là video.webm; tab bật thêm (link mở tab mới) là video-1.webm, chỉ vài giây.
export function videoCopies(report: Suite, outDir: string): VideoCopy[] {
  return specsOf(report)
    .flatMap((spec) =>
      spec.tests
        .filter((t) => t.projectName === "flows")
        .flatMap((t) => {
          const last = t.results.at(-1);
          const videos = (last?.attachments ?? []).filter((a) => a.name === "video" && a.path);
          const path = (videos.find((a) => basename(a.path!) === "video.webm") ?? videos[0])?.path;
          return path ? [{ from: path, to: join(outDir, spec.file.replace(/^flows\//, "").replace(/\.spec\.ts$/, ".webm")), title: spec.title, status: last!.status }] : [];
        }),
    )
    .sort((a, b) => a.to.localeCompare(b.to));
}

if (import.meta.main) {
  const reportPath = resolve(process.argv[2] ?? "test-results/flows.json");
  const outDir = resolve("e2e/videos");
  if (!existsSync(reportPath)) {
    console.error(`Không thấy báo cáo ${reportPath}. Chạy bun run e2e:flows.`);
    process.exit(1);
  }
  // Lượt quay một video không được xoá video khác: chỉ ghi đè video của spec vừa chạy.
  const copies = videoCopies(JSON.parse(readFileSync(reportPath, "utf8")), outDir);
  for (const c of copies) {
    mkdirSync(dirname(c.to), { recursive: true });
    copyFileSync(c.from, c.to);
  }
  console.log(`Video của ${copies.length} flow:`);
  for (const c of copies) console.log(`${c.to}  ${c.title} (${c.status})`);
}
