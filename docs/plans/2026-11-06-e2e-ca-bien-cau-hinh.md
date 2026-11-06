# E2E ca biên nhóm C: cấu hình và tài khoản

Kế hoạch chung ở `docs/plans/2026-11-06-e2e-ca-bien.md`. File này ghi danh sách ca của nhóm C, rồi kết quả chạy.
Tên miền quản lý `http://admin.localhost:3100`. Test ở `e2e/edge-config*.spec.ts`, ca thuần máy chủ ở `tests/db/`.

Dữ liệu test mang tiền tố `ZZE2E ` và tài khoản `zz_e2e_c_*`, tạo trong test qua API bằng tài khoản `zz_e2e_admin`.
Tài khoản dùng chung `zz_e2e_*` của seed chỉ dùng để đăng nhập, không bị khoá, đổi mật khẩu hay đổi quyền.

Mỗi ca ghi: thao tác hoặc dữ liệu vào, rồi kết quả đúng. Ca có dấu "(để lại)" là lỗi đã ghi ở mục "Việc để lại" của kế hoạch cũ.

## Đăng nhập `/login`

1. Chữ dài
   - DN1: tên đăng nhập 300 ký tự liền, mật khẩu bất kỳ. Báo "không đúng", không lỗi 500. Ô nhập và câu báo không tràn ở 390 px.
2. Ký tự đặc biệt
   - DN2: tên `' or 1=1 --`, `<script>`, emoji. Báo "không đúng", không đăng nhập được, không lỗi 500.
3. Tìm kiếm: không áp dụng, trang không có ô tìm.
4. Bộ lọc và URL
   - DN3: đã đăng nhập mà mở `/login`. Về trang chủ của vai.
5. Phân trang: không áp dụng, trang không có danh sách.
6. Ngày giờ: không áp dụng, hạn khoá 15 phút tính bằng `now()` của Postgres, màn không hiện giờ.
7. Form
   - DN4: bỏ trống cả hai ô, hoặc tên chỉ có khoảng trắng. Báo "Nhập tên đăng nhập và mật khẩu.", không gọi API.
   - DN5: tên viết HOA và có khoảng trắng đầu cuối, mật khẩu đúng. Đăng nhập được.
   - DN6: sai mật khẩu với `ZZ_E2E_C_...`, rồi ` zz_e2e_c_... `, rồi `zz_e2e_c_...`. Lần 3 hiện hộp "Sắp bị khoá" ghi 3 lần: máy chủ và trình duyệt cùng đếm theo tên đã bỏ khoảng trắng, viết thường.
   - DN7: sai 2 lần với tên A, rồi sai với tên B. Tên B đếm lại từ 1, không hiện hộp nhắc.
   - DN8: tài khoản đang khoá 15 phút, nhập đúng mật khẩu. Vẫn báo khoá.
   - DN9: tài khoản bị Quản trị khoá hẳn, nhập đúng mật khẩu. Báo "không đúng" như tên không có thật.
   - DN10: bấm Đăng nhập hai lần liền. Chỉ một request, nút đổi thành "Đang kiểm tra…" và bị khoá.
   - DN11: mất mạng lúc gửi. Báo "Không đăng nhập được. Kiểm tra kết nối mạng rồi thử lại.", nút mở lại.
   - DN12: nhấn Enter ở ô mật khẩu. Form gửi đi.
8. Phân quyền
   - DN13: gọi `POST /api/admin/login` không có Origin, hoặc Origin lạ. Trả 403.
9. Đồng thời
   - DN14: hai tab cùng phiên, đăng xuất ở tab 1. Tab 2 chuyển trang thì về `/login`, gọi API thì nhận 401.
10. Rỗng: gộp vào DN4.
11. Xuất Excel: không áp dụng.
12. Link: không áp dụng.
13. Tải ảnh: không áp dụng.
14. Điện thoại
   - DN15: ở 390x844, hộp "Sắp bị khoá" và câu báo khoá nằm trọn màn, nút "Đã hiểu" bấm được.

