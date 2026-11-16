# Quy định gửi SMS và Zalo cho phụ huynh

Ngày lập: 2026-11-13. Claude research trên web, chủ dự án chưa duyệt.

Tài liệu này phục vụ việc nối nhà cung cấp SMS vào hàm `sendSms` ở `src/server/sms/send.ts`.
Tin SMS của mgi-bank gửi mã voucher bảo hiểm PVI cho phụ huynh, theo mẫu `DEFAULT_SMS_TEMPLATE` ở `src/lib/sms.ts`.

## 1. Quyết định đã chốt

| Ngày | Quyết định |
|---|---|
| 2026-11-13 | Khách đồng ý nhận tin quảng cáo bằng form đăng ký. Đây là cách b ở Điều 11 khoản 2 Nghị định 91/2020/NĐ-CP. |

## 2. Văn bản áp dụng

- Nghị định 91/2020/NĐ-CP về chống tin nhắn rác, thư điện tử rác, cuộc gọi rác. Hiệu lực từ 2020-10-01.
- Thông tư 22/2021/TT-BTTTT hướng dẫn Nghị định 91. Hiệu lực từ 2022-03-01.
- Bộ Công an đang soạn nghị định thay Nghị định 91, bản dự thảo ghi tháng 9/2026. Khi nghị định mới có hiệu lực, các mục 3 và 4 phải đọc lại.

## 3. Tin CSKH và tin quảng cáo

Nghị định 91 chỉ đặt luật đồng ý cho tin quảng cáo. Tin CSKH không cần khách đồng ý trước.

| | Tin CSKH | Tin quảng cáo |
|---|---|---|
| Nội dung | Báo giao dịch, tài khoản, OTP | Khuyến mãi, sản phẩm, voucher |
| Khách phải đồng ý trước | Không | Có |
| Khung giờ gửi | Không giới hạn | 07:00 đến 22:00 |
| Số tin tối đa tới một số trong 24 giờ | Không giới hạn | 3 tin |
| Nhãn `[QC]` đầu tin | Không | Có |
| Hướng dẫn từ chối cuối tin | Không | Có |
| Gửi qua API | Có | SpeedSMS không hỗ trợ |
| Độ dài một tin không dấu | 160 ký tự | 122 ký tự theo SpeedSMS |

Tin voucher của mgi-bank chưa được phân loại:
- Nhà mạng thường xếp tin chứa mã voucher vào tin quảng cáo.
- Tin chỉ báo mã quà của khách đã đủ điều kiện có thể được xếp vào tin CSKH. VietGuys ghi nhận đây là trường hợp hay bị phân loại nhầm.
- Không tìm thấy văn bản nào nói rõ trường hợp này.
- Nhà mạng duyệt từng mẫu tin cụ thể. Câu trả lời phải lấy từ nhà cung cấp, xem mục 6.

## 4. Luật cho tin quảng cáo theo Nghị định 91/2020

### 4.1. Khách đồng ý trước

Điều 11 khoản 2 cho 4 cách khách đồng ý:

| Cách | Mô tả | Ghi chú |
|---|---|---|
| a | Khách trả lời tin nhắn đăng ký quảng cáo | Bạn chỉ được gửi tin đăng ký 1 lần. Khách từ chối hoặc không trả lời thì không được gửi gì thêm (Điều 13 khoản 2, 3). |
| b | Khách khai trên form đăng ký giấy, website, ứng dụng hoặc mạng xã hội | Đã chọn ngày 2026-11-13 |
| c | Khách gọi điện hoặc nhắn tin tới tổng đài để đăng ký | |
| d | Khách đăng ký qua phần mềm hỗ trợ | |

- Người quảng cáo phải có biện pháp kiểm tra khách đã đồng ý rõ ràng (Điều 11 khoản 4).
- Người quảng cáo phải lưu thông tin đăng ký, yêu cầu từ chối và xác nhận từ chối ít nhất 1 năm (Điều 11 khoản 3, 7).

