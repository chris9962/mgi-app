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
   - TR31: "anh nguyen" ra trường "Nguyễn Thị Anh". Một từ ở tên trường, một từ ở tên xã cũng ra. Ô tìm nhận tối đa 100 ký tự.
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
   - TR32: xuất với `q=%00` trên URL. Ra file, không lỗi 500. Test DB.
   - TR33: Nhân viên có Xuất Excel mà không có quyền Trường. Trang `/schools` trả 404, API xuất nhận 403.
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
   - NH15: ô chọn người quản gõ "anh nguyen" ra "Nguyễn Thị Anh". Một từ ở họ tên, một từ ở tên đăng nhập cũng ra. Ô nhận tối đa 100 ký tự.
   - NH16: máy chủ báo lỗi ở ô Người quản. Lỗi gắn vào ô chọn người quản qua `aria-describedby`.
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
   - HD1: hướng dẫn 21 bước báo "Tối đa 20 bước". Dòng trống bị bỏ, số thứ tự đầu dòng ("1.", "2)") bị bỏ. Bước dán từ Word có tab (`•\tChụp\tảnh`) lưu thành `• Chụp ảnh`.
   - HD2: bỏ hết khung báo "Cần ít nhất 1 ảnh cần nộp". 11 khung báo "Tối đa 10 ảnh". Tên khung trống báo "Nhập tên ảnh".
8. Phân quyền
   - NH10: Nhân viên được giao một ngân hàng. Không có nút Thêm, sửa ngân hàng mình được, danh sách người quản giữ nguyên dù gửi khác.
   - NH11: Nhân viên gọi API sửa, bật tắt, đọc và lưu hướng dẫn của ngân hàng không được giao. Trả 404.
   - NH12: Quản trị đọc và lưu hướng dẫn của id ngân hàng không có. Trả 404, không lỗi 500.
9. Đồng thời
   - NH13: tab 1 bỏ một khung ảnh và lưu, tab 2 lưu bản cũ còn khung đó. Báo lỗi, không lỗi 500, không tạo lại khung đã bỏ.
   - NH17: tab 1 thêm một khung ảnh và lưu, tab 2 lưu bản cũ không có khung đó. Báo "Hướng dẫn đã có người sửa. Mở lại để xem bản mới.", khung tab 1 vừa thêm vẫn còn.
   - NH18: hộp Thêm ngân hàng, Hướng dẫn đang chờ máy chủ lưu. Huỷ bị khoá, không có nút Đóng, nhấn Esc 4 lần hộp vẫn mở. Máy chủ báo lỗi thì câu báo hiện trong hộp, Huỷ đóng được.
10. Rỗng
   - NH14: ngân hàng chưa có hướng dẫn. Hộp mở với một khung trống, cột ảnh ghi "Chưa cài", chưa có người quản ghi "Chưa giao".
11. Xuất Excel: không áp dụng, trang không có nút xuất.
12. Link: không áp dụng, link mở tài khoản nằm ở mã giới thiệu.
13. Tải ảnh mẫu
   - HD3: file văn bản đổi đuôi `.jpg`, file 0 byte. Báo "Chỉ nhận ảnh jpg, png, webp hoặc heic.", không lưu gì lên S3.
   - HD4: ảnh mẫu 23 MB. Báo "Ảnh lớn hơn 20 MB." ở ô ảnh đó, không gửi request. Nginx trả 413 dạng HTML cũng báo câu đó ở ô ảnh.
   - HD5: ảnh mẫu của khung một đang tải. Nút đổi ảnh của mọi khung bị khoá, Lưu bị khoá. Tải xong khung một giữ đúng ảnh vừa tải.
   - HD6: huỷ hộp chọn ảnh mẫu. Hộp Hướng dẫn vẫn mở, các bước và tên ảnh đang gõ còn, Esc vẫn đóng hộp.
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
   - MA24: như MA6 nhưng trang mới trả chậm 900 ms. Vẫn ở lại trang mới.
   - MA29: gõ rồi bấm Tháng sau hay nút Sau trước 300 ms. Ô tìm khớp từ khoá trên URL, bảng lọc đúng như ô tìm.
   - MA22: nhiều từ khác thứ tự, một từ ở tên hiển thị, một từ ở mã text. Ô tìm và ô chọn trường nhận tối đa 100 ký tự. Ô chọn trường tìm nhiều từ.
4. Bộ lọc và URL
   - MA7: kết hợp ngân hàng, từ khoá, ẩn mã đã ngừng. Đổi một lọc thì về trang 1, giữ các lọc khác. Đổi tháng giữ lọc.
   - MA8: `month=2026-13`, `month=abc` về tháng hiện tại. `bank` là uuid lạ hoặc ngân hàng ngoài phạm vi thì bỏ lọc. `page=0`, `abc`, `999` bình thường. `q` lặp không lỗi 500.
   - MA9: Quay lại của trình duyệt. Ô tìm, ô ngân hàng hiện đúng lọc của URL.
