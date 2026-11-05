import { spawnSync } from "node:child_process";
import { closeSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Chép cách sao lưu của mgst-app (scripts/db-backup.ts, db-backup-check.ts, db-restore.ts), gom phần dùng chung để test được.

type Env = Record<string, string | undefined>;
export type BackupS3 = { client: S3Client; bucket: string };
export type DbTarget = { user: string; database: string };

const NAME = /^[a-z_][a-z0-9_]*$/;

// Bucket sao lưu phải khác bucket ảnh: app có quyền xoá trong bucket ảnh, một lỗi ở đường xoá ảnh không được chạm bản sao lưu.
// Khoá: khai BACKUP_S3_* thì dùng khoá riêng, không thì dùng S3_* của app; tách khoá sau này chỉ cần thêm hai dòng env.
export function backupConfig(env: Env = process.env) {
  const bucket = env.BACKUP_S3_BUCKET ?? "";
  if (!bucket) throw new Error("Thiếu BACKUP_S3_BUCKET. Xem docs/deploy.md mục Sao lưu.");
  if (bucket === "mgst-images") throw new Error("Không ghi bản sao lưu vào mgst-images, bucket của mgst-app.");
  if (bucket === env.S3_BUCKET) throw new Error(`BACKUP_S3_BUCKET trùng bucket ảnh (${bucket}). Bản sao lưu phải nằm ở bucket khác.`);
  const endpoint = (env.BACKUP_S3_ENDPOINT || env.S3_ENDPOINT || "").replace(/\/+$/, "");
  const region = env.BACKUP_S3_REGION || env.S3_REGION || "";
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID || "";
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY || "";
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) throw new Error("Thiếu cấu hình S3. Khai BACKUP_S3_* hoặc S3_*.");
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

export function backupS3(env: Env = process.env): BackupS3 {
  const c = backupConfig(env);
  // forcePathStyle bắt buộc với FPT Object Storage: nó đòi <endpoint>/<bucket>, không nhận <bucket>.<endpoint>.
  return { bucket: c.bucket, client: new S3Client({ endpoint: c.endpoint, region: c.region, forcePathStyle: true, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } }) };
}

// pg_dump chạy trong container Postgres qua socket nội bộ: chỉ cần user và tên database, không cần mật khẩu.
export function dbTarget(databaseUrl: string): DbTarget {
  const url = new URL(databaseUrl);
  const user = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!NAME.test(user) || !NAME.test(database)) throw new Error("DATABASE_URL có user hoặc tên database lạ.");
  return { user, database };
}

// Tên file theo giờ Việt Nam: người đọc mong thấy giờ trên đồng hồ của mình, kể cả khi máy chủ chạy UTC.
function stampVn(now: Date): { day: string; time: string } {
  const [day, clock] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(now)
    .split(" ");
  return { day, time: clock.replace(":", "") };
}

// Container ghi vào database: tên đi theo tên container DB (mgi-bank-db, mgi-bank-test-db) như các script trong deploy/.
export const appContainersFor = (dbContainer: string): string[] => ["app", "sms", "photo"].map((part) => dbContainer.replace(/-db$/, `-${part}`));

export const backupFileName = (now: Date) => {
  const { day, time } = stampVn(now);
  return `mgi-bank-${day}-${time}.dump`;
};

export const backupKey = (now: Date, prefix = "") => `${prefix}${stampVn(now).day}/${backupFileName(now)}`;