## Khung trang: Tổng quan `/`, sidebar, thanh đáy, menu tài khoản, phân quyền

1. Chữ dài
   - KH1: họ tên 150 ký tự liền và chức danh dài. Nút tài khoản ở sidebar cắt chữ, không tràn sidebar, ở 1366 px và trong ngăn trượt 390 px.
2. Ký tự đặc biệt
   - KH2: họ tên `<img src=x onerror=alert(1)>` hiện nguyên văn dạng chữ, không chạy script.
   - KH3: họ tên có emoji ở từ cuối. Ô chữ tắt không hiện ký tự hỏng (nửa cặp surrogate).
3. Tìm kiếm: không áp dụng.
4. Bộ lọc và URL
   - KH4: `/` chuyển Quản trị và Quản lý về `/users`, Nhân viên về `/profile`.
   - KH5: đường dẫn không có trang. Trả 404, không lỗi 500.
5. Phân trang: không áp dụng.
6. Ngày giờ: không áp dụng.
7. Form: không áp dụng.
8. Phân quyền
   - KH6: menu theo vai. Nhân viên không quyền: không mục nào. Nhân viên có quyền Trường và QR: chỉ Trường. Nhân viên được giao ngân hàng: Hồ sơ học sinh, Ngân hàng (Nghiệp vụ), Ngân hàng, Mã giới thiệu, Tin SMS lỗi. Quản lý: đủ trừ Cài đặt và Vận hành hệ thống.
   - KH7: mở thẳng URL trang không có trong menu (`/schools`, `/banks`, `/banks/codes`, `/users`, `/settings`, `/ops`). Trả 404.
   - KH8: Quản trị gỡ quyền Trường và QR giữa phiên. Nhân viên tải lại thì menu mất mục Trường, `/schools` trả 404, bấm Tạo trường ở hộp thoại đang mở thì báo không có quyền.
   - KH9: Quản trị khoá tài khoản giữa phiên. Người bị khoá chuyển trang thì về `/login`, gọi API nhận 401.
   - KH10: mục đang chọn. `/banks/codes` chỉ đánh dấu "Mã giới thiệu", `/banks` chỉ đánh dấu "Ngân hàng" của nhóm Cấu hình dữ liệu.
9. Đồng thời: gộp vào DN14 và KH9.
10. Rỗng
   - KH11: Nhân viên không quyền nào. Sidebar không có nhóm, chỉ có nút tài khoản.
11. Xuất Excel: không áp dụng.
12. Link: không áp dụng.
13. Tải ảnh: không áp dụng.
14. Điện thoại: gộp vào KH1.

## Trường `/schools`

1. Chữ dài
   - TR1: tên trường 250 ký tự có dấu cách và 120 ký tự liền, người liên hệ 120 ký tự. Bảng cuộn trong khung, trang không cuộn ngang ở 1366 px và 390 px.
   - TR2: hộp Sửa trường và hộp Đóng trường của tên 120 ký tự liền nằm trọn màn, nút Đóng hộp và nút xác nhận thấy được, ở 1366 px và 390 px.