5. Phân trang
   - MA10: 16 mã khớp. Trang 1 có 15, trang 2 có 1, meta ghi "16 mã".
   - MA27: bật Ẩn mã đã ngừng, đứng ở trang 2 còn 1 mã, ngừng mã đó. Bảng hiện 15 mã, thanh phân trang ghi "1–15 trên 15" và "1 / 1".
   - MA23: 16 mã cùng thứ tự ngân hàng, cùng độ ưu tiên, cùng tên. Mã xếp theo id, trang 1 và trang 2 không lặp, không sót mã. Test DB.
6. Ngày giờ
   - MA11: tháng 12/2026 bấm Tháng sau ra 01/2027, tháng 01/2027 bấm Tháng trước ra 12/2026.
   - MA28: `month=0001-01`, `0099-12`, `1899-12`. Hiện tháng hiện tại, bấm Tháng sau ra tháng sau của tháng hiện tại.
7. Form mã
   - MA12: tên trống, chỉ khoảng trắng. Báo lỗi ô tên. Không có mã text và ảnh QR. Báo lỗi ô mã text.
   - MA13: số lượt `0`, `-1`, `1.5`, `abc`, `100001`; độ ưu tiên `-1`, `1000`. Báo lỗi đúng ô.
   - MA14: tên trùng trong cùng ngân hàng báo ở ô tên. Cùng tên ở ngân hàng khác lưu được.
   - MA15: hai request tạo cùng tên cùng lúc. Một 201, một 409, không 500 (để lại).
   - MA16: API với `schoolIds` không có, `bankId` không có. Trả 400 hoặc 404, không 500 (để lại). Gắn thêm trường đã đóng bị từ chối (để lại).
   - MA25: tạo mã cho ngân hàng vừa tắt, qua API hay ở tab còn mở hộp Thêm mã. Báo "Ngân hàng đã tắt." ở ô Ngân hàng, trả 400.
   - MA32: hộp Thêm mã đang chờ máy chủ lưu. Huỷ bị khoá, không có nút Đóng, nhấn Esc 4 lần hộp vẫn mở. Máy chủ báo lỗi thì câu báo hiện trong hộp.
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
   - MA26: ảnh QR 23 MB. Báo "Ảnh lớn hơn 20 MB." ở ô Ảnh QR, không gửi request. Nginx trả 413 dạng HTML cũng báo câu đó ở ô Ảnh QR.
   - MA30: ảnh QR đang tải. Nút chọn ảnh QR và nút Tạo mã bị khoá, không chọn được ảnh thứ hai. Tải xong ô ảnh giữ đúng ảnh vừa tải.
   - MA31: huỷ hộp chọn ảnh QR. Hộp Thêm mã vẫn mở, chữ đang gõ còn, Esc vẫn đóng hộp.
14. Điện thoại: gộp vào MA1, MA2.

## Tài khoản `/users`, `/users/[id]`

1. Chữ dài
   - TK1: họ tên 150 ký tự liền, chức danh 150 ký tự. Bảng cuộn trong khung. Tiêu đề trang chi tiết xuống hàng, trang không cuộn ngang ở 1366 px và 390 px. Hộp Khoá tài khoản nằm trọn.
2. Ký tự đặc biệt
   - TK2: họ tên `<script>` và `'` hiện nguyên văn ở bảng, tiêu đề, hộp thoại.
3. Tìm kiếm
   - TK3: tìm không dấu, viết HOA, một phần tên đăng nhập. `_` và `%` là chữ thường, không phải ký tự đại diện. Ô chỉ khoảng trắng như không tìm. Không khớp ghi "Không có tài khoản khớp từ khoá.".
   - TK19: "anh nguyen" ra "Nguyễn Thị Anh". Một từ ở họ tên, một từ ở tên đăng nhập cũng ra. Ô tìm nhận tối đa 100 ký tự.
   - TK20: tìm theo Mã tài khoản ra đúng người. Test DB.
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
   - CD4: mẫu có xuống dòng, tab, ký tự điều khiển. Báo lỗi đúng nghĩa. Ruling, xem mục kết quả.
   - CD14: mẫu báo lỗi. Câu lỗi gắn vào ô Mẫu SMS qua `aria-describedby`, cùng bộ đếm ký tự.
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
   - CD13: link 500 ký tự vẫn vẽ QR, link 501 ký tự thì ô QR ghi "Link quá dài", cùng mốc với máy chủ.

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
- API5: thêm U+0000, U+0001, U+0009, U+007F và nửa cặp surrogate `\ud83c` vào từng ô chữ của từng route ghi (Trường, Ngân hàng, Hướng dẫn, Kho mã, Tài khoản, Cá nhân, Cài đặt cả ô Mẫu SMS). Trả 400 kèm `field` của ô đó. Riêng tab ở ô Bước lưu được, thành một dấu cách. Đăng nhập với tên có NUL hay nửa cặp surrogate trả 401, không hỏi DB.
- API6: chuỗi có NUL, nửa cặp surrogate lọt qua form tới chỗ ghi jsonb (`audit_log`, `banks.guide`, `settings`). Ghi được, ký tự hỏng thành U+FFFD, không lỗi 500. Test DB.

