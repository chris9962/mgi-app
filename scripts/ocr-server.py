"""
Tiến trình đọc chữ trên ảnh, chép từ mgst-app scripts/ocr-server.py. Chạy lâu dài, nói chuyện bằng JSON mỗi dòng.

`src/server/ocr/reader.ts` mở tiến trình này một lần rồi giữ suốt: nạp model mất vài giây, mở lại mỗi ảnh thì mỗi ảnh tốn thêm chừng đó.

    stdin   {"path": "/tmp/anh.webp"}
            {"path": "/tmp/anh.webp", "code": "ND-TPB-01"}   đọc lại vùng lệch O/0, I/1 của mã, xem `make_fallback`
    stdout  {"lines": ["Mở tài khoản thành công", "TRẦN MINH ANH", ...], "ms": 2300}
            {"error": "..."}
    dòng đầu khi sẵn sàng: {"ready": true}

PaddleOCR chỉ dò vùng chữ (`PP-OCRv5_mobile_det`), VietOCR đọc từng vùng (`vgg_transformer`). Mã có O, I, 0, 1 thì vùng
VietOCR đọc lệch được đọc lại bằng `PP-OCRv6_medium_rec`, chỉ nạp ở lượt đầu cần.

Mọi log của thư viện đi ra stderr; stdout chỉ có JSON.

Biến môi trường:
    OCR_DET_MODEL   tên model dò vùng, mặc định PP-OCRv5_mobile_det
    OCR_CONFIG      đường dẫn YAML cấu hình `vgg_transformer` lưu sẵn; thiếu thì tải từ vocr.vn
    OCR_WEIGHTS     đường dẫn `vgg_transformer.pth` tải sẵn; thiếu thì tải về
    OCR_THREADS     số luồng torch và paddle, mặc định 2

Tải sẵn model lúc dựng image:  python scripts/ocr-server.py --tai-model /app/.models
"""
import json
import os
import re
import sys
import time
import unicodedata

# Thư viện in tiến trình tải model ra stdout; dồn hết sang stderr để stdout sạch.
OUT = sys.stdout
sys.stdout = sys.stderr

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402

# vietocr 0.3.12 còn gọi Image.ANTIALIAS, Pillow >= 10 đã bỏ tên này.
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

THREADS = int(os.environ.get("OCR_THREADS", "2"))
torch.set_num_threads(THREADS)

from paddleocr import TextDetection, TextRecognition  # noqa: E402
from vietocr.tool.config import Cfg  # noqa: E402
from vietocr.tool.predictor import Predictor  # noqa: E402

REC_MODEL = "vgg_transformer"
# Lề cắt vùng (ngang, dọc) px quanh hộp chữ trước khi đưa VietOCR đọc, như mgst-app.
PAD = (4, 4)
DET_MODEL = os.environ.get("OCR_DET_MODEL", "PP-OCRv5_mobile_det")

# Đọc mất dấu tiếng Việt nên không thay VietOCR được, chỉ đọc lại vùng mã: trên 26 ô mã MB mgst-app đo 2026-10-22 đúng 23, VietOCR đúng 8.
ALT_REC_MODEL = "PP-OCRv6_medium_rec"
alt_rec = None


def load_det():
    # paddlepaddle 3.3.1 trên x86 lỗi ở tầng oneDNN khi dò vùng; dò vùng chỉ 0,4 s nên tắt không đáng kể.
    return TextDetection(model_name=DET_MODEL, device="cpu", cpu_threads=THREADS, enable_mkldnn=False)


def load_alt_rec():
    global alt_rec
    if alt_rec is None:
        alt_rec = TextRecognition(model_name=ALT_REC_MODEL, device="cpu", cpu_threads=THREADS, enable_mkldnn=False)
    return alt_rec


AMBIGUOUS = str.maketrans("OI", "01")


def strip_accents(text):
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn").replace("đ", "d").replace("Đ", "D")


def compact(text):
    return re.sub(r"[^A-Z0-9]", "", strip_accents(text).upper())


def make_fallback(code):
    """Hàm đọc lại một vùng bằng Paddle, hoặc None khi yêu cầu không kèm mã.

    VietOCR chọn O hay 0, I hay 1 theo ký tự đứng trước: `O108` ra `0108`, `AI83` ra `A183` (mgst-app đo 2026-10-21).
    Chỉ đọc lại vùng mà gộp O/0, I/1 thì có mã nhưng chưa có đúng mã. mgst-app so theo cụm chữ-số; mã của mgi-bank có
    gạch nối như `ND-TPB-01` nên so trên chuỗi đã bỏ ký tự ngoài chữ số. So nguyên văn vẫn là việc của `src/server/ocr/text.ts`."""
    exact = compact(code or "")
    if not re.search(r"[OI01]", exact):
        return None
    key = exact.translate(AMBIGUOUS)

    def fallback(image, text):
        seen = compact(text)
        if exact in seen or key not in seen.translate(AMBIGUOUS):
            return None
        bgr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        return next(iter(load_alt_rec().predict(bgr)))["rec_text"].strip()

    return fallback


def load_rec():
    # `load_config_from_name` tải YAML từ vocr.vn mỗi lần gọi; trong Docker dùng bản đã lưu lúc build để chạy không cần mạng.
    config = os.environ.get("OCR_CONFIG")
    cfg = Cfg.load_config_from_file(config) if config else Cfg.load_config_from_name(REC_MODEL)
    # Trọng số CNN đã nằm trong checkpoint; `pretrained` chỉ kéo thêm 548 MB vgg19_bn lúc chạy.
    cfg["cnn"]["pretrained"] = False
    cfg["predictor"]["beamsearch"] = False
    cfg["device"] = "cpu"
    weights = os.environ.get("OCR_WEIGHTS")
    if weights:
        cfg["weights"] = weights
    return Predictor(cfg)


