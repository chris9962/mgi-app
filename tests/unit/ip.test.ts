import { describe, expect, test } from "bun:test";
import { ipFrom } from "../../src/server/http/ip";

const req = (xff?: string) => new Request("http://admin.localhost/x", { headers: xff === undefined ? {} : { "x-forwarded-for": xff } });

describe("IP của người gửi", () => {
  test("lấy địa chỉ cuối của X-Forwarded-For: Nginx nối địa chỉ thật vào cuối, phần đầu do người gửi tự khai", () => {
    expect(ipFrom(req("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(ipFrom(req("203.0.113.9"))).toBe("203.0.113.9");
    expect(ipFrom(req(" 2001:db8::1 "))).toBe("2001:db8::1");
  });

  test("không có header hoặc địa chỉ cuối không phải IP thì không ghi", () => {
    expect(ipFrom(req())).toBeNull();
    expect(ipFrom(req("203.0.113.9, khong-phai-ip"))).toBeNull();
    expect(ipFrom(req(""))).toBeNull();
  });
});