2. Ký tự đặc biệt
   - TR3: tên `ZZE2E <script>alert(1)</script> 'O"Brien\ 50%_x 🎓` lưu và hiện nguyên văn. Khoảng trắng đầu cuối bị bỏ.
   - TR4: tìm `%` và `_` chỉ ra trường có đúng ký tự đó. Tìm `'`, `\`, `<script>` không lỗi 500.
3. Tìm kiếm
   - TR5: "nguyen du" ra trường "Nguyễn Du", viết HOA ra như thường, một phần tên ra, tên xã không dấu ra.
   - TR6: nhiều khoảng trắng giữa hai từ vẫn ra. Ô chỉ có khoảng trắng thì như không tìm.
   - TR7: từ khoá 500 ký tự. Báo "Không có trường khớp từ khoá.", không lỗi.
   - TR8: đang ở trang 2, đổi từ khoá. Về trang 1.
4. Bộ lọc và URL
   - TR9: `page=0`, `-1`, `abc`, `1.5`, `999`. Trang hiện bình thường, số trang nằm trong khoảng có.
   - TR10: `q` lặp hai lần trên URL (`?q=a&q=b`). Trang hiện bình thường, không lỗi 500.
   - TR11: tìm rồi bấm Sau, bấm Quay lại của trình duyệt. Ô tìm và danh sách về đúng trang trước.
5. Phân trang
   - TR12: 16 trường khớp từ khoá. Trang 1 có 15 dòng, ghi "1–15 trên 16"; trang 2 có 1 dòng, ghi "16–16 trên 16", không có nút Sau.
   - TR13: đóng trường cuối trang 1. Trường đóng xuống cuối danh sách, tổng không đổi.
6. Ngày giờ: không áp dụng, trang không hiện ngày.
7. Form
   - TR14: bấm Tạo trường khi bỏ trống mọi ô. Mỗi ô báo lỗi của ô đó.
   - TR15: tên và người liên hệ chỉ có khoảng trắng. Báo lỗi ô.
   - TR16: SĐT 9 số, 11 số, không bắt đầu bằng 0, có chữ. Báo lỗi ô SĐT.
   - TR17: SĐT `0903 111 222` và `0903.111.222`. Ruling, xem mục kết quả.
   - TR18: chưa chọn tỉnh thì ô xã bị khoá. Đổi tỉnh thì xã đã chọn bị bỏ.
   - TR19: gọi API với xã không thuộc tỉnh. Trả 400, lỗi gắn ô xã.
   - TR20: nhấn Enter ở ô tên. Form gửi. Bấm Tạo trường hai lần liền chỉ tạo một trường.
   - TR21: gõ dở rồi Huỷ, mở lại Thêm trường. Form trống, không còn lỗi cũ. Sửa rồi Huỷ, mở lại Sửa. Form hiện dữ liệu đang lưu.
   - TR22: tên trùng trường đã có. Ruling, xem mục kết quả.
8. Phân quyền
   - TR23: Nhân viên có quyền Trường và QR nhưng không có Xuất Excel. Không thấy nút Xuất Excel, gọi API xuất nhận 403.
   - TR24: Nhân viên không có quyền Trường. API tạo, sửa, đóng, QR, xã nhận 403.
   - TR25: sửa, đóng, tải QR với id sai dạng hoặc id không có. Trả 404.
9. Đồng thời
   - TR26: tab 1 đóng trường, tab 2 còn nút "Đóng" cũ bấm Đóng. Không lỗi, trường vẫn đóng.
10. Rỗng
   - TR27: tìm không khớp. Bảng ghi "Không có trường khớp từ khoá.", Xuất Excel ra file chỉ có đầu bảng.
11. Xuất Excel
   - TR28: xuất theo từ khoá. File chỉ có trường khớp. Tên `=1+1`, `+84`, `-5`, `@SUM(A1)` là ô chữ, không phải công thức. Tên dài giữ đủ. SĐT giữ số 0 đầu.
12. Link
   - TR29: trình duyệt chặn clipboard. Bấm Chép link báo "Không chép được".
   - TR30: tải ảnh QR của trường tên đặc biệt. Tên file chỉ có chữ, số, gạch ngang.
13. Tải ảnh: không áp dụng, trường không có ô tải ảnh.
14. Điện thoại: gộp vào TR1, TR2.

## Ngân hàng `/banks` và hướng dẫn

1. Chữ dài
   - NH1: tên ngân hàng 120 ký tự liền. Bảng cuộn trong khung. Tiêu đề hộp Hướng dẫn và câu hỏi hộp Tắt xuống hàng, nút Đóng hộp không bị đẩy ra ngoài, ở 1366 px và 390 px.
2. Ký tự đặc biệt
   - NH2: tên `ZZE2E <b>đậm</b> & "x"` hiện nguyên văn.
3. Tìm kiếm
   - NH3: ô chọn người quản tìm không dấu và theo tên đăng nhập. Danh sách ngân hàng không có ô tìm vì ngắn, không phân trang.
4. Bộ lọc và URL: không áp dụng, trang không đọc tham số.
5. Phân trang: không áp dụng, danh sách ngân hàng nhỏ, không phân trang.
6. Ngày giờ: không áp dụng.
7. Form ngân hàng
   - NH4: mã viết thường thì lưu thành in hoa. Mã 1 ký tự, 11 ký tự, có dấu, có gạch ngang thì báo lỗi ô mã.
   - NH5: mã trùng ngân hàng khác (khác hoa thường). Báo "Mã ngân hàng đã có." ở ô mã.
   - NH6: độ ưu tiên `-1`, `1000`, `1.5`, `abc` báo lỗi ô. Bỏ trống ô độ ưu tiên: mgst-app báo lỗi chứ không lặng lẽ thành 0.
   - NH7: tên chỉ có khoảng trắng. Báo lỗi ô tên.
   - NH8: hai request tạo cùng mã cùng lúc. Một 201, một 409, không có 500 (để lại).
   - NH9: người quản đã bị khoá. Sửa tên ngân hàng vẫn lưu được (để lại).
   - HD1: hướng dẫn 21 bước báo "Tối đa 20 bước". Dòng trống bị bỏ, số thứ tự đầu dòng ("1.", "2)") bị bỏ.
   - HD2: bỏ hết khung báo "Cần ít nhất 1 ảnh cần nộp". 11 khung báo "Tối đa 10 ảnh". Tên khung trống báo "Nhập tên ảnh".
8. Phân quyền
   - NH10: Nhân viên được giao một ngân hàng. Không có nút Thêm, sửa ngân hàng mình được, danh sách người quản giữ nguyên dù gửi khác.
   - NH11: Nhân viên gọi API sửa, bật tắt, đọc và lưu hướng dẫn của ngân hàng không được giao. Trả 404.
   - NH12: Quản trị đọc và lưu hướng dẫn của id ngân hàng không có. Trả 404, không lỗi 500.
9. Đồng thời
   - NH13: tab 1 bỏ một khung ảnh và lưu, tab 2 lưu bản cũ còn khung đó. Báo lỗi, không lỗi 500, không tạo lại khung đã bỏ.
10. Rỗng
   - NH14: ngân hàng chưa có hướng dẫn. Hộp mở với một khung trống, cột ảnh ghi "Chưa cài", chưa có người quản ghi "Chưa giao".
11. Xuất Excel: không áp dụng, trang không có nút xuất.
12. Link: không áp dụng, link mở tài khoản nằm ở mã giới thiệu.
13. Tải ảnh mẫu
   - HD3: file văn bản đổi đuôi `.jpg`, file 0 byte. Báo "Chỉ nhận ảnh jpg, png, webp hoặc heic.", không lưu gì lên S3.
14. Điện thoại: gộp vào NH1.

## Kho mã giới thiệu `/banks/codes`

1. Chữ dài
   - MA1: tên hiển thị 120 ký tự liền, mã text 80 ký tự liền. Bảng cuộn trong khung, trang không cuộn ngang ở 1366 px và 390 px.
   - MA2: chọn trường tên 120 ký tự liền trong hộp Thêm mã. Thẻ trường đã chọn không tràn hộp.
2. Ký tự đặc biệt
   - MA3: tìm `%`, `_` chỉ ra mã có đúng ký tự đó.
3. Tìm kiếm
   - MA4: gõ liền 6 ký tự. URL chỉ đổi một lần sau khi ngừng gõ 300 ms, ra đúng mã.
   - MA5: tìm không dấu theo tên hiển thị, tìm theo mã text. Ô chỉ có khoảng trắng không đưa `q` lên URL.
   - MA6: gõ rồi bấm sang trang khác trước 300 ms. Trang mới không bị kéo về Kho mã.
4. Bộ lọc và URL
   - MA7: kết hợp ngân hàng, từ khoá, ẩn mã đã ngừng. Đổi một lọc thì về trang 1, giữ các lọc khác. Đổi tháng giữ lọc.
   - MA8: `month=2026-13`, `month=abc` về tháng hiện tại. `bank` là uuid lạ hoặc ngân hàng ngoài phạm vi thì bỏ lọc. `page=0`, `abc`, `999` bình thường. `q` lặp không lỗi 500.
   - MA9: Quay lại của trình duyệt. Ô tìm, ô ngân hàng hiện đúng lọc của URL.
5. Phân trang
   - MA10: 16 mã khớp. Trang 1 có 15, trang 2 có 1, meta ghi "16 mã".
6. Ngày giờ
   - MA11: tháng 12/2026 bấm Tháng sau ra 01/2027, tháng 01/2027 bấm Tháng trước ra 12/2026.
7. Form mã
   - MA12: tên trống, chỉ khoảng trắng. Báo lỗi ô tên. Không có mã text và ảnh QR. Báo lỗi ô mã text.
   - MA13: số lượt `0`, `-1`, `1.5`, `abc`, `100001`; độ ưu tiên `-1`, `1000`. Báo lỗi đúng ô.
   - MA14: tên trùng trong cùng ngân hàng báo ở ô tên. Cùng tên ở ngân hàng khác lưu được.
   - MA15: hai request tạo cùng tên cùng lúc. Một 201, một 409, không 500 (để lại).
   - MA16: API với `schoolIds` không có, `bankId` không có. Trả 400 hoặc 404, không 500 (để lại). Gắn thêm trường đã đóng bị từ chối (để lại).
8. Phân quyền
   - MA17: Nhân viên được giao một ngân hàng chỉ thấy mã ngân hàng đó, ô Ngân hàng trong hộp chỉ có ngân hàng đó. Sửa, ngừng mã ngân hàng khác qua API nhận 404.
9. Đồng thời
   - MA18: mã của ngân hàng đã tắt. Hộp Sửa mã hiện đúng tên ngân hàng của mã (để lại).
10. Rỗng
   - MA19: Nhân viên có mã mà mọi mã đã ngừng, bật "Ẩn mã đã ngừng". Bảng ghi "Không có mã khớp bộ lọc.", không ghi "Chưa có mã giới thiệu nào.".
11. Xuất Excel: không áp dụng, trang không có nút xuất.
12. Link
   - MA20: link mở tài khoản `javascript:alert(1)`, `example.com`, `https://exa mple.com`. Hai link đầu báo lỗi. Link có dấu cách: Ruling, xem mục kết quả.