### 4.2. Danh sách không quảng cáo (DNC)

- DNC là danh sách số điện thoại mà chủ số đã đăng ký không nhận quảng cáo (Điều 7 khoản 1).
- Không được gửi tin quảng cáo tới số trong DNC (Điều 7 khoản 3).
- Người quảng cáo phải kiểm tra DNC trước khi gửi (Điều 11 khoản 1).
- Nhà mạng cũng phải chặn tin quảng cáo tới số trong DNC (Điều 9 khoản 3).

### 4.3. Nội dung tin

- Mọi tin quảng cáo phải có nhãn `[QC]` hoặc `[AD]` ở vị trí đầu tiên của nội dung. Nhãn phải có dấu ngoặc vuông (Điều 15).
- Cuối tin phải có hướng dẫn từ chối. Khách phải từ chối được bằng tin nhắn và bằng cuộc gọi (Điều 16 khoản 1, 2).
- Người quảng cáo phải gửi bản sao tin quảng cáo tới hệ thống 5656 (Điều 5). Nhà cung cấp SMS thường làm việc này, phải hỏi lại.

### 4.4. Khung giờ và số lượng

- Chỉ gửi tin trong khung 07:00 đến 22:00 (Điều 13 khoản 6).
- Không gửi quá 3 tin quảng cáo tới một số trong 24 giờ (Điều 13 khoản 5).
- Hai luật trên có ngoại lệ khi khách đã thoả thuận khác.

### 4.5. Khi khách từ chối

1. Người quảng cáo ngừng gửi ngay (Điều 13 khoản 4).
2. Người quảng cáo gửi 1 tin xác nhận đã nhận yêu cầu từ chối (Điều 16 khoản 3).
3. Tin xác nhận ghi thời điểm nhận yêu cầu và thời điểm ngừng gửi. Tin này không được chứa quảng cáo (Điều 16 khoản 4).

### 4.6. Ví dụ tin hợp lệ

```
[QC] MINHGROUP: Voucher bao hiem cua TRAN MINH ANH: THPTND-TMA-11A3-K7Q2. Tu choi: soan TC gui 8xxx hoac goi 1900xxxx.
```

Đầu số `8xxx` và `1900xxxx` là số giả. Nhà cung cấp cấp số thật.

## 5. Cách b áp dụng cho mgi-bank

Học sinh khai tên và số điện thoại phụ huynh trên web học sinh. Ô đồng ý đặt ở bước này.

1. Web học sinh thêm một ô đồng ý, để trống sẵn. Ví dụ: "Phụ huynh đồng ý nhận tin nhắn ưu đãi và mã voucher qua SMS."
2. Người khai tự tích. Nhân viên không được tích hộ.
3. Hệ thống lưu số điện thoại, thời điểm tích, câu chữ của ô đồng ý.
4. Hệ thống giữ bản lưu ít nhất 1 năm.
5. Hồ sơ không tích ô đồng ý thì không gửi tin quảng cáo.

Điểm chưa rõ:
- Nghị định 91 đòi người sử dụng số điện thoại đồng ý. Ở mgi-bank, học sinh khai và tích thay phụ huynh. Bằng chứng này yếu hơn khi phụ huynh tự tích.
- Học sinh THPT phần lớn dưới 18 tuổi. Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có thể đặt thêm điều kiện cho dữ liệu của trẻ em. Claude chưa đọc luật này.
- Hai điểm trên phải hỏi luật sư trước khi gửi số lượng lớn.

## 6. Quy trình đăng ký SMS Brandname và gửi tin

### 6.1. Hồ sơ khai báo tên định danh

- Bản khai đăng ký tên định danh theo Mẫu 01 của Nghị định 91/2020/NĐ-CP.
- Bản sao chứng thực Giấy chứng nhận đăng ký doanh nghiệp.
- Bản sao chứng thực CCCD của người đại diện.
- Giấy tờ đăng ký nhãn hiệu, nếu có.
- Giấy uỷ quyền, nếu nhà cung cấp nộp hộ.
- Hồ sơ theo lĩnh vực, nếu ngành nghề đòi.