def crop(img, poly):
    pad_x, pad_y = PAD
    xs = [int(p[0]) for p in poly]
    ys = [int(p[1]) for p in poly]
    x0, x1 = max(min(xs) - pad_x, 0), min(max(xs) + pad_x, img.shape[1])
    y0, y1 = max(min(ys) - pad_y, 0), min(max(ys) + pad_y, img.shape[0])
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    return Image.fromarray(cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGB))


def read(det, rec, path, fallback=None):
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Không mở được ảnh {path}")
    h, w = img.shape[:2]
    if w <= h:
        return read_portrait(det, rec, img, fallback)
    # Ảnh ngang là điện thoại nằm nghiêng hay lộn ngược trong ảnh chụp; app chỉ có bố cục dọc. Bộ phân loại hướng của
    # Paddle đoán sai 1/2 ảnh thử ở mgst-app, nên đọc cả bốn hướng và giữ hướng nhiều từ có nghĩa nhất, hoà thì nhiều chữ nhất.
    best = []
    for rot in (None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180):
        lines = read_upright(det, rec, img if rot is None else cv2.rotate(img, rot), fallback)
        if (vocab_hits(lines), word_letters(lines)) > (vocab_hits(best), word_letters(best)):
            best = lines
    return best


WORD = re.compile(r"[A-Za-zÀ-ỹ]{3,}")


def word_letters(lines):
    return sum(len(m) for line in lines for m in WORD.findall(line))


# Từ hay gặp trên màn app ngân hàng, không dấu. Ảnh lộn ngược 180° vẫn ra "từ", nên phải đếm từ có nghĩa mới phân biệt được.
VOCAB = frozenset(
    "tai khoan thanh cong chuyen tien giao dich ngan hang noi dung thoi gian so ten khach dang ky "
    "ma phi ngay nguoi nhan hinh thuc chi tiet thong tin mo nhap mat khau lich su tong du bien dong "
    "truy van hoan tat xac chu gioi thieu tinh pho nhanh tra soat chia se luu mau xong hom nay "
    "trang thai luong cua ban den tu don vi loai hop dong dieu kien".split()
)


def vocab_hits(lines):
    return sum(1 for line in lines for w in re.findall(r"[A-Za-zÀ-ỹ]+", line) if strip_accents(w).lower() in VOCAB)


def read_portrait(det, rec, img, fallback):
    """Ảnh dọc đọc một lượt; đọc ra gần như không có từ nào có nghĩa thì thử lộn 180° (ảnh chụp lại điện thoại cầm
    ngược) và giữ lượt nhiều từ có nghĩa hơn."""
    lines = read_upright(det, rec, img, fallback)
    if vocab_hits(lines) >= 3:
        return lines
    flipped = read_upright(det, rec, cv2.rotate(img, cv2.ROTATE_180), fallback)
    return flipped if vocab_hits(flipped) > vocab_hits(lines) else lines


def read_upright(det, rec, img, fallback):
    polys = []
    for res in det.predict(img):
        polys.extend(res["dt_polys"])
    # Thứ tự đọc: trên xuống, trái sang.
    boxes = []
    for poly in polys:
        ys = [p[1] for p in poly]
        xs = [p[0] for p in poly]
        boxes.append((min(ys), max(ys), min(xs), poly))
    boxes.sort(key=lambda b: (b[0], b[2]))
    crops = [crop(img, b[3]) for b in boxes]
    crops = [c for c in crops if c is not None]
    if not crops:
        return []
    lines = []
    for image, text in zip(crops, rec.predict_batch(crops)):
        text = (text or "").strip()
        if not text:
            continue
        lines.append(text)
        # Bản đọc lại đứng ngay sau dòng gốc, như thêm một dòng chữ của ảnh.
        alt = fallback(image, text) if fallback else None
        if alt:
            lines.append(alt)
    return lines


def fetch_models(target):
    """Tải model dò vùng, YAML và trọng số VietOCR vào `target`, chạy một lần lúc build."""
    os.makedirs(target, exist_ok=True)
    TextDetection(model_name=DET_MODEL, device="cpu", enable_mkldnn=False)
    TextRecognition(model_name=ALT_REC_MODEL, device="cpu", enable_mkldnn=False)
    from vietocr.tool.utils import download_weights

    cfg = Cfg.load_config_from_name(REC_MODEL)
    cfg["cnn"]["pretrained"] = False
    cfg["device"] = "cpu"
    cfg.save(os.path.join(target, f"{REC_MODEL}.yml"))
    path = download_weights(cfg["weights"])
    os.replace(path, os.path.join(target, f"{REC_MODEL}.pth"))
    print("đã tải model vào", target, file=sys.stderr)


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--tai-model":
        fetch_models(sys.argv[2])
        return
    det = load_det()
    rec = load_rec()
    OUT.write(json.dumps({"ready": True}) + "\n")
    OUT.flush()
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        t = time.time()
        try:
            req = json.loads(raw)
            lines = read(det, rec, req["path"], make_fallback(req.get("code")))
            reply = {"lines": lines, "ms": int((time.time() - t) * 1000)}
        except Exception as e:  # noqa: BLE001
            reply = {"error": f"{type(e).__name__}: {e}"}
        OUT.write(json.dumps(reply, ensure_ascii=False) + "\n")
        OUT.flush()


if __name__ == "__main__":
    main()
