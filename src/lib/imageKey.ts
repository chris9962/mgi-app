export const FOLDERS = ["samples", "qr"] as const;
export type Folder = (typeof FOLDERS)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Khoá đi vào Key của S3 và vào URL đọc ảnh; chỉ nhận đúng dạng <thư mục>/<ngày>/<uuid>.<đuôi>.
const KEY = new RegExp(`^(${FOLDERS.join("|")})/\\d{4}-\\d{2}-\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|heic)$`);

export const isImageKey = (key: string, folder?: Folder): boolean => KEY.test(key) && (!folder || key.startsWith(`${folder}/`));

// Ảnh mẫu và ảnh QR hiện cho học sinh trên mọi trình duyệt; Chrome và Android không hiện được HEIC.
export const allowedExt = (folder: Folder, ext: string): boolean => (FOLDERS.includes(folder) ? ["jpg", "png", "webp"].includes(ext) : false);

// Chặn theo Content-Length trước khi đọc body: formData() đọc trọn request vào bộ nhớ rồi mới biết file lớn.
export const bodyTooLarge = (request: Request): boolean => Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 64 * 1024;