Mỗi bản sao chứng thực phải có ngày chứng thực trong vòng 6 tháng.

Theo hướng dẫn của eSMS, Cục An toàn thông tin nhận hồ sơ, qua bưu chính hoặc Cổng Dịch vụ công. Cục xử lý trong khoảng 10 đến 12 ngày làm việc. Bộ máy nhà nước đã sắp xếp lại từ năm 2025, nên nơi nhận hồ sơ có thể đã đổi. Phải hỏi nhà cung cấp quy trình đang áp dụng.

### 6.2. Các bước

1. Chủ dự án xin báo giá bằng văn bản từ 2 đến 3 nhà cung cấp. Ví dụ: eSMS, VietGuys, SpeedSMS.
2. Chủ dự án gửi mẫu tin ở mục 4.6 cho nhà cung cấp, rồi hỏi các câu ở mục 6.4.
3. Chủ dự án ký hợp đồng với nhà cung cấp đã chọn.
4. Nhà cung cấp nộp hồ sơ khai báo tên định danh, theo giấy uỷ quyền.
5. Nhà cung cấp đăng ký tên và mẫu tin với từng nhà mạng: Viettel, Vinaphone, Mobifone và các mạng khác.
6. Nhà cung cấp cấp API key.
7. Dev nối API vào hàm `sendSms`, rồi gửi thử tới số nội bộ của từng nhà mạng.

Mẫu tin gửi đi phải khớp mẫu đã đăng ký. Từ 2024-08-12, nội dung tin phải chứa tên thương hiệu khớp với tên đã đăng ký.

### 6.3. Chi phí tham khảo

| Nhà cung cấp | Tin CSKH | Tin quảng cáo | Phí duy trì |
|---|---|---|---|
| eSMS | 520 đ, không tách CSKH và quảng cáo | 520 đ | Không ghi |
| SpeedSMS | từ 750 đ, lĩnh vực không ưu tiên | từ 450 đ | 150.000 đ/tháng cho tin CSKH |

Các trang không ghi ngày cập nhật giá và không ghi đã gồm VAT hay chưa. Phải lấy báo giá bằng văn bản.

### 6.4. Câu hỏi cho nhà cung cấp

1. Mẫu tin voucher ở mục 4.6 được duyệt là tin CSKH hay tin quảng cáo?
2. Nếu là tin quảng cáo, app có gọi API để gửi mỗi phụ huynh một mã riêng được không?
3. Nhà cung cấp có lọc số trong DNC và gửi bản sao tới 5656 không?
4. Đầu số nhận tin từ chối và số gọi từ chối là số nào?
5. Giá đã gồm VAT chưa? Phí khởi tạo và phí duy trì là bao nhiêu?
6. Nhà cung cấp có API gửi Zalo ZBS trước, khi không gửi được thì chuyển sang SMS không?

### 6.5. Ảnh hưởng tới code nếu tin voucher là tin quảng cáo

- `SettingsForm` ở `src/lib/sms.ts` phải bắt mẫu SMS bắt đầu bằng `[QC]` và có hướng dẫn từ chối.
- Nhãn và hướng dẫn từ chối làm tin dài thêm khoảng 60 ký tự. Tin dễ vượt 160 ký tự và bị tách thành 2 tin, tính tiền 2 lần.
- `sms:worker` phải giữ tin lại ngoài khung 07:00 đến 22:00.
- Hệ thống phải có nơi lưu yêu cầu từ chối và chặn gửi tới số đã từ chối.

## 7. Zalo cho doanh nghiệp

### 7.1. Kết luận

Doanh nghiệp gửi được tin Zalo tới số điện thoại chưa quan tâm OA và chưa kết bạn, bằng ZBS Template Message. Điều kiện là người nhận đã phát sinh giao dịch với doanh nghiệp. Các loại tin khác của OA đều đòi người nhận đã tương tác hoặc đã quan tâm OA.