## Kết quả (2026-11-06)

### Test đã viết

| Trang | Số ca | File test |
| --- | --- | --- |
| Đăng nhập | 15 | `e2e/edge-config-login.spec.ts` |
| Khung trang, phân quyền | 11 | `e2e/edge-config-shell.spec.ts` |
| Trường | 31 | `e2e/edge-config-schools.spec.ts` |
| Ngân hàng, hướng dẫn | 23 | `e2e/edge-config-banks.spec.ts` |
| Kho mã giới thiệu | 30 | `e2e/edge-config-codes.spec.ts` |
| Tài khoản | 18 | `e2e/edge-config-users.spec.ts` |
| Cá nhân | 9 | `e2e/edge-config-profile.spec.ts` |
| Cài đặt, Vận hành | 14 | `e2e/edge-config-settings.spec.ts` |
| API chung | 6 | `e2e/edge-config-api.spec.ts` |

Ca thuần máy chủ chạy thêm ở `tests/db/edgeConfig.test.ts`: ghi cùng lúc, người quản đã khoá, ngân hàng và trường không có hoặc đã đóng, Quản lý với tài khoản Quản trị.

Lượt sửa thứ hai thêm TR31, NH15, MA22, TK19 vào các file trên. TR32, MA23 và phần máy chủ của tìm nhiều từ nằm ở `tests/db/edgeConfig.test.ts`.

Lượt sửa thứ ba theo review lần 1 (2026-11-06) thêm TR33, NH16, NH17, HD4, MA24 tới MA28, CD13, API5. TK20, phần máy chủ của MA25, NH17, đăng nhập với NUL và câu dọn dữ liệu test nằm ở `tests/db/edgeConfig.test.ts`. MA28 có thêm unit test ở `tests/unit/month.test.ts`.

Lượt sửa thứ tư theo review lần 2 (2026-11-07) thêm NH18, HD5, HD6, MA29 tới MA32, CD14, API6, và mở rộng HD1, CD4, API5. Luật ký tự đổi form của cả ba nhóm, nên test của nhóm A (G2 ở `e2e/edge-student-api.spec.ts`) và nhóm B (ghi chú, Sửa thông tin ở `e2e/edge-business-detail.spec.ts`) cũng thêm nửa cặp surrogate. Unit test ở `tests/unit/controlChars.test.ts` (mọi ô chữ của mười form), `tests/unit/forms.test.ts` (tab ở Bước), `tests/unit/sms.test.ts` (mẫu SMS có tab). API6 ở `tests/db/edgeConfig.test.ts` và `tests/db/settings.test.ts`.

### Lỗi đã sửa

Mỗi dòng: điều người dùng thấy sau khi sửa, rồi commit.

