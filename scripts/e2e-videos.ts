import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type Attachment = { name: string; path?: string };
type Spec = { file: string; title: string; tests: { projectName: string; results: { status: string; attachments: Attachment[] }[] }[] };
type Suite = { specs?: Spec[]; suites?: Suite[] };
export type VideoCopy = { from: string; to: string; title: string; status: string };

const specsOf = (suite: Suite): Spec[] => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specsOf)];

// Video đầu là trang chính của flow; trang bật thêm (link mở tab mới) cũng có video riêng nhưng chỉ vài giây trống.
export function videoCopies(report: Suite, outDir: string): VideoCopy[] {
  return specsOf(report)
    .flatMap((spec) =>
      spec.tests
        .filter((t) => t.projectName === "flows")
        .flatMap((t) => {
          const last = t.results.at(-1);
          const path = last?.attachments.find((a) => a.name === "video" && a.path)?.path;
          return path ? [{ from: path, to: join(outDir, `${basename(spec.file).replace(/\.spec\.ts$/, "")}.webm`), title: spec.title, status: last!.status }] : [];
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
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith(".webm")) rmSync(join(outDir, f));
  const copies = videoCopies(JSON.parse(readFileSync(reportPath, "utf8")), outDir);
  for (const c of copies) copyFileSync(c.from, c.to);
  console.log(`Video của ${copies.length} flow:`);
  for (const c of copies) console.log(`${c.to}  ${c.title} (${c.status})`);
}
