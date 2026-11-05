# Triển khai mgi-bank lên máy chủ

Ghi ngày 2026-11-05. File này mô tả cách dựng và cập nhật mgi-bank trên máy chủ FPT Cloud, cùng kiểu máy và cùng cách làm với mgst-app.
Tới ngày ghi, chưa lệnh nào trong file chạy trên máy chủ thật. Mọi lệnh đã chạy thử ở máy local: dựng image, chạy container thử, Nginx thử, sao lưu và khôi phục vào database tạm.

Người vận hành đọc hết mục 0 trước khi gõ lệnh đầu tiên.

## 0. Cảnh báo trước khi thao tác

- Agent không SSH vào máy chủ khi chủ dự án chưa cho phép trong chính lượt đó. Câu hỏi không phải cho phép.
- Dựng từng image một: app trước, rồi worker kiểm ảnh, rồi worker SMS, rồi job. Không dựng hai image cùng lúc trên máy chủ: lượt dựng chiếm CPU và production chậm theo.
- Docker trên máy FPT thiếu plugin `compose`. Script dùng `docker run`, không dùng `docker compose`.
- Mọi lệnh chạy bằng `root`, trong thư mục `/opt/mgi-bank`.
- Cổng của container chỉ mở ở `127.0.0.1`. Mở ra mọi giao diện thì Docker tự thêm luật iptables, đi vòng qua tường lửa.
- Không đổi `VOUCHER_SECRET` sau khi cấp voucher đầu tiên. Đổi khoá thì mã voucher cũ không kiểm lại được.
- Không chạy `bun run build` trên máy chủ. `Dockerfile` tự dựng bên trong image.
- `DATABASE_URL` đặt trong shell thắng `.env.local`. Trước khi migrate, người vận hành chạy `unset DATABASE_URL` rồi đọc dòng `Database:` mà `db:migrate` in ra.

## 1. Thành phần trên máy chủ

| Thành phần | Tên | Cổng trên máy chủ | Dựng bằng |
|---|---|---|---|
| Nginx | `/etc/nginx/sites-available/mgi-bank.conf` | 80, 443 | mục 6 |
| App (Next standalone, `bun server.js`) | container `mgi-bank-app`, image `mgi-bank-app` | `127.0.0.1:3200` | `deploy/deploy.sh` |
| Worker kiểm ảnh (Python OCR) | container `mgi-bank-photo`, image `mgi-bank-photo` | không mở | `deploy/worker-photo.sh` |
| Worker SMS | container `mgi-bank-sms`, image `mgi-bank-sms` | không mở | `deploy/worker-sms.sh` |
| Postgres 16 | container `mgi-bank-db`, volume `mgi-bank-db-data` | `127.0.0.1:5436` | `deploy/db.sh` |
| Mạng Docker | `mgi-bank-net` | | `deploy/db.sh` |
| Đo máy chủ cho Trang 18 | `mgi-bank-ops-watch.service` | | `deploy/jobs.sh` |
| Sao lưu, kiểm sao lưu | `mgi-bank-backup.timer`, `mgi-bank-backup-check.timer` | | `deploy/jobs.sh` |
| Dọn ảnh mồ côi | `mgi-bank-s3-orphans.timer` | | `deploy/jobs.sh` |
| Bản test | `mgi-bank-test-app`, `mgi-bank-test-db` | `127.0.0.1:3210`, `127.0.0.1:5437` | `deploy/test-env.sh` |

Cổng chọn để không trùng mgst-app (app 3000, demo 3100, Postgres 5433 và 5434) khi hai hệ chạy chung một máy.

App và worker gọi Postgres bằng tên container `mgi-bank-db` trong mạng `mgi-bank-net`. Lệnh chạy thẳng trên máy chủ (migrate, ops-watch, sao lưu) gọi `127.0.0.1:5436`. `deploy/lib.sh` đổi địa chỉ trong `DATABASE_URL` khi chạy container, người vận hành không sửa tay.

Ba container chạy thường trực: `mgi-bank-app`, `mgi-bank-sms`, `mgi-bank-photo`. Ảnh đi qua API của app như mgst-app: app đổi mọi ảnh sang WebP lúc nhận bằng `sharp` và `heic-convert` (`src/server/toWebpOnServer.ts`), rồi mới ghi S3.