- Khung trang: họ tên có emoji ở từ cuối thì ô chữ tắt hiện đủ emoji, không hiện ô hỏng. `74b1db4`
- Hộp thoại: tiêu đề và câu hỏi có tên liền một chữ dài thì xuống hàng trong hộp, nút Đóng không bị đẩy ra ngoài màn. `3951754`
- Trường, Tài khoản, Kho mã: URL có hai tham số `q` thì trang dùng `q` đầu, không lỗi 500. `fab450a`
- Trường, Tài khoản, Cá nhân: SĐT gõ có dấu cách hoặc dấu chấm lưu thành 10 số liền, không báo sai dạng. `fbcf3ab`
- Ngân hàng: hai người cùng tạo một mã ngân hàng cùng lúc thì người sau thấy "Mã ngân hàng đã có.", không lỗi 500. `68cd418`
- Ngân hàng: người quản đã bị khoá thì vẫn sửa được tên, độ ưu tiên; người quản giữ nguyên. `85cab0c`
- Hướng dẫn: đọc, lưu hướng dẫn của ngân hàng không có trả 404, không trả hướng dẫn rỗng hay lỗi 500. `1c29cd6`
- Ngân hàng, Kho mã: ô Độ ưu tiên, Số lượt bỏ trống thì báo lỗi ô, không lặng lẽ lưu 0. `7308bad`
- Kho mã: API tạo, sửa mã với ngân hàng không có, trường không có hoặc đã đóng, hai người cùng tạo một tên đều báo lỗi đúng ô, không lỗi 500. `c8ba122`
- Kho mã: sửa mã của ngân hàng đã tắt thì ô Ngân hàng hiện đúng ngân hàng của mã. `8c9ac8a`
- Kho mã: bật "Ẩn mã đã ngừng" mà mọi mã đều đã ngừng thì bảng ghi "Không có mã khớp bộ lọc.". `3ec54c9`
- Kho mã: gõ ô tìm rồi bấm sang trang khác ngay thì ở lại trang mới, không bị kéo về Kho mã. `874d617`. Bản này chỉ đúng khi trang mới hiện trong 300 ms, mạng chậm xem `d8a782d`.
- Kho mã: lọc trên URL đổi vì bấm link hay nút Quay lại thì ô tìm, ô ngân hàng, ô Ẩn mã đã ngừng hiện đúng lọc. `3033f49`
- Tài khoản: Quản lý gọi API sửa, khoá, đặt lại mật khẩu của Quản trị nhận 403, không nhận 400. `e704298`
- Tài khoản: hai người cùng tạo một tên đăng nhập hoặc một mã tài khoản cùng lúc thì người sau thấy báo trùng ở ô, không lỗi 500. `3b38161`
- Tài khoản: trang của chính mình không còn nút Đặt lại mật khẩu, API từ chối; trước đây bấm thì tự bị đăng xuất. `03bb73d`
- Thêm tài khoản: bấm Esc hoặc Huỷ lúc đang chờ máy chủ thì hộp không đóng, mật khẩu mới vẫn hiện. `42ff72b`
- Tài khoản: họ tên, chức danh liền một chữ dài xuống hàng ở trang chi tiết, trang không cuộn ngang. `5089602`
- Cá nhân: nhập sai rồi Huỷ, mở lại Sửa thông tin hay Đổi mật khẩu thì không còn lỗi cũ. `7e5ae63`
- Cá nhân: họ tên, chức danh liền một chữ dài xuống hàng trong khung, không bị cắt ở màn điện thoại. `401ce32`
- Cài đặt: lưu được rồi gõ sai và bấm Lưu thì câu "Đã lưu cấu hình." mất đi. `07c98a1`
- Cài đặt: link Zalo, link app PVI dài quá sức chứa của QR không làm vỡ trang, ô QR ghi "Link quá dài". `7dee31b`
- Cài đặt: link có dấu cách báo "Link không được có dấu cách", không báo nhầm "phải bắt đầu bằng https://". `490493c`
- Cài đặt: mẫu SMS có xuống dòng báo "Mẫu SMS viết trên một dòng", không báo nhầm "viết không dấu". `af5fda6`
- Cài đặt: xoá trống mẫu SMS rồi Lưu thì báo "Nhập mẫu SMS", không báo nhầm "viết không dấu". `30f7f4f`
- Cài đặt: mẫu SMS thiếu `{MA_VOUCHER}` báo "Mẫu SMS phải có {MA_VOUCHER}", không lưu mẫu gửi tin không có mã. `23fbf65`
- Trường: xuất Excel với ký tự NUL (`%00`) trên URL ra file, không lỗi 500. Ô chọn trường, ô chọn người quản, ô tìm trường của bộ lọc trang Ngân hàng cũng đọc từ khoá qua `readParam`. `32fd07d`. Ô chọn không có lỗi thật: `containsPattern` đã bỏ NUL từ trước, nên test DB của phần này giữ luật chứ không đo bản sửa (`97fb354`).
- Kho mã: hai mã cùng độ ưu tiên, cùng tên ở hai ngân hàng cùng thứ tự không đổi chỗ giữa hai trang, bấm Sau không lặp hay sót mã. Trường, Tài khoản đã có `id` cuối. Danh sách Ngân hàng không phân trang. `b10677f`
- Trường, Tài khoản, Kho mã, ô chọn người quản, ô chọn trường: gõ "anh nguyen" ra "Nguyễn Thị Anh", mỗi từ khớp một cột bất kỳ của trang. Máy chủ cắt từ khoá ở 100 ký tự và 8 từ. Ô tìm nhận tối đa 100 ký tự. `369a1eb`

Lượt sửa thứ ba, theo review lần 1:

