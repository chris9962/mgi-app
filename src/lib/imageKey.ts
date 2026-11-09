export const FOLDERS = ["samples", "qr", "logos", "proofs"] as const;
export type Folder = (typeof FOLDERS)[number];

// Ảnh chứng minh của học sinh chỉ đi qua route của học sinh; trang quản lý chỉ tải ảnh mẫu, ảnh QR và logo ngân hàng.
export const ADMIN_FOLDERS = ["samples", "qr", "logos"] as const satisfies readonly Folder[];

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Khoá đi vào Key của S3 và vào URL đọc ảnh; chỉ nhận đúng dạng <thư mục>/<ngày>/<uuid>.<đuôi>.
const KEY = new RegExp(`^(${FOLDERS.join("|")})/\\d{4}-\\d{2}-\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|heic)$`);

export const isImageKey = (key: string, folder?: Folder): boolean => KEY.test(key) && (!folder || key.startsWith(`${folder}/`));

// Ảnh học sinh chỉ người quản ngân hàng của dòng đó được xem: route chung của trang quản lý không đọc thư mục proofs.
export const isAdminImageKey = (key: string): boolean => ADMIN_FOLDERS.some((f) => isImageKey(key, f));

// Ảnh mẫu, ảnh QR và logo hiện cho học sinh trên mọi trình duyệt; Chrome và Android không hiện được HEIC.
// Ảnh học sinh giữ HEIC gốc khi máy chủ không đổi được sang WebP: nhân viên vẫn có ảnh để xem.
export const allowedExt = (folder: Folder, ext: string): boolean =>
  folder === "proofs" ? ["jpg", "png", "webp", "heic"].includes(ext) : FOLDERS.includes(folder) && ["jpg", "png", "webp"].includes(ext);

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heic" };
export const extForMime = (mime: string): string | null => EXT_BY_MIME[mime.toLowerCase()] ?? null;

// Chặn theo Content-Length trước khi đọc body: formData() đọc trọn request vào bộ nhớ rồi mới biết file lớn. Trần rộng hơn 20 MB vì multipart có phần bao.
export const bodyTooLarge = (request: Request): boolean => Number(request.headers.get("content-length") ?? 0) > 22 * 1024 * 1024;