13. Tải ảnh QR
   - MA21: file không phải ảnh đổi đuôi `.png`. Báo lỗi, ô ảnh không giữ ảnh, không lưu gì lên S3.
14. Điện thoại: gộp vào MA1, MA2.

## Tài khoản `/users`, `/users/[id]`

1. Chữ dài
   - TK1: họ tên 150 ký tự liền, chức danh 150 ký tự. Bảng cuộn trong khung. Tiêu đề trang chi tiết xuống hàng, trang không cuộn ngang ở 1366 px và 390 px. Hộp Khoá tài khoản nằm trọn.
2. Ký tự đặc biệt
   - TK2: họ tên `<script>` và `'` hiện nguyên văn ở bảng, tiêu đề, hộp thoại.
3. Tìm kiếm
   - TK3: tìm không dấu, viết HOA, một phần tên đăng nhập. `_` và `%` là chữ thường, không phải ký tự đại diện. Ô chỉ khoảng trắng như không tìm. Không khớp ghi "Không có tài khoản khớp từ khoá.".
4. Bộ lọc và URL
   - TK4: `page=0`, `-1`, `abc`, `1.5`, `999` và `q` lặp. Không lỗi 500. `/users/abc`, `/users/<uuid lạ>` trả 404.
5. Phân trang
   - TK5: 16 tài khoản khớp từ khoá. Trang 1 có 15, trang 2 có 1.