- Kho mã: gõ ô tìm rồi bấm sang trang khác lúc mạng chậm thì ở lại trang mới. Ô tìm mất focus là tải ngay, nên lượt chuyển trang của link đi sau và thắng. `d8a782d`
- Trường, Ngân hàng, Hướng dẫn, Kho mã, Tài khoản, Cá nhân, Cài đặt: ô chữ có ký tự NUL hay ký tự điều khiển báo "Có ký tự không hợp lệ" ở ô đó, không lỗi 500. Đăng nhập với tên có NUL báo sai như tên không có thật, không hỏi DB. `cac92c6`
- Kho mã: tạo mã cho ngân hàng vừa tắt báo "Ngân hàng đã tắt." ở ô Ngân hàng, không tạo mã. Trước đây API vẫn tạo. `c64e389`
- Cài đặt: link từ 501 ký tự thì ô QR ghi "Link quá dài", cùng mốc với máy chủ. Trước đây link 501 tới 2.331 byte vẫn hiện QR rồi bấm Lưu bị từ chối. `7d4aaa7`
- Hộp Thêm mã, Thêm ngân hàng: lỗi ô Trường dùng mã này, ô Người quản và ô chọn Ngân hàng gắn vào ô qua `aria-describedby`, trình đọc màn hình đọc được. `2d10745`
- Hướng dẫn, Kho mã: ảnh mẫu, ảnh QR trên 20 MB báo "Ảnh lớn hơn 20 MB." ngay ở ô ảnh, không gửi lên máy chủ. Nginx trả 413 dạng HTML cũng báo câu đó ở ô ảnh, không còn câu báo chung. Việc này do review nhóm B tìm ra (`client_max_body_size 22m`). `15b9a88`
- Hướng dẫn: hai tab cùng mở, tab 1 thêm hay bỏ khung rồi lưu, tab 2 lưu bản cũ thì báo "Hướng dẫn đã có người sửa. Mở lại để xem bản mới.", không lặng lẽ bỏ khung tab 1 vừa thêm. `7d50bb1`
- Kho mã: URL có tháng trước 1900 như `month=0001-01` hiện tháng hiện tại, bấm Tháng sau ra đúng tháng sau, không ra 02/1901. `debb57b`
- Tài khoản: ô tìm khớp cả Mã tài khoản như `staffSearchWhere` của mgst-app. `9de6fe6`
- Ô tìm Kho mã, ô chọn nhiều: component chạy ở trình duyệt không còn import `src/server`. Trần ô tìm và `searchTerms` chuyển sang `src/lib/search.ts` như mgst-app, `src/server/search.ts` xuất lại tên cũ. Unit test `tests/unit/clientImports.test.ts` giữ luật này. `7a3b3f3`
- Dọn dữ liệu test: câu lọc tiền tố `zz_e2e_`, `zz_test_` ở `scripts/e2e-clean.ts` và `tests/db/helpers.ts` thoát dấu `_` bằng `escapeLike`. Điều kiện chỉ chặt hơn: tên không có `_` hay `%` ra đúng mẫu cũ. Trước đây `zz_test_%` chọn cả dòng như `zzxtestx...`. `7a571ab`

Test: `6ed26e4` (kiểu dữ liệu cho tsc), `eaea0c6` (test DB), `cb0bef5` (các file e2e còn lại).

Lượt sửa thứ tư, theo review lần 2:

- Mọi form của ba nhóm (Trường, Ngân hàng, Hướng dẫn, Kho mã, Tài khoản, Cá nhân, Cài đặt, form học sinh, Sửa thông tin hồ sơ, Ghi chú): ô chữ có nửa cặp surrogate (emoji bị cắt đôi, `\ud83c`) báo "Có ký tự không hợp lệ" ở đúng ô. Trước đây API tạo trường, ngân hàng, tài khoản, lưu Hướng dẫn, Ghi chú trả 500 vì cột jsonb của `audit_log` từ chối chuỗi này, còn API tạo hồ sơ học sinh lưu luôn. `1c2e68d`
- Máy chủ: chuỗi có NUL hay nửa cặp surrogate lọt qua form vẫn ghi được vào `audit_log`, `banks.guide`, `settings`, ký tự hỏng thành U+FFFD, không lỗi 500. Cột jsonb dùng kiểu riêng ở `src/server/db/jsonb.ts`, giống hệt jsonb của drizzle, chỉ đổi hai ký tự Postgres từ chối trước khi ghi. `drizzle-kit generate` báo không đổi schema. `d4c0370`
- Hướng dẫn: bước dán từ Word có tab sau gạch đầu dòng lưu được, mỗi tab thành một dấu cách. Trước đây dòng báo chung ghi "Có ký tự không hợp lệ" mà không chỉ ra bước nào. `30c6a21`
- Cài đặt: mẫu SMS có tab hay ký tự điều khiển báo "Có ký tự không hợp lệ", không báo nhầm "Mẫu SMS viết không dấu". `b7ee4a3`
- Cài đặt: lỗi ô Mẫu SMS gắn vào ô qua `aria-describedby`, trình đọc màn hình đọc được. `1252c01`
- Kho mã: gõ ô tìm rồi bấm Tháng sau hay nút Sau trong 300 ms thì ô tìm hiện theo từ khoá trên URL. Trước đây ô tìm vẫn ghi chữ vừa gõ mà bảng không lọc theo chữ đó. Bản sửa `d8a782d` gây ra lỗi này. `ee0eab4`
- Kho mã: lọc rồi bấm Kho mã giới thiệu, sau đó bấm nút Quay lại của trình duyệt thì ô tìm, ô ngân hàng hiện lại lọc của URL. `ee0eab4` làm hai ô về trống: nút Quay lại đổi URL trước khi props mới tới. Ô lọc nay so props cùng tháng và trang, không so chuỗi query. MA9 bắt được lỗi này. `27d9710`
- Kho mã, Hướng dẫn: đang tải ảnh QR hay ảnh mẫu thì nút chọn ảnh bị khoá. Trước đây chọn ảnh lần hai lúc lần đầu đang tải thì ảnh QR là ảnh này mà link là link của ảnh kia, hoặc Lưu mở lại khi khung khác còn đang tải rồi khung đó mất ảnh. `3d9d81a`
- Thêm ngân hàng, Sửa ngân hàng: ô chọn người quản ghi gợi ý "Gõ tên, tên đăng nhập hoặc mã tài khoản…". Máy chủ tìm theo Mã tài khoản từ `f11ea3a` của nhóm B. `b77a9b2`
- Thêm ngân hàng, Sửa ngân hàng, Hướng dẫn, Thêm mã, Sửa mã: đang lưu thì Huỷ bị khoá, nút Đóng ẩn, Esc không đóng hộp, câu lỗi máy chủ trả về vẫn hiện trong hộp. Ba hộp dùng `dismissible={!pending}` của `Dialog` (`a338176`) như các hộp khác. `e710dd6`

