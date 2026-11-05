import { spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

// Chép từ mgst-app src/server/ocr/reader.ts, bỏ phần chọn model theo ngân hàng. Chỉ chạy trong worker kiểm ảnh.
// Tiến trình Python mở ở lượt gọi đầu rồi giữ suốt: nạp model mất vài giây, mở lại mỗi ảnh thì ảnh nào cũng tốn thêm chừng đó.
// Biến môi trường: OCR_PYTHON (mặc định python3), OCR_SERVER (mặc định scripts/ocr-server.py), OCR_TIMEOUT_MS (mặc định 120000),
// OCR_* khác đi thẳng xuống Python.

type Reply = { lines?: string[]; ms?: number; error?: string; ready?: boolean };

type Server = {
  child: ChildProcessByStdio<Writable, Readable, null>;
  waiting: ((reply: Reply) => void) | null;
  died: Error | null;
};

let server: Promise<Server> | null = null;
let current: Server | null = null;
let queue: Promise<unknown> = Promise.resolve();

// Phải dưới 5 phút giữ lượt của worker kiểm ảnh, không thì worker khác nhận lại lượt đang đọc.
const timeoutMs = () => Number(process.env.OCR_TIMEOUT_MS) || 120_000;

// Thư viện C ghi thẳng ra fd 1 không xuống dòng thì chữ rác dính trước JSON trên cùng dòng: thử từ từng dấu "{".
function parseReply(line: string): Reply | null {
  for (let at = line.indexOf("{"); at >= 0; at = line.indexOf("{", at + 1)) {
    try {
      return JSON.parse(line.slice(at)) as Reply;
    } catch {
      continue;
    }
  }
  return null;
}

function start(): Promise<Server> {
  const python = process.env.OCR_PYTHON || "python3";
  const script = process.env.OCR_SERVER || path.join(process.cwd(), "scripts", "ocr-server.py");
  // Paddle mặc định hỏi nguồn model qua mạng mỗi lần mở; model đã có sẵn trong máy thì bỏ bước đó.
  const child = spawn(python, [script], { stdio: ["pipe", "pipe", "inherit"], env: { PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True", ...process.env } });
  const state: Server = { child, waiting: null, died: null };
  current = state;
  // Ghi vào stdin của tiến trình vừa chết là EPIPE; sự kiện exit bên dưới đã lo phần báo lỗi.
  child.stdin.on("error", () => undefined);
  createInterface({ input: child.stdout }).on("line", (line) => {
    const reply = parseReply(line);
    if (!reply) return;
    const waiting = state.waiting;
    state.waiting = null;
    waiting?.(reply);
  });
  return new Promise<Server>((resolve, reject) => {
    state.waiting = (reply) => (reply.ready ? resolve(state) : reject(new Error(reply.error ?? "OCR không sẵn sàng.")));
    child.once("error", (e) => reject(new Error(`Không mở được OCR (${python} ${script}): ${e.message}`)));
    child.once("exit", (code, signal) => {
      state.died = new Error(`Tiến trình OCR thoát (${signal ?? code}).`);
      reject(state.died);
      state.waiting?.({ error: state.died.message });
      state.waiting = null;
      // Lượt sau mở lại từ đầu; tiến trình bị giết vì quá giờ thì đã có tiến trình mới, không xoá nhầm.
      if (current === state) {
        server = null;
        current = null;
      }
    });
  });
}

async function ask(image: Uint8Array, code: string | undefined): Promise<string[]> {
  if (!server)
    server = start().catch((e) => {
      server = null;
      throw e;
    });
  const s = await server;
  if (s.died) throw s.died;
  const dir = await mkdtemp(path.join(tmpdir(), "mgi-ocr-"));
  const file = path.join(dir, "anh");
  try {
    await writeFile(file, image);
    const reply = await new Promise<Reply>((resolve) => {
      s.waiting = resolve;
      s.child.stdin.write(JSON.stringify({ path: file, code }) + "\n");
    });
    if (reply.error) throw new Error(`OCR lỗi: ${reply.error}`);
    return reply.lines ?? [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Tiến trình treo (tải cấu hình VietOCR không có mạng, Paddle kẹt) thì giết đi để lượt sau mở tiến trình mới, worker không đứng mãi.
async function withTimeout(work: Promise<string[]>): Promise<string[]> {
  const ms = timeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const stuck = current;
      server = null;
      current = null;
      stuck?.child.kill("SIGKILL");
      reject(new Error(`Đọc ảnh quá ${Math.round(ms / 1000)} giây.`));
    }, ms);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

// Các dòng chữ trong ảnh, trên xuống, trái sang. Lỗi ném ra, không trả rỗng. Có `code` thì vùng đọc lệch O/0, I/1 so với mã được đọc lại bằng model thứ hai.
export function ocrLines(image: Uint8Array, code?: string): Promise<string[]> {
  // Một tiến trình đọc một ảnh một lúc.
  const turn = queue.then(() => withTimeout(ask(image, code)));
  queue = turn.catch(() => undefined);
  return turn;
}

export async function closeOcr(): Promise<void> {
  const s = await server?.catch(() => null);
  server = null;
  current = null;
  s?.child.stdin.end();
}