## 2. Việc chủ dự án phải làm

Làm đúng thứ tự. Mỗi bước có lệnh đầy đủ ở mục được chỉ.

1. Trỏ DNS hai tên miền về máy chủ (mục 3).
2. Tạo bucket ảnh production và bucket sao lưu (mục 3b).
3. Chuẩn bị máy chủ, clone repo, viết `.env.local` có `VOUCHER_SECRET` (mục 4).
4. Dựng database, chạy migrate, seed tỉnh xã, tạo Quản trị đầu tiên (mục 5).
5. Cấu hình Nginx và xin chứng chỉ HTTPS bằng certbot (mục 6).
6. Deploy app, worker kiểm ảnh, job (mục 7). Worker SMS chờ tới khi nối nhà cung cấp SMS.
7. Viết `.env.backup`, chạy sao lưu lần đầu, diễn tập khôi phục (mục 8).
8. Dựng bản test khi cần (mục 12).

## 3. DNS

Tên miền `minhgroup-i.com.vn` do chủ dự án quản lý. Thêm hai bản ghi A trỏ về Floating IP của máy chủ:

| Host | Loại | Giá trị |
|---|---|---|
| `admin` | A | `<IP máy chủ>` |
| `bank` | A | `<IP máy chủ>` |

Kiểm sau khi thêm:

```bash
dig +short admin.minhgroup-i.com.vn
dig +short bank.minhgroup-i.com.vn
dig +short CAA minhgroup-i.com.vn
```

Hai dòng đầu phải ra IP máy chủ. Dòng thứ ba có giá trị mà không có `letsencrypt.org` thì certbot dừng với lỗi `CAA record ... prevents issuance`. Khi đó chủ dự án thêm bản ghi CAA `0 issue "letsencrypt.org"` cho từng tên `admin` và `bank`. CAA đặt ở tên con thay CAA của tên cha, site chính giữ nguyên nhà cấp cũ. mgst-app đã gặp đúng lỗi này với `app.mgst.com.vn`.

## 3b. Bucket S3

mgi-bank dùng hai bucket riêng trên FPT Object Storage, cả hai để private:

| Bucket | Ví dụ tên | Dùng cho |
|---|---|---|
| Ảnh production | `mgi-bank-images` | ảnh học sinh, ảnh mẫu, ảnh QR |
| Sao lưu | `mgi-bank-backup` | bản dump database |

Không bao giờ dùng `mgst-images`: đó là bucket production của mgst-app. Code từ chối bucket này ở mọi chỗ ghi.

Bucket sao lưu phải khác bucket ảnh. App có quyền xoá trong bucket ảnh, một lỗi ở đường xoá ảnh không được chạm bản sao lưu. Script sao lưu dừng khi hai tên trùng nhau.

Tạo bucket trên console FPT, hoặc bằng script của repo sau khi có `.env.local` (mục 4). Script chỉ tạo bucket khi chưa có:

```bash
cd /opt/mgi-bank
bun --env-file=.env.local scripts/s3-create-bucket.ts
S3_BUCKET=mgi-bank-backup bun --env-file=.env.local scripts/s3-create-bucket.ts
```

Biến đặt trước lệnh thắng `.env.local`, nên dòng thứ hai tạo bucket sao lưu bằng cùng khoá.

