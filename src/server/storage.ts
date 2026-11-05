import { randomUUID } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { allowedExt, FOLDERS, isImageKey, MAX_IMAGE_BYTES, type Folder } from "@/lib/imageKey";

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

// WHEN_REQUIRED: SDK mặc định ký thêm checksum của body rỗng vào presigned PUT, trình duyệt gửi ảnh thật thì S3 từ chối.
const client = (c: Config) =>
  new S3Client({
    region: c.region,
    endpoint: c.endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });

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

export async function putImage(bytes: Uint8Array, folder: Folder): Promise<{ ok: true; key: string } | { ok: false; message: string }> {
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, message: "Ảnh lớn hơn 10 MB." };
  const ext = imageExtOf(bytes);
  if (!ext || !allowedExt(folder, ext)) return { ok: false, message: "Chỉ nhận ảnh jpg, png hoặc webp." };
  const c = readConfig();
  const key = newKey(folder, ext);
  await client(c).send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: bytes, ContentType: MIME.get(ext) }));
  return { ok: true, key };
}

// Content-Type trả về theo đuôi khoá, không theo loại lúc tải lên: file lạ mang đuôi ảnh không được trình duyệt chạy như trang web.
export async function presignGet(key: string, seconds = 600): Promise<string> {
  const c = readConfig();
  const type = MIME.get(key.split(".").pop() ?? "") ?? "application/octet-stream";
  return getSignedUrl(client(c), new GetObjectCommand({ Bucket: c.bucket, Key: key, ResponseContentType: type }), { expiresIn: seconds });
}

// Ký cả Content-Type và Content-Length: link chỉ nhận đúng loại và đúng dung lượng điện thoại đã khai.
export async function presignPut(key: string, contentType: string, size: number, seconds = 120): Promise<string> {
  if (!isValidKey(key)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  return getSignedUrl(client(c), new PutObjectCommand({ Bucket: c.bucket, Key: key, ContentType: contentType, ContentLength: size }), {
    expiresIn: seconds,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

export async function copyImage(from: string, to: string): Promise<void> {
  if (!isValidKey(from) || !isValidKey(to)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  await client(c).send(new CopyObjectCommand({ Bucket: c.bucket, CopySource: `${c.bucket}/${from}`, Key: to }));
}

export async function headSize(key: string): Promise<number | null> {
  const c = readConfig();
  try {
    const r = await client(c).send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
    return r.ContentLength ?? 0;
  } catch (e) {
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function deleteImage(key: string): Promise<void> {
  if (!isValidKey(key)) throw new Error("Khoá ảnh không hợp lệ.");
  const c = readConfig();
  await client(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
}

export const imageUrl = (key: string) => `/api/admin/images?key=${encodeURIComponent(key)}`;
