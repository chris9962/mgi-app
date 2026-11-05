export const unauthorized = () => Response.json({ message: "Chưa đăng nhập hoặc phiên đã hết hạn." }, { status: 401 });
export const forbidden = () => Response.json({ message: "Không có quyền thực hiện thao tác này." }, { status: 403 });
export const badRequest = (message = "Dữ liệu không hợp lệ.") => Response.json({ message }, { status: 400 });
// Bản ghi ngoài phạm vi trả 404 giống bản ghi không tồn tại, để không dò được id nào có thật.
export const notFound = () => Response.json({ message: "Không tìm thấy." }, { status: 404 });
export const jsonBody = (request: Request): Promise<unknown> => request.json().catch(() => null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID.test(id);