6. Ngày giờ: không áp dụng, "Khoá tạm" so với giờ hiện tại, test cũ đã có.
7. Form
   - TK6: họ tên trống hoặc chỉ khoảng trắng báo lỗi ô. Tên đăng nhập viết HOA lưu thành thường. Có dấu cách giữa, có dấu tiếng Việt, 2 ký tự, 33 ký tự báo lỗi ô. SĐT sai dạng báo lỗi ô.
   - TK7: tên đăng nhập trùng khác hoa thường báo "Tên đăng nhập đã có." ở ô. Mã tài khoản trùng báo "Mã tài khoản đã có.".
   - TK8: hai request tạo cùng tên đăng nhập cùng lúc. Một 201, một 409, không 500 (để lại).
   - TK9: bấm Tạo tài khoản hai lần liền chỉ tạo một tài khoản.
   - TK10: bấm Esc lúc đang chờ máy chủ tạo tài khoản. Hộp không đóng, mật khẩu mới vẫn hiện (để lại).
   - TK11: gõ dở rồi Huỷ, mở lại. Form trống.
   - TK12: đổi vai Nhân viên có quyền sang Quản lý. Ô quyền ẩn, lưu xong trang chi tiết ghi "Toàn quyền".
   - TK13: Quản trị tự đổi vai của mình. Báo "Không tự đổi vai của chính mình." ở ô Vai.