Test lượt bốn không kèm sửa code: `572b222` (HD6, MA31: huỷ hộp chọn file, code đã đúng từ `ab3249d`), `de27bfd` (API5: ô trống có chữ đứng trước ký tự lạ, vì tab ở đầu ô bị cắt như dấu cách).

Test lượt ba không kèm sửa code: `7dec398` (bỏ `waitForTimeout`, dùng `page.clock`), `bf89936` (assert trong `if` tách thành bước riêng), `90fad12` (hai test tìm kèm một từ riêng của test), `97fb354` (ghi rõ test DB ô chọn với `%00`), `18f681c` (TR33, MA27).

### Ruling

- Ô số bỏ trống (Độ ưu tiên, Số lượt) báo lỗi ô. Chép `numberValue` của mgst-app: ô trống là lỗi, không thành 0.
- SĐT bỏ dấu cách và dấu chấm trước khi kiểm. Chép luật SĐT ở form học sinh của mgi-bank. SĐT để trống ở Tài khoản, Cá nhân lưu là trống.
- Link mở tài khoản của mã có dấu cách giữa vẫn lưu như mgst-app (MA20). mgst-app không chặn, sửa thì đổi luật đã có.
- Link Zalo, link app PVI ở Cài đặt tối đa 500 ký tự (CD2). mgst-app không có trần. Chọn cách an toàn: web học sinh vẽ QR từ link này, QR mức M chứa tối đa 2.331 byte.
- Link ở Cài đặt có dấu cách thì báo "Link không được có dấu cách" (CD11). mgst-app không có luật riêng.
- Mẫu SMS có xuống dòng báo "Mẫu SMS viết trên một dòng" (CD4). mgst-app không có luật riêng. Tin SMS không dấu gửi một dòng.
- Mẫu SMS phải có `{MA_VOUCHER}` (CD7). mgst-app không có luật riêng. Chọn cách an toàn: tin gửi đi không có mã thì học sinh không dùng được.
- Tên trường trùng trường đã có vẫn lưu được (TR22). Hai xã có thể cùng có "THPT Nguyễn Du". Ô chọn trường luôn ghi kèm tên xã.
- Tên trường, ngân hàng, mã, tài khoản chưa có trần độ dài mới. Màn hình xuống hàng hoặc cuộn trong khung. Review không đồng ý, xem mục "Chờ chủ dự án".
- Bộ đếm "Sắp bị khoá" ở trình duyệt về 0 khi tải lại trang, như mgst-app. Máy chủ vẫn đếm đủ 5 lần.
- Mã đang gắn trường rồi trường mới đóng thì sửa mã vẫn giữ trường đó. Gắn thêm trường đã đóng hoặc không có thì bị từ chối ở ô Trường.
- Ngân hàng có người quản đã bị khoá thì sửa vẫn giữ người đó. Giao thêm người đã khoá thì bị từ chối ở ô Người quản.
- Không ai tự đặt lại mật khẩu của mình ở trang Tài khoản. Đổi mật khẩu của mình đi qua trang Cá nhân.
- Quản lý thao tác với tài khoản Quản trị nhận 403. Luật "ngoài phạm vi trả 404" áp cho bản ghi ngoài phạm vi; tài khoản Quản trị vẫn hiện trong danh sách của Quản lý.
- Ô tìm nhiều từ: mỗi từ phải khớp ít nhất một cột. Trường xét tên trường và tên xã. Tài khoản và ô chọn người quản xét họ tên, tên đăng nhập và Mã tài khoản. Kho mã xét tên hiển thị và mã text. Chép `staffSearchWhere` của mgst-app; mgst-app xét thêm tên phòng, mgi-bank không có phòng.
- Ký tự điều khiển (U+0000 tới U+001F, U+007F) và nửa cặp surrogate đứng lẻ (U+D800 tới U+DFFF) ở ô chữ của cả ba nhóm báo "Có ký tự không hợp lệ" ở ô đó. Luật chung ở `src/lib/controlChars.ts`; form học sinh, Ghi chú, Sửa thông tin hồ sơ cũng dùng luật này. Ghi chú vẫn nhận xuống dòng. Ô nhóm C không gộp khoảng trắng (TR3 lưu nguyên văn).
- Ruling: nửa cặp surrogate kiểm bằng regex cờ u (`/[\ud800-\udfff]/u`), cùng nghĩa với `isWellFormed()`. Không dùng `isWellFormed()`: Firefox 111 tới 118 nằm trong danh sách trình duyệt Next 16 hỗ trợ mà chưa có hàm này, gọi hàm thì form ném lỗi và không gửi được.
- Ruling: tab chỉ đổi thành một dấu cách ở ô Bước của Hướng dẫn, như `name` của form học sinh nhưng không gộp khoảng trắng khác. Review lần 2 không đồng ý ruling cũ ở phần tab. Ô Bước nhiều dòng, dòng báo chung không chỉ ra bước nào sai, và văn bản dán từ Word hay có tab sau gạch đầu dòng. Ô một dòng (tên trường, tên ảnh, họ tên…) vẫn chặn tab, vì lỗi hiện ngay dưới đúng ô. Mã text, link, Mã tài khoản, mẫu SMS có dấu cách thì đổi nghĩa, nên không đổi tab ở các ô này. Chủ dự án muốn đổi tab ở mọi ô tên thì mỗi form sửa một dòng. Tab ở đầu hay cuối ô bị cắt cùng dấu cách, như trước lượt này.
- Máy chủ đổi NUL và nửa cặp surrogate thành U+FFFD trước khi ghi mọi cột jsonb (`audit_log.detail`, `banks.guide`, `settings.value`, `photo_checks.result`), như cột text tự đổi nửa cặp. Form đã chặn hai ký tự này; chỗ ghi chỉ là lớp phòng sau, chuỗi lọt qua thì ghi được còn hơn lỗi 500.
- Ô mật khẩu không chặn ký tự điều khiển: máy chủ chỉ lưu bản băm, chuỗi không vào DB.
- Mẫu SMS có tab, ký tự điều khiển, nửa cặp surrogate báo "Có ký tự không hợp lệ", kiểm trước luật ASCII in được (CD4). Review lần 2 không đồng ý ruling cũ "báo Mẫu SMS viết không dấu như trước": câu đó sai nghĩa, cùng loại với lỗi `af5fda6`. Xuống dòng vẫn báo "Mẫu SMS viết trên một dòng".
- Đăng nhập với tên có ký tự điều khiển trả 401 "Tên đăng nhập hoặc mật khẩu không đúng." như tên không có thật, đếm lượt sai giả như tên không có thật. Tên đăng nhập chỉ nhận chữ thường không dấu, số, dấu chấm, gạch dưới, nên tên đó không thể có thật.
- Hai tab sửa Hướng dẫn (NH13, NH17): mgst-app ghi đè cả bộ khung, bản lưu sau thắng, không có luật riêng. Chọn cách không làm mất khung tab 1 vừa thêm: hộp gửi kèm danh sách khung lúc mở (`seenSlotIds`), bộ khung trên máy chủ đã khác thì báo "Hướng dẫn đã có người sửa. Mở lại để xem bản mới." (409), không lưu. Bộ khung không đổi thì các bước và tên khung theo bản lưu sau, như mgst-app.
- Tạo mã cho ngân hàng đã tắt báo "Ngân hàng đã tắt." ở ô Ngân hàng (400), cùng luật với hộp Thêm mã chỉ liệt kê ngân hàng đang bật. Sửa mã đã có của ngân hàng đó vẫn được, vì ngân hàng của mã không đổi khi sửa.
- Tháng trước 1900 trên URL bị bỏ, về tháng hiện tại, như `readDay` bỏ ngày trước 1900.
- Ảnh mẫu và ảnh QR trên 20 MB bị chặn ở trình duyệt như `imageProblem` của mgst-app, chỉ kiểm dung lượng. Loại file vẫn để máy chủ kiểm theo chữ ký file, vì `file.type` do trình duyệt đoán theo đuôi.
- Ruling: gõ ô tìm Kho mã rồi bấm Tháng sau hay nút Sau trong 300 ms thì chữ chưa gửi bị bỏ, ô tìm hiện theo URL (MA29). Link Tháng sau, Sau dựng ở máy chủ từ URL nên không mang chữ chưa gửi. Cách giữ chữ phải sửa `MonthPicker` và `Pager` dùng chung, lớn hơn phạm vi sửa lỗi.
- Ruling: đang tải ảnh QR hay ảnh mẫu thì khoá nút chọn ảnh (HD5, MA30), không đếm lượt tải để bỏ phản hồi cũ. Mỗi hộp chỉ có một lượt tải cùng lúc, đúng với `uploading` chỉ giữ một khung.