// Xoá theo ngày, không theo số file: một ngày chạy lỗi nửa chừng không đẩy lệch cả cụm.
export function staleKeys(keys: string[], now: Date, keepDays: number, prefix: string): string[] {
  const cutoff = stampVn(new Date(now.getTime() - keepDays * 86_400_000)).day;
  return keys.filter((key) => {
    if (!key.startsWith(prefix)) return false;
    const folder = key.slice(prefix.length).split("/")[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(folder) && folder < cutoff;
  });
}

function run(args: string[], stdio: { in?: number; out?: number } = {}) {
  const r = spawnSync("docker", args, { stdio: [stdio.in ?? "ignore", stdio.out ?? "pipe", "pipe"], encoding: "utf8" });
  if (r.error) throw r.error;
  return r;
}

// pg_dump hỏng giữa chừng vẫn có thể cho mã 0: đọc lại mục lục để chắc file đọc được và có mục dữ liệu của bảng users.
// Mục lục không cho biết bảng có bao nhiêu dòng: DB đủ bảng mà rỗng vẫn qua bước này, shrinkError bắt ca đó.
export function dumpDatabase(container: string, target: DbTarget, file: string): void {
  const fd = openSync(file, "w");
  let r;
  try {
    r = run(["exec", container, "pg_dump", "-U", target.user, "-d", target.database, "-Fc"], { out: fd });
  } finally {
    closeSync(fd);
  }
  if (r.status !== 0) {
    rmSync(file, { force: true });
    throw new Error(`pg_dump trả mã ${r.status}: ${r.stderr.trim()}`);
  }
  const listFd = openSync(file, "r");
  try {
    const list = run(["exec", "-i", container, "pg_restore", "--list"], { in: listFd });
    if (list.status !== 0 || !/TABLE DATA public users /.test(list.stdout)) throw new Error("File dump không đọc được hoặc thiếu dữ liệu bảng users.");
  } finally {
    closeSync(listFd);
  }
}

function psql(container: string, user: string, database: string, sql: string) {
  const r = run(["exec", container, "psql", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout;
}

export function createDatabase(container: string, user: string, name: string): void {
  if (!NAME.test(name)) throw new Error(`Tên database lạ: ${name}`);
  psql(container, user, "postgres", `create database ${name}`);
}

// Chỉ xoá được database tạm: bản khôi phục thử (<tên>_thu) hoặc database test, không bao giờ database đang chạy.
export function dropDatabase(container: string, user: string, name: string): void {
  if (!/^(zz_test_[a-z0-9_]+|[a-z0-9_]+_thu)$/.test(name)) throw new Error(`Chỉ xoá database tên zz_test_... hoặc ..._thu, không xoá ${name}.`);
  psql(container, user, "postgres", `drop database if exists ${name}`);
}

// Khôi phục đè chỉ nhận database ghi trong DATABASE_URL. Xoá hẳn rồi tạo lại: pg_restore --clean chỉ xoá object có trong bản dump,
// bảng và kiểu do migration sau giờ dump tạo ra nằm lại, lượt migrate kế tiếp báo "already exists".
export function recreateDatabase(container: string, target: DbTarget): void {
  if (!NAME.test(target.database)) throw new Error(`Tên database lạ: ${target.database}`);
  psql(container, target.user, "postgres", `drop database if exists ${target.database} with (force)`);
  psql(container, target.user, "postgres", `create database ${target.database}`);
}

// pg_restore trả mã khác 0 cả khi chỉ cảnh báo quyền sở hữu: trả lỗi để người gọi in ra, số dòng mỗi bảng mới là câu trả lời.
export function restoreDump(container: string, user: string, file: string, database: string): string {
  if (!NAME.test(database)) throw new Error(`Tên database lạ: ${database}`);
  const fd = openSync(file, "r");
  try {
    const r = run(["exec", "-i", container, "pg_restore", "-U", user, "-d", database, "--no-owner"], { in: fd });
    return r.status === 0 ? "" : r.stderr.trim();
  } finally {
    closeSync(fd);
  }
}

export function tableCounts(container: string, user: string, database: string): Record<string, number> {
  const out = psql(
    container,
    user,
    database,
    `select table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
     from information_schema.tables where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE' order by 1`,
  );
  return Object.fromEntries(
    out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, n] = line.split("|");
        return [name, Number(n)];
      }),
  );
}

// DB bị xoá dữ liệu (tạo lại rỗng, script dọn chạy nhầm) vẫn dump ra file hợp lệ. Đẩy bản đó lên đều đặn thì sau BACKUP_KEEP_DAYS
// mọi bản tốt bị dọn: bản mới nhỏ hơn nửa bản trước thì dừng trước khi đẩy lên và trước khi dọn bản cũ.
export function shrinkError(size: number, previous: { key: string; size: number } | null, allowed: boolean): string | null {
  if (allowed || !previous || size >= previous.size * 0.5) return null;
  return `bản dump mới ${Math.round(size / 1024)} KB, nhỏ hơn nửa bản trước ${previous.key} (${Math.round(previous.size / 1024)} KB): nghi DB bị xoá dữ liệu. Không đẩy lên S3, không dọn bản cũ. Chắc chắn DB đúng thì chạy lại với BACKUP_ALLOW_SHRINK=1.`;
}

// PutObject không lỗi vẫn có thể ghi thiếu khi đường truyền đứt: đọc lại dung lượng trên S3.
export async function uploadBackup(s3: BackupS3, key: string, file: string): Promise<number> {
  const size = statSync(file).size;
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: readFileSync(file), ContentType: "application/octet-stream" }));
  const head = await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key }));
  if (head.ContentLength !== size) throw new Error(`S3 nhận ${head.ContentLength} byte, file gốc ${size} byte.`);
  return size;
}

export async function listBackups(s3: BackupS3, prefix = ""): Promise<{ key: string; size: number; at: Date }[]> {
  const rows: { key: string; size: number; at: Date }[] = [];
  let token: string | undefined;
  do {
    const page = await s3.client.send(new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix || undefined, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key && o.LastModified) rows.push({ key: o.Key, size: o.Size ?? 0, at: o.LastModified });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return rows;
}

export async function newestBackup(s3: BackupS3, prefix = "") {
  const rows = await listBackups(s3, prefix);
  return rows.reduce<(typeof rows)[number] | null>((a, b) => (!a || b.at > a.at ? b : a), null);
}

export async function pruneBackups(s3: BackupS3, now: Date, keepDays: number, prefix = ""): Promise<number> {
  const stale = staleKeys((await listBackups(s3, prefix)).map((o) => o.key), now, keepDays, prefix);
  for (const key of stale) await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
  return stale.length;
}

export async function downloadBackup(s3: BackupS3, key: string, file: string): Promise<number> {
  const object = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
  const bytes = await object.Body!.transformToByteArray();
  writeFileSync(file, bytes);
  return bytes.length;
}