8. Phân quyền
   - TK14: Quản lý không thấy nút sửa, khoá ở dòng Quản trị, ô Vai không có Quản trị. API sửa, khoá, đặt lại mật khẩu của Quản trị nhận 403 (để lại: đang trả 400).
   - TK15: Nhân viên gọi API tài khoản nhận 403.
   - TK16: không có nút Khoá và nút Đặt lại mật khẩu cho chính mình (để lại: đặt lại mật khẩu của mình làm mình bị đăng xuất).
   - TK17: đặt lại mật khẩu. Mật khẩu cũ không đăng nhập được, phiên cũ của người đó bị đăng xuất, mật khẩu mới đăng nhập được.
9. Đồng thời
   - TK18: tab 1 khoá tài khoản, tab 2 còn nút Khoá cũ bấm Khoá. Không lỗi, tài khoản vẫn khoá.
10. Rỗng: gộp vào TK3.
11. Xuất Excel: không áp dụng.
12. Link: không áp dụng.
13. Tải ảnh: không áp dụng.
14. Điện thoại: gộp vào TK1.

## Cá nhân `/profile`

1. Chữ dài
   - CN1: họ tên 150 ký tự liền. Dòng Họ tên không tràn khung, chữ không bị cắt mất ở 390 px.
2. Ký tự đặc biệt
   - CN2: họ tên `<b>x</b>` hiện nguyên văn.
3. Tìm kiếm, 4. URL, 5. Phân trang, 6. Ngày giờ: không áp dụng, trang không có danh sách.
7. Form
   - CN3: họ tên trống, chỉ khoảng trắng; SĐT sai dạng. Báo lỗi ô.
   - CN4: nhập sai rồi Huỷ, mở lại. Không còn lỗi cũ (để lại), ở cả Sửa thông tin và Đổi mật khẩu.
   - CN5: mật khẩu nhập lại khác. Báo "Hai lần nhập không giống nhau" ở ô nhập lại.
   - CN6: mật khẩu hiện tại sai. Báo "Mật khẩu hiện tại không đúng." ở ô đó. Sai 5 lần thì báo khoá 15 phút, đăng nhập lại cũng bị khoá.
   - CN7: mất mạng lúc lưu. Báo "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.".
   - CN8: đổi mật khẩu xong. Phiên đang dùng còn, phiên ở trình duyệt khác bị đăng xuất, mật khẩu cũ hỏng, mật khẩu mới có dấu cách ở đầu cuối vẫn đăng nhập được đúng nguyên văn.