Kiểm bucket private, cả hai lệnh phải in `403`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://s3-han02.fptcloud.com/mgi-bank-images/
curl -s -o /dev/null -w "%{http_code}\n" https://s3-han02.fptcloud.com/mgi-bank-backup/
```

Ảnh học sinh là dữ liệu cá nhân. Mở bucket ra public là bỏ chốt kiểm quyền xem ảnh của Trang 4.

## 4. Chuẩn bị máy chủ

Máy chủ cần Docker, Bun, Git, Nginx, Certbot. Máy đã chạy mgst-app thì đã có đủ. Kiểm:

```bash
docker --version && bun --version && git --version && nginx -v && certbot --version
```

Thiếu gói nào thì cài:

```bash
apt-get update && apt-get install -y git nginx certbot python3-certbot-nginx
curl -fsSL https://bun.sh/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
```

Unit systemd gọi `/root/.bun/bin/bun`. Cài Bun ở chỗ khác thì sửa dòng `ExecStart` của các file trong `deploy/systemd/`.

Clone repo nhánh `main`. Máy chủ cần deploy key đọc được repo `chris9962/mgi-bank`:

```bash
git clone -b main git@github.com:chris9962/mgi-bank.git /opt/mgi-bank
cd /opt/mgi-bank
bun install --frozen-lockfile
```

Tạo hai khoá ngẫu nhiên. Mật khẩu DB chỉ gồm chữ và số để không phải mã hoá trong URL:

```bash
openssl rand -hex 24   # mật khẩu DB
openssl rand -hex 32   # VOUCHER_SECRET
```

Viết `/opt/mgi-bank/.env.local`. Không đặt giá trị trong dấu nháy: `docker run --env-file` giữ nguyên dấu nháy trong giá trị.

```bash
cat > /opt/mgi-bank/.env.local <<'EOF'
DATABASE_URL=postgres://mgibank:<mật khẩu DB>@127.0.0.1:5436/mgibank
ADMIN_HOST=admin.minhgroup-i.com.vn
STUDENT_HOST=bank.minhgroup-i.com.vn
STUDENT_ORIGIN=https://bank.minhgroup-i.com.vn
S3_ENDPOINT=https://s3-han02.fptcloud.com
S3_REGION=han02
S3_BUCKET=mgi-bank-images
S3_ACCESS_KEY_ID=<access key FPT Object Storage>
S3_SECRET_ACCESS_KEY=<secret key FPT Object Storage>
S3_QUOTA_GB=500
VOUCHER_SECRET=<chuỗi openssl rand -hex 32>
PHOTO_CHECK_MEMORY=4g
PHOTO_CHECK_CPUS=2
EOF
chmod 600 /opt/mgi-bank/.env.local
```

Ý nghĩa từng biến ở mục 13. `deploy/deploy.sh` dừng khi thiếu biến bắt buộc, kể cả `VOUCHER_SECRET`.

Không đặt `COOKIE_SECURE`. Máy chủ chạy HTTPS nên cookie phiên mang `Secure` và tên `__Host-mgi_session`. Chỉ khi chạy tạm bằng HTTP thuần mới đặt `COOKIE_SECURE=false`, khi đó token phiên đi qua mạng dạng chữ thường.

## 5. Database lần đầu

`deploy/db.sh` tạo mạng `mgi-bank-net` và container `mgi-bank-db` khi chưa có, rồi chờ Postgres nhận kết nối. User, mật khẩu, tên database lấy từ `DATABASE_URL`. Chạy lại không sao.

Cảnh báo trước khi migrate: dòng `Database:` phải là `127.0.0.1:5436/mgibank`. Dòng khác nghĩa là shell đang có `DATABASE_URL` khác, migrate sẽ chạy nhầm database.

```bash
cd /opt/mgi-bank
unset DATABASE_URL
./deploy/db.sh
bun run db:migrate
bun run db:seed
bun run db:create-admin -- --username <tên đăng nhập> --full-name "<Họ tên>"
```

- `db:migrate` in `Database: 127.0.0.1:5436/mgibank` và `Migrate xong: N migration mới, tổng N.`
- `db:seed` nạp 34 tỉnh, 3.321 xã. Bảng tỉnh đã có dữ liệu thì script bỏ qua.
- `db:create-admin` in mật khẩu một lần. Chủ dự án lưu ngay, rồi đổi mật khẩu ở trang Cá nhân sau lần đăng nhập đầu.

Migration `0000` chạy `CREATE EXTENSION pg_trgm`, migration `0003` chạy `CREATE EXTENSION unaccent`. User do container Postgres tạo là superuser nên hai lệnh chạy được. Nếu sau này chuyển sang Postgres có role thường, role đó phải sở hữu database: Postgres 16 coi `unaccent` và `pg_trgm` là extension tin cậy, chủ database tạo được. Không thì superuser chạy hai lệnh `CREATE EXTENSION` đó trước khi migrate.

## 6. Nginx và HTTPS

Phần cấu hình thuộc về app nằm trong repo:

| File | Nội dung |
|---|---|
| `deploy/nginx/limits.conf` | vùng giới hạn request theo IP, nạp ở khối `http` |
| `deploy/nginx/app.conf` | các khối `location`, trần body, chế độ bảo trì |
| `deploy/nginx/proxy.conf` | header chuyển tiếp dùng chung |
| `deploy/nginx/site.conf.example` | mẫu file site cho hai tên miền production |

File site trên máy chủ không nằm trong repo. Certbot ghi khối HTTPS vào file đó, `git reset --hard` lúc deploy sẽ xoá mất.

Cài một lần:

```bash
ln -s /opt/mgi-bank/deploy/nginx/limits.conf /etc/nginx/conf.d/mgi-bank-limits.conf
cp /opt/mgi-bank/deploy/nginx/site.conf.example /etc/nginx/sites-available/mgi-bank.conf
ln -s /etc/nginx/sites-available/mgi-bank.conf /etc/nginx/sites-enabled/mgi-bank.conf
nginx -t && systemctl reload nginx
certbot --nginx -d admin.minhgroup-i.com.vn -d bank.minhgroup-i.com.vn \
  --non-interactive --agree-tos -m <email nhận thông báo> --redirect