### 7.2. Các loại tin của Zalo Official Account (OA)

Theo chính sách của Zalo áp dụng từ 2023-06-20:

| Loại tin | Người chưa quan tâm OA nhận được | Điều kiện | Phí |
|---|---|---|---|
| Tin Tư vấn | Có | Người dùng đã tương tác với OA trong 7 ngày | 8 tin đầu trong 48 giờ miễn phí, sau đó 55 đ/tin |
| Tin Giao dịch | Có | Người dùng đã tương tác hoặc cho phép OA tương tác | 165 đ/tin |
| Tin Truyền thông | Không | Chỉ người đang quan tâm OA. Tối đa 4 tin/tháng và 1 tin/ngày | Theo gói OA |
| ZBS Template Message | Có | Người dùng đã phát sinh giao dịch với doanh nghiệp | Xem mục 7.3 |

### 7.3. ZBS Template Message

ZBS Template Message có tên cũ là ZNS. Doanh nghiệp gửi tin theo mẫu tới số điện thoại có tài khoản Zalo.

- Người nhận không cần quan tâm OA trước.
- Zalo chỉ cho gửi tới người đã phát sinh giao dịch với doanh nghiệp. Ngoại lệ duy nhất là mã xác thực khi khách tạo tài khoản mới.
- Zalo duyệt từng mẫu tin trước khi gửi. Mẫu đã duyệt thì không sửa được, muốn đổi phải tạo mẫu mới.
- Mọi mẫu tin gửi mã giảm giá hoặc voucher phải dùng Mẫu voucher, ở mọi tag.
- Nội dung mẫu không được chứa link hay số điện thoại. Link và hotline đặt ở nút bấm.
- Chỉ gửi trong khung 06:00 đến 22:00. Mẫu OTP không bị giới hạn này.
- Mỗi OA có hạn mức tin mỗi ngày. API trả hạn mức qua `dailyQuota` và `remainingQuota`.
- Số không có tài khoản Zalo thì API trả lỗi `ERR_ZBS_ZALO_ACCOUNT_NOT_EXISTED`. Khi đó hệ thống phải gửi SMS thay.

Mẫu tin chia thành 3 tag:

| Tag | Mục đích |
|---|---|
| Tag 1, Giao dịch | Nội dung gắn với một giao dịch cụ thể |
| Tag 2, Chăm sóc khách hàng | Cập nhật dịch vụ, thông báo tài khoản, khảo sát, nhắc gia hạn |
| Tag 3, Hậu mãi | Khuyến mãi, bán thêm, mời quan tâm OA. Phải ghi rõ điều kiện và hạn dùng của chương trình |

Mẫu có bất kỳ mục đích nào của Tag 3 thì Zalo xếp vào Tag 3. OA mới tạo chưa có quyền gửi Tag 3.

Bảng giá ZBS, chưa gồm VAT:

| Loại mẫu | Giá mỗi tin gửi thành công |
|---|---|
| Mẫu voucher | 300 đ |
| Mẫu chứa OTP | 300 đ |
| Mẫu yêu cầu chuyển khoản | 300 đ |
| Các loại còn lại | 200 đ |
| Nút bấm thứ 2 trở đi | 100 đ/nút |

### 7.4. Tài khoản Zalo cá nhân

- Không nên dùng tài khoản Zalo cá nhân để gửi tin tự động cho khách.
- Thư viện zca-js tự ghi trong README: "Using this API could get your account locked or banned."
- Zalo từng giới hạn số lượt tài khoản miễn phí trả lời người lạ mỗi tháng. Không tìm thấy con số chính thức hay luật đang áp dụng.

### 7.5. Áp dụng cho mgi-bank

- Câu hỏi còn mở: Zalo có xem phụ huynh là người đã phát sinh giao dịch không? Người mở tài khoản là học sinh, không phải phụ huynh.
- Tin voucher phải dùng Mẫu voucher, 300 đ/tin.
- Hướng nên dùng: gửi ZBS trước, khi số không có Zalo thì gửi SMS. Tin ZBS voucher giá 300 đ, tin SMS giá 520 đ đến 750 đ.