8. Phân quyền
   - CN9: API sửa thông tin và đổi mật khẩu không có Origin nhận 403, không có phiên nhận 401.
9. Đồng thời: gộp vào CN8.
10. Rỗng: SĐT để trống thì ghi "Chưa có".
11, 12, 13: không áp dụng.
14. Điện thoại: gộp vào CN1.

## Cài đặt `/settings`

1. Chữ dài
   - CD1: mẫu SMS 400 ký tự. Đếm "400/160 ký tự, 3 tin".
   - CD2: link Zalo 3.000 ký tự. Trang không vỡ. Máy chủ không lưu link dài quá QR chứa được, vì web học sinh vẽ QR của link này.
2. Ký tự đặc biệt
   - CD3: mẫu có chữ có dấu, emoji. Báo "Mẫu SMS viết không dấu".
   - CD4: mẫu có xuống dòng. Báo lỗi đúng nghĩa. Ruling, xem mục kết quả.
3, 4, 5, 6: không áp dụng, trang là một form.
7. Form
   - CD5: mẫu trống, chỉ khoảng trắng. Báo "Nhập mẫu SMS".
   - CD6: biến `{HOTEN}`, `{ho_ten}`, `{}`. Báo "Mẫu SMS có biến không có thật: ...". Ngoặc lẻ `{HO_TEN` báo "Mẫu SMS có dấu ngoặc { } lẻ".
   - CD7: mẫu thiếu `{MA_VOUCHER}`. Ruling, xem mục kết quả.
   - CD8: lưu được một lần, rồi gõ sai và bấm Lưu. Không còn câu "Đã lưu cấu hình." đứng cạnh lỗi.
8. Phân quyền
   - CD9: Quản lý và Nhân viên mở `/settings`, `/ops` nhận 404, gọi `PATCH /api/admin/settings` nhận 403.
9. Đồng thời: không áp dụng, bản lưu sau thắng, cài đặt chỉ Quản trị sửa.
10. Rỗng
   - CD10: link Zalo trống. Ô QR ghi "Chưa có link", lưu được.
11. Xuất Excel: không áp dụng.
12. Link
   - CD11: `javascript:alert(1)`, `zalo.me/abc`, `https://zalo.me/ abc`, `data:text/html,x`. Báo lỗi ô, ô QR ghi "Chưa có link". `HTTPS://ZALO.ME/X` lưu được.
13. Tải ảnh: không áp dụng.
14. Điện thoại
   - CD12: ở 390 px, trang không cuộn ngang khi link dài.

Mọi test Cài đặt đặt lại đúng giá trị cũ trong `finally`.

## Vận hành hệ thống `/ops`

- 1. Chữ dài: tên ngân hàng dài trong bảng Kiểm ảnh nằm trong khung cuộn. Gộp vào test "không trang nào cuộn ngang" của NH1.
- 8. Phân quyền: gộp vào CD9.
- 10. Rỗng: "Chưa có số đo." khi bảng `host_metrics` rỗng. Chưa test: bảng này là số đo thật của DB local, không xoá được.
- Các loại khác: không áp dụng, trang chỉ đọc, không có form, tham số, danh sách phân trang.

## API chung

- API1: mọi route ghi của nhóm C không có Origin, Origin lạ nhận 403; không có phiên nhận 401.
- API2: body không phải JSON, `active: "true"` (chuỗi) nhận 400, không 500.
- API3: `/api/admin/uploads` thư mục lạ, không có file, file 0 byte, file không phải ảnh nhận 400. `/api/admin/images` khoá sai dạng hoặc khoá thư mục `proofs` nhận 404.
- API4: `/api/admin/wards?province=abc` trả danh sách rỗng.