nginx -t && systemctl reload nginx
curl -s -o /dev/null -w "%{http_code}\n" https://admin.minhgroup-i.com.vn/login
```

Lệnh cuối in `502` khi app chưa chạy, in `200` sau mục 7.

Certbot xác minh qua cổng 80 mỗi lần gia hạn, nên Security Group phải giữ cổng 80 mở. Gia hạn tự động bằng `certbot.timer`. Kiểm bằng `certbot renew --dry-run`.

Cấu hình làm năm việc:

- Chuyển đúng header `Host`. `src/proxy.ts` chọn trang quản lý hay web học sinh theo Host, thiếu header thì mọi trang trả 404.
- Ghi đè `X-Forwarded-For` bằng địa chỉ thật của kết nối. App lấy địa chỉ cuối của header này cho `audit_log.ip` và `customers.created_ip` (`src/server/http/ip.ts`). Học sinh tự khai header thì bị Nginx ghi đè.
- Giới hạn request theo IP với ngưỡng cao, vì cả trường dùng chung một IP Wi-Fi: 30 request mỗi giây, dồn được 600. Đường gửi ảnh `/api/customers/me/photos` có vùng riêng: 2 lượt mỗi giây, dồn được 200. File tĩnh `/_next/static/` không tính. Vượt ngưỡng thì trả 429.
- Trần body 22 MB ở cả hai tên miền (`client_max_body_size 22m` trong `deploy/nginx/app.conf`): ảnh tối đa 20 MB cộng phần bao của multipart. Trong app có thêm hai trần. `next.config.ts` đặt `experimental.proxyClientMaxBodySize` là 22 MB, vì `src/proxy.ts` chạy cho mọi đường dẫn và Next chỉ giữ 10 MB body khi có proxy, ảnh lớn hơn bị cắt. `putImage` từ chối file quá 20 MB.
- Bảo trì: file `deploy/maintenance/on` có thì trang trả 503 với trang bảo trì, API trả 503 với JSON. `deploy/maintenance-on.sh` và `deploy/maintenance-off.sh` bật tắt, không cần reload Nginx.

Đặt thêm proxy khác (Cloudflare, cân bằng tải) trước Nginx thì `$remote_addr` thành địa chỉ của proxy đó. Khi đó phải cấu hình module `real_ip` trước, không thì mọi học sinh chung một IP và chung một ngưỡng.

Đã kiểm ngày 2026-11-05 bằng `nginx:alpine` nạp đúng ba file của repo, phía sau là một máy chủ in lại header:

| Ca | Kết quả |
|---|---|
| `nginx -t` | đạt |
| Request kèm `X-Forwarded-For: 6.6.6.6` | app nhận `Host` đúng, `X-Forwarded-For` là địa chỉ thật, không còn `6.6.6.6` |
| Body 21 MB vào đường gửi ảnh | 200 |
| Body 23 MB | 413 |
| Bảo trì bật: trang, API | 503 `text/html`, 503 JSON đọc được |
| Bảo trì tắt | 200 |
| 800 request API liền nhau từ một IP | 695 qua, 105 nhận 429 |
| 800 request file tĩnh | 800 qua |
| 260 lượt gửi ảnh liền nhau | 203 qua, 57 nhận 429 |

## 7. Deploy app, worker, job

Thứ tự cố định, từng lệnh một, lệnh trước xong mới chạy lệnh sau:

```bash
cd /opt/mgi-bank && git pull && ./deploy/deploy.sh
./deploy/worker-photo.sh
./deploy/jobs.sh
```

`git pull` đứng trước để lấy chính bản `deploy/deploy.sh` mới nhất. Script tự `git reset --hard origin/main` lần nữa ở bên trong.

`deploy/deploy.sh` chỉ đụng container app, làm bảy bước:

| Pha | Bước | Bảo trì |
|---|---|---|
| 1 | lấy code, kiểm `.env.local`, cài gói, dựng image `mgi-bank-app:new`, thử image ở cổng 3201, sao lưu DB vào `/root/mgi-bank-truoc-deploy-<ngày giờ>.dump` | không |
| 2 | bật bảo trì, migrate, đổi container, kiểm, gắn tag `:latest`, tắt bảo trì | vài chục giây |

Bước thử image chạy `sharp` đổi một ảnh nhỏ sang WebP trong image mới trước. Image thiếu thư viện native của `sharp` thì script dừng ở đây, chưa đụng container đang chạy. Sau đó bước thử đòi bốn điều: `/login` trả 200 với Host quản lý, API quản lý chưa đăng nhập trả 401, web học sinh trả 200 với Host học sinh, đăng nhập sai trả 401. Điều cuối chứng minh app nối được DB. Log container thử không được có `ECONNREFUSED`, `ERR_DLOPEN`, `Failed query`.

Bước kiểm sau khi đổi container không đạt thì script tự lùi về container cũ rồi mới tắt bảo trì, thoát mã 1. Lượt deploy đầu tiên không có container cũ để lùi.

`deploy/worker-photo.sh` dựng image tầng `photo-check`, thử tiến trình OCR trả `{"ready": true}`, rồi thay container `mgi-bank-photo`. Container có trần `PHOTO_CHECK_MEMORY` (mặc định `4g`) và `PHOTO_CHECK_CPUS` (mặc định `2`), chờ dừng 150 giây để làm nốt ảnh đang đọc. Lần dựng đầu tải khoảng 1,5 GB gói và model. Worker hết RAM giữa chừng thì lượt đang đọc được nhận lại tối đa 3 lần rồi ghi Lỗi kiểm.

`deploy/worker-sms.sh` dựng image tầng `sms-worker` và thay container `mgi-bank-sms`. Cảnh báo: bản hiện tại chưa nối nhà cung cấp SMS, `src/server/sms/send.ts` chỉ ghi log rồi đánh dấu tin Đã gửi. Script dừng nếu thiếu cờ `--chap-nhan-chi-ghi-log`. Chủ dự án chỉ chạy lệnh sau khi chấp nhận điều đó:

```bash
./deploy/worker-sms.sh --chap-nhan-chi-ghi-log
```

`deploy/jobs.sh` chép unit trong `deploy/systemd/` vào `/etc/systemd/system/`, chạy lại `mgi-bank-ops-watch.service`, bật timer dọn ảnh mồ côi. Có `.env.backup` thì bật luôn hai timer sao lưu. Chạy lại mỗi khi `deploy/systemd/` đổi.

Cập nhật bản mới dùng đúng ba lệnh đầu mục này. Worker và job chỉ cần chạy lại khi code của chúng đổi, nhưng chạy lại cũng vô hại.

`deploy/lib.sh` là phần dùng chung của các script trên: đọc `.env.local`, đổi địa chỉ DB cho container, cờ `docker run` chung. Không chạy trực tiếp.

Dọn sau khi chắc bản mới ổn:

```bash
docker rm $(docker ps -aq --filter "name=^mgi-bank-app-cu-")
docker image prune -f
```

## 8. Sao lưu và khôi phục

Timer `mgi-bank-backup.timer` chạy `scripts/db-backup.ts` đầu mỗi giờ từ 06:00 đến 23:00. Script dump database bằng `pg_dump` trong container `mgi-bank-db`, kiểm file dump đọc được, đẩy lên bucket sao lưu ở khoá `<ngày>/mgi-bank-<ngày>-<giờ>.dump`, đọc lại dung lượng trên S3. Đĩa giữ 18 file mới nhất ở `/root/mgi-bank-backup`. S3 giữ 7 ngày.

Timer `mgi-bank-backup-check.timer` chạy `scripts/db-backup-check.ts` lúc 08:00. Bản mới nhất cũ hơn 10 giờ thì unit hỏng. Unit hỏng nào cũng gọi `mgi-bank-alert@.service`, dòng báo động nằm trong journal mức `err`.

Viết `.env.backup` một lần:

```bash
cat > /opt/mgi-bank/.env.backup <<'EOF'
BACKUP_S3_BUCKET=mgi-bank-backup
EOF
chmod 600 /opt/mgi-bank/.env.backup
```

Không khai khoá riêng thì sao lưu dùng khoá S3 của app. Cấp được cặp khoá chỉ có quyền trên bucket sao lưu thì thêm hai dòng `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`.

Chạy lần đầu bằng tay, rồi bật timer:

```bash
cd /opt/mgi-bank
bun run db:backup
bun run db:backup:check
./deploy/jobs.sh
journalctl -p err -t mgi-bank --since today --no-pager
```

Khôi phục dùng `scripts/db-restore.ts`. Mặc định khôi phục thử vào database riêng: dump hỏng mà khôi phục đè thì mất cả hai thứ cùng lúc.

```bash
cd /opt/mgi-bank
bun run db:restore                              # liệt kê 30 bản mới nhất
bun run db:restore -- <khoá> --thu              # khôi phục vào mgibank_thu, in số dòng hai database cạnh nhau
docker exec mgi-bank-db psql -U mgibank -d postgres -c "drop database mgibank_thu"
```

Diễn tập khôi phục mỗi quý: chạy lệnh `--thu` với bản mới nhất, so số dòng từng bảng với database thật, rồi xoá `mgibank_thu`. Số dòng lệch nhiều hơn lượng nhập liệu từ giờ sao lưu tới lúc so là bản sao lưu có vấn đề.

Khôi phục đè database thật. Cảnh báo: mọi dữ liệu nhập sau giờ của bản dump sẽ mất. Script từ chối chạy khi app hoặc worker còn chạy, và chờ 10 giây trước khi ghi đè:

```bash
cd /opt/mgi-bank
./deploy/maintenance-on.sh
docker stop mgi-bank-app mgi-bank-sms mgi-bank-photo
bun run db:restore -- <khoá hoặc đường dẫn file .dump> --that
docker start mgi-bank-app mgi-bank-sms mgi-bank-photo
./deploy/maintenance-off.sh
```

## 9. Lùi lại

`deploy/deploy.sh` giữ đúng một container cũ tên `mgi-bank-app-cu-<ngày giờ>` và bản dump trước deploy ở `/root/`. Lùi tay:

```bash
cd /opt/mgi-bank
./deploy/maintenance-on.sh
docker stop mgi-bank-app && docker rm mgi-bank-app
docker rename "$(docker ps -a --format '{{.Names}}' --filter 'name=^mgi-bank-app-cu-')" mgi-bank-app
# Chỉ khi lượt deploy có migration mới: dừng worker rồi khôi phục bản dump trước deploy.
docker stop mgi-bank-sms mgi-bank-photo
bun run db:restore -- /root/mgi-bank-truoc-deploy-<ngày giờ>.dump --that
docker start mgi-bank-sms mgi-bank-photo
# Hết phần chỉ khi có migration.
docker start mgi-bank-app
./deploy/maintenance-off.sh
```

Lùi code mà không lùi database thì bản cũ đọc schema mới. Thêm cột thường vẫn chạy, xoá cột thì hỏng. Khôi phục database làm mất dữ liệu nhập trong lúc bản mới chạy, nên người vận hành cân nhắc trước khi chạy dòng `--that`.

## 10. Trang 18 và ops-watch

`scripts/ops-watch.ts` chạy thẳng trên máy chủ bằng `mgi-bank-ops-watch.service`, không chạy trong container: trong container thì `df` ra ổ đĩa của container. Mỗi 60 giây script đo CPU, RAM, ổ đĩa rồi ghi một dòng `host_metrics`. Mỗi giờ script cộng dung lượng bucket ảnh. Mỗi vòng script xoá số đo cũ hơn 7 ngày và phiên đăng nhập đã hết hạn. Script không gửi thông báo đẩy.

Trang 18 Vận hành hệ thống ở nhóm Hệ thống, chỉ Quản trị mở được. Ô S3 hiện "đã dùng / tổng" khi có `S3_QUOTA_GB`. Ô nào vượt 80% thì có nhãn "Vượt 80%".

```bash
cd /opt/mgi-bank && bun run ops:watch -- --mot-vong     # chạy một vòng để xem trước
systemctl status mgi-bank-ops-watch.service
journalctl -u mgi-bank-ops-watch.service -n 50 --no-pager
```

## 11. Dọn ảnh mồ côi

Ảnh ghi lên S3 xong mà transaction ghi dòng `proof_photos` lỗi thì nằm lại, không dòng nào trỏ tới. `mgi-bank-s3-orphans.timer` chạy `scripts/s3-orphans.ts` lúc 03:30 mỗi ngày. Script xoá object trong `proofs/` cũ hơn 24 giờ mà không dòng `proof_photos` nào trỏ tới. Object mới hơn 24 giờ thì giữ, vì transaction có thể chưa commit.

Chạy khô trước khi tin script, lệnh chỉ liệt kê:

```bash
cd /opt/mgi-bank && bun run s3:orphans -- --dry-run
journalctl -u mgi-bank-s3-orphans.service -n 50 --no-pager
```

## 12. Bản test

Bản test chạy chung máy chủ production, bật khi cần và tắt khi xong. Bản test có clone, container, database, bucket và tên miền riêng, lấy nhánh `dev`. Bản test không chạy worker: lượt kiểm ảnh và tin SMS nằm chờ.

Chủ dự án chọn hai tên miền, ví dụ `admin-test.minhgroup-i.com.vn` và `bank-test.minhgroup-i.com.vn`, rồi trỏ DNS như mục 3. Tạo một bucket ảnh riêng cho bản test, ví dụ `mgi-bank-test-images`. `deploy/test-env.sh` dừng khi bucket trùng bucket production.

Dựng lần đầu:

```bash
git clone -b dev git@github.com:chris9962/mgi-bank.git /opt/mgi-bank-test
cd /opt/mgi-bank-test
cat > .env.local <<'EOF'
DATABASE_URL=postgres://mgibank_test:<mật khẩu DB test>@127.0.0.1:5437/mgibank_test
ADMIN_HOST=admin-test.minhgroup-i.com.vn
STUDENT_HOST=bank-test.minhgroup-i.com.vn
STUDENT_ORIGIN=https://bank-test.minhgroup-i.com.vn
S3_ENDPOINT=https://s3-han02.fptcloud.com
S3_REGION=han02
S3_BUCKET=mgi-bank-test-images
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
VOUCHER_SECRET=<chuỗi openssl rand -hex 32, khác production>
EOF
chmod 600 .env.local
./deploy/test-env.sh update
bun run db:seed
bun run db:create-admin -- --username <tên đăng nhập> --full-name "<Họ tên>"
cp /opt/mgi-bank-test/deploy/nginx/test-site.conf.example /etc/nginx/sites-available/mgi-bank-test.conf
ln -s /etc/nginx/sites-available/mgi-bank-test.conf /etc/nginx/sites-enabled/mgi-bank-test.conf
nginx -t && systemctl reload nginx
certbot --nginx -d admin-test.minhgroup-i.com.vn -d bank-test.minhgroup-i.com.vn --non-interactive --agree-tos -m <email> --redirect
```

Chọn tên miền khác thì sửa hai dòng `server_name` trong file site và hai biến `ADMIN_HOST`, `STUDENT_HOST`.

Dùng hằng ngày:

```bash
cd /opt/mgi-bank-test
./deploy/test-env.sh update   # lấy nhánh dev mới nhất, migrate, dựng lại app
./deploy/test-env.sh off      # tắt app và DB, dữ liệu giữ trong volume
./deploy/test-env.sh on       # bật lại
```

Script dừng khi chạy ngoài `/opt/mgi-bank-test` hoặc khi `DATABASE_URL` không trỏ `127.0.0.1:5437`. Container app của bản test có trần 1 GB RAM. Dựng image bản test chiếm CPU vài phút, nên chạy `update` ngoài giờ học sinh nộp hồ sơ.

## 13. Biến môi trường

`.env.local` của production:

| Biến | Bắt buộc | Nghĩa |
|---|---|---|
| `DATABASE_URL` | có | Postgres ở `127.0.0.1:5436`. Container nhận bản đổi sang `mgi-bank-db:5432` |
| `ADMIN_HOST` | có | tên miền trang quản lý |
| `STUDENT_HOST` | có | tên miền web học sinh |
| `STUDENT_ORIGIN` | có | gốc link QR in cho trường, `https://bank.minhgroup-i.com.vn` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | có | bucket ảnh production |
| `VOUCHER_SECRET` | có | khoá HMAC của 4 ký tự kiểm trong mã voucher, không đổi sau mã đầu tiên |
| `S3_QUOTA_GB` | không | hạn mức bucket ảnh, ô S3 của Trang 18 hiện phần trăm |
| `S3_TIMEOUT_MS` | không | hạn giờ mỗi lệnh S3, mặc định 60000 |
| `OCR_TIMEOUT_MS` | không | hạn đọc một ảnh của worker kiểm ảnh, mặc định 120000 |
| `PHOTO_CHECK_MEMORY`, `PHOTO_CHECK_CPUS` | không | trần container kiểm ảnh, mặc định `4g` và `2` |
| `COOKIE_SECURE` | không | chỉ đặt `false` khi chạy tạm bằng HTTP |
| `OPS_WATCH_SLEEP`, `OPS_S3_EVERY_MINUTES`, `OPS_DISK_PATH`, `OPS_KEEP_DAYS` | không | nhịp đo của ops-watch: 60 giây, 60 phút, `/`, 7 ngày |
| `ORPHAN_MIN_AGE_HOURS` | không | tuổi tối thiểu của ảnh mồ côi trước khi xoá, mặc định 24 |