### Chờ

Không có. `dismissible` của `Dialog` có từ `a338176` của nhóm B trước khi lượt bốn dùng tới.

### Chờ chủ dự án

Các mục dưới đây review lần 1 nêu nhưng không sửa trong lượt này. Code giữ nguyên.

1. Trần độ dài cho tên trường, tên ngân hàng, người liên hệ, họ tên, chức danh.
   - Hiện không cột nào có trần. Gọi API với tên dài hơn 32.767 ký tự rồi Xuất Excel thì Excel cắt ô hoặc báo phải sửa file.
   - mgst-app có trần cho ô tương tự: `wardCatalog.ts` cho tên và người đứng đầu tối đa 120, chức danh tối đa 60.
   - Review khuyến nghị: 120 cho tên, 60 cho chức danh như mgst-app.
2. Bộ đếm SMS ở Cài đặt với tên trường dài.
   - Bộ đếm "x/160 ký tự" (`SettingsForm.tsx`) tính bằng tên mẫu "THPT Nguyen Du". `{TRUONG}` chèn nguyên tên trường, nên trường tên 250 ký tự có học sinh đạt thì tin thật nhiều phần hơn số bộ đếm ghi.
   - Review khuyến nghị: bộ đếm tính theo trường hợp dài nhất, đi cùng trần ở mục 1.
