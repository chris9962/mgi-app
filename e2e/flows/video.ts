// Video cho chủ dự án duyệt flow: góc trái trên ghi tên flow và bước đang chạy, con trỏ chỉ chỗ bấm.
export const flowVideo = (width: number, height: number) =>
  ({ mode: "on", size: { width, height }, show: { test: { level: "step", position: "top-left" }, actions: { position: "bottom-right", fontSize: 12 } } }) as const;
