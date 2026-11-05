import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { allowedExt, FOLDERS, isImageKey, MAX_IMAGE_BYTES, type Folder } from "@/lib/imageKey";
import { toWebpOnServer } from "./toWebpOnServer";

export { FOLDERS, MAX_IMAGE_BYTES, type Folder };

type Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

// Đọc cấu hình mỗi lần gọi: thêm biến vào .env.local thì không phải khởi động lại tiến trình.
function readConfig(): Config {
  const endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/+$/, "");
  const { S3_REGION: region = "", S3_BUCKET: bucket = "", S3_ACCESS_KEY_ID: accessKeyId = "", S3_SECRET_ACCESS_KEY: secretAccessKey = "" } = process.env;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Chưa cấu hình S3. Thêm các biến S3_* vào .env.local.");
  // mgst-images là bucket production của mgst-app; mgi-bank ghi vào đó là trộn ảnh thử với ảnh thật của hệ khác.
  if (bucket === "mgst-images") throw new Error("mgi-bank không được dùng bucket mgst-images.");
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

const client = (c: Config) =>
  new S3Client({
    region: c.region,
    endpoint: c.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });

// S3 treo thì lệnh lỗi sau hạn giờ, kể cả các lượt SDK tự thử lại: worker không đứng mãi ở một ảnh và SIGTERM thoát được.
const deadline = () => ({ abortSignal: AbortSignal.timeout(Number(process.env.S3_TIMEOUT_MS) || 60_000) });

// Nhận diện ảnh bằng chữ ký đầu file như mgst-app, không tin Content-Type trình duyệt khai.
const SIGNATURES: { ext: string; mime: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    ext: "heic",
    mime: "image/heic",
    // Chỉ soi "ftyp" thì video MP4, MOV cũng qua; phải soi thêm brand.
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(String.fromCharCode(b[8], b[9], b[10], b[11])),
  },
];
const MIME = new Map(SIGNATURES.map((s) => [s.ext, s.mime]));

export const imageExtOf = (bytes: Uint8Array): string | null => SIGNATURES.find((s) => s.test(bytes))?.ext ?? null;

export const isValidKey = (key: string): boolean => isImageKey(key);

export const newKey = (folder: Folder, ext: string): string => `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

export type PutResult = { ok: true; key: string; size: number } | { ok: false; message: string };

// Mọi đường tải ảnh đi qua đây như mgst-app: kho chỉ giữ WebP, đổi lỗi thì giữ bản gốc.
export async function putImage(raw: Uint8Array, folder: Folder): Promise<PutResult> {
  if (raw.length > MAX_IMAGE_BYTES) return { ok: false, message: "Ảnh lớn hơn 20 MB." };
  const rawExt = imageExtOf(raw);
  if (!rawExt) return { ok: false, message: "Chỉ nhận ảnh jpg, png, webp hoặc heic." };
  const converted = await toWebpOnServer(raw, rawExt);
  const bytes = converted ?? raw;
  const ext = converted ? "webp" : rawExt;
  if (!allowedExt(folder, ext)) return { ok: false, message: "Không mở được ảnh này. Chọn ảnh khác." };
  const c = readConfig();
  const key = newKey(folder, ext);
  await client(c).send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: bytes, ContentType: MIME.get(ext) }), deadline());
  return { ok: true, key, size: bytes.length };
}

// Content-Type trả về theo đuôi khoá, không theo loại lúc tải lên: file lạ mang đuôi ảnh không được trình duyệt chạy như trang web.
export async function presignGet(key: string, seconds = 600): Promise<string> {
  const c = readConfig();
  const type = MIME.get(key.split(".").pop() ?? "") ?? "application/octet-stream";
  return getSignedUrl(client(c), new GetObjectCommand({ Bucket: c.bucket, Key: key, ResponseContentType: type }), { expiresIn: seconds });
}

// Object không còn thì trả null: worker phân biệt "ảnh đã bị thay" với lỗi mạng.
export async function readImage(key: string): Promise<Uint8Array | null> {
  if (!isValidKey(key)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  try {
    const r = await client(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: key }), deadline());
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array();
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function writeImage(key: string, bytes: Uint8Array): Promise<void> {
  if (!isValidKey(key)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  await client(c).send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: bytes, ContentType: MIME.get(key.split(".").pop() ?? "") }), deadline());
}

export async function deleteImage(key: string): Promise<void> {
  if (!isValidKey(key)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  await client(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }), deadline());
}

export async function* listObjects(prefix: string): AsyncGenerator<{ key: string; at: Date }> {
  const c = readConfig();
  let token: string | undefined;
  do {
    const page = await client(c).send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: prefix, ContinuationToken: token }), deadline());
    for (const o of page.Contents ?? []) if (o.Key && o.LastModified) yield { key: o.Key, at: o.LastModified };
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

export const imageUrl = (key: string) => `/api/admin/images?key=${encodeURIComponent(key)}`;