3. Quản lý với tài khoản Quản trị.
   - File quyết định (`cau-hoi-kien-truc-2026-11-03.md:20`) ghi Quản lý sửa được cả tài khoản Quản trị. Code chặn từ giai đoạn 2 (`guardAdmin` ở `src/server/users.ts`), ruling TK14 trả 403.
   - Review khuyến nghị: giữ chặn, vì nếu không chặn thì Quản lý đặt lại được mật khẩu Quản trị rồi vào Cài đặt. Sau đó ghi lại vào file quyết định.
4. Link có dấu cách.
   - Kho mã cho lưu như mgst-app (MA20). Cài đặt chặn, báo "Link không được có dấu cách" (CD11).
   - Review khuyến nghị: giữ như hiện tại theo luật chép mgst-app, và ghi rõ chỗ khác nhau này.

### Chưa test

- `/ops` "Chưa có số đo.": bảng `host_metrics` là số đo thật của DB local, không xoá được.
- Tải ảnh thật lên S3 ở Ngân hàng (ảnh mẫu) và Kho mã (ảnh QR): test chỉ gửi file hỏng, máy chủ từ chối trước khi ghi S3. Ảnh thật sẽ để lại file trên bucket dev mà `e2e-clean` không dọn. HD5, MA30 giả lượt tải bằng `page.route` của `/api/admin/uploads`.
- MA24, MA29 dựa vào việc ô tìm mất focus khi bấm link. Hai test chỉ chạy trên Chromium, chưa kiểm Safari trên iOS.
- DN6 phần "tải lại trang thì bộ đếm ở trình duyệt về 0": ghi là ruling, không viết test.

### Lần chạy cuối

Chạy 2026-11-07 lúc 01:28 tới 01:45, trên `f11ea3a` cùng hai thay đổi sau này thành `27d9710`, `de27bfd`. Working tree lúc chạy chỉ còn thay đổi dở ở hai file tài liệu.

- `bun run test`: 247 pass, 0 fail.
- `bunx tsc --noEmit`: 0 lỗi.
- `bun run lint`: 0 lỗi, 2 cảnh báo `<img>` cũ ở `GuideDialog.tsx` và `CodeFormDialog.tsx`.
- `bun test:db` trên DB tạm `zz_test_final_y`: 268 pass, 0 fail.
- `bun run e2e e2e/edge-config-` trên bản build: 86 pass, 0 fail, 3,1 phút.
- `bun run e2e e2e/edge-student` trên cùng bản build: 76 pass, 0 fail, 1,0 phút.
- `bun run e2e e2e/edge-business` trên cùng bản build: 52 pass, 0 fail, 3,7 phút.

Lượt bốn, trước khi sửa: các test mới chạy trên code cũ.

- E2E: 10 test fail đúng lỗi. Ghi chú ở Trang 4 trả 500. G2 trả 201 thay vì 400. API5 fail ở ca tab. HD1 hiện "Có ký tự không hợp lệ". HD5, NH18, MA30, MA32: nút không bị khoá. MA29: ô tìm giữ chữ vừa gõ. CD4: ô Mẫu SMS không có mô tả lỗi.
- E2E: HD6 và MA31 pass ngay. Code đã đúng, test giữ luật.
- Test DB: 3 test fail với "invalid input syntax for type json".
- Unit: 11 test fail ở `controlChars.test.ts`, ca tab của `forms.test.ts` và `sms.test.ts`.

Lượt ba, trước khi sửa: một spec tạm chạy các test mới trên code cũ. 9 test fail đúng lỗi (MA24 bị kéo về `/banks/codes?month=2026-11&q=ZZE2E`, API5 trả 500, MA25 trả 201, CD13, NH16 và ô chọn trường, HD4, MA26, NH17, MA28). TR33 và MA27 pass ngay: code đã đúng, test giữ luật. Spec tạm đã xoá.

Lần chạy đủ đầu tiên sau khi sửa (01:17, trên `c52e5f5`) có 2 test fail. MA9 bắt được lỗi `ee0eab4` gây ra, `27d9710` sửa. API5 thêm tab vào Mã tài khoản trống, tab ở đầu ô bị cắt nên máy chủ lưu đúng, `de27bfd` sửa test.