`.env.backup`:

| Biến | Nghĩa |
|---|---|
| `BACKUP_S3_BUCKET` | bucket sao lưu, bắt buộc, khác bucket ảnh |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | khoá riêng, thiếu thì dùng khoá S3 của app |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` | thiếu thì dùng của app |
| `BACKUP_KEEP_DAYS`, `BACKUP_KEEP_LOCAL`, `BACKUP_MAX_AGE_HOURS` | 7 ngày trên S3, 18 file trên đĩa, ngưỡng tuổi 10 giờ |
| `BACKUP_LOCAL_DIR`, `BACKUP_DB_CONTAINER` | `/root/mgi-bank-backup`, `mgi-bank-db` |

## 14. Lệnh thường dùng

```bash
docker ps --filter "name=^mgi-bank-" --format "table {{.Names}}\t{{.Status}}"
docker logs -f mgi-bank-app
docker logs -f mgi-bank-photo
docker exec -it mgi-bank-db psql -U mgibank -d mgibank
systemctl list-timers "mgi-bank-*"
journalctl -p err -t mgi-bank --since today --no-pager
nginx -t && systemctl reload nginx
tail -f /var/log/nginx/error.log
```

Image app khai `HEALTHCHECK` gọi `/login` với Host quản lý mỗi 30 giây. Cột trạng thái của `docker ps` hiện `healthy` hoặc `unhealthy`.

## 15. Việc chưa làm

- Worker SMS chưa nối nhà cung cấp SMS. Tin bị đánh dấu Đã gửi mà phụ huynh không nhận.
- Security Group chỉ nên mở cổng 22, 80, 443. Cổng 22 nên siết về IP cố định của người vận hành.
- Chưa có backup job cho cả VM trên console FPT. Sao lưu mục 8 chỉ giữ database, không giữ `.env.local`, `.env.backup` và file site Nginx. Chủ dự án giữ bản sao ba file đó ở nơi an toàn ngoài máy chủ.