## 8. Việc còn mở

| # | Việc | Ai trả lời |
|---|---|---|
| 1 | Tin voucher là tin CSKH hay tin quảng cáo | Nhà cung cấp SMS |
| 2 | Học sinh tích ô đồng ý thay phụ huynh có đủ bằng chứng không | Luật sư |
| 3 | Luật Bảo vệ dữ liệu cá nhân 2025 đặt điều kiện gì cho dữ liệu học sinh dưới 18 tuổi | Luật sư |
| 4 | Zalo có cho gửi ZBS tới phụ huynh không | Zalo hoặc đối tác ZBS |
| 5 | Nơi nhận hồ sơ khai báo tên định danh sau năm 2025 | Nhà cung cấp SMS |

## Nguồn

- [Nghị định 91/2020, Chương 2: Điều 5, 7, 9, 11](https://hethongphapluat.com/nghi-dinh-91-2020-nd-cp-ve-chong-tin-nhan-rac-thu-dien-tu-rac-cuoc-goi-rac/chuong-2)
- [Nghị định 91/2020, Chương 3: Điều 13, 15, 16](https://hethongphapluat.com/nghi-dinh-91-2020-nd-cp-ve-chong-tin-nhan-rac-thu-dien-tu-rac-cuoc-goi-rac/chuong-3)
- [Thông tư 22/2021/TT-BTTTT](https://vcci.com.vn/legal-document/thong-tu-222021tt-btttt-huong-dan-nghi-dinh-912020nd-cp-ve-chong-tin-nhan-rac-thu-dien-tu-rac-cuoc-goi-rac)
- [Bộ Công an: Dự thảo nghị định thay Nghị định 91](https://bocongan.gov.vn/media/bca-media/library-20260909084715-f7e1171f-eb0c-4ae2-97ed-7017b136dc65-1-nghi-inh-thay-the-n-91.doc)
- [eSMS: Quy định, thủ tục khai báo định danh](https://helpcenter.esms.vn/thong-tin-dich-vu/tra-cuu-thong-tin-ho-so/quy-dinh-thu-tuc-khai-bao-dinh-danh)
- [eSMS: Bảng giá](https://esms.vn/chinh-sach-gia)
- [SpeedSMS: Dịch vụ SMS Brandname](https://speedsms.vn/dich-vu-sms-brandname/)
- [Twilio: Hướng dẫn gửi SMS tới Việt Nam](https://www.twilio.com/en-us/guidelines/vn/sms)
- [Brands Vietnam (VietGuys): 5 sai lầm khi triển khai SMS Brandname](https://www.brandsvietnam.com/congdong/topic/5-sai-lam-pho-bien-khi-trien-khai-sms-brandname-cho-chuoi-ban-le)
- [Zalo: Chính sách gửi tin từ Zalo Official Account](https://oa.zalo.me/home/resources/news/thong-bao-chinh-sach-gui-tin-va-quy-dinh-phi-gui-tin_1433049880779375099)
- [Zalo: Giới thiệu ZBS Template Message](https://zalo.solutions/zns)
- [Zalo: Bảng giá ZBS](https://zalo.solutions/business-message/pricing)
- [Zalo: Quy định chung khi kiểm duyệt mẫu tin ZBS](https://zalo.solutions/news/quy-dinh-chung-khi-kiem-duyet-mau-tin-nhan-zbs/xdygqtrjjm97k28rsh07wr72)
- [Nhanh.vn: API gửi tin ZBS](https://apidocs.nhanh.vn/v3/zalo/zbs)
- [Brands Vietnam: Lộ trình triển khai ZNS Tag 3](https://www.brandsvietnam.com/congdong/topic/lo-trinh-trien-khai-tin-zns-tag-3-tu-cham-soc-khach-hang-den-tang-truong-doanh-thu-hau-mai)
- [zca-js: README](https://github.com/RFS-ADRENO/zca-js)
