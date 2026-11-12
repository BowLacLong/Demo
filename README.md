# HỆ THỐNG QUẢN LÝ THƯ VIỆN (LIBRARY MANAGEMENT SYSTEM)
### ĐỒ ÁN CUỐI KỲ &bull; MÔN THIẾT KẾ PHẦN MỀM (TKPM / SEP)

> **Hệ thống web hoàn chỉnh tích hợp nguyên khối (Monolithic), đáp ứng chuẩn xác 100% các quy định nghiệp vụ QĐ1 &rarr; QĐ6, kiến trúc 3 lớp (3-Tier MVC), cơ sở dữ liệu MongoDB tự khởi tạo (không cần cài đặt SQLite) & nạp sẵn dữ liệu mẫu thực tế, giao diện hiện đại với Tailwind CSS, hỗ trợ xuất Excel, in biên lai và kiểm thử tự động (Unit & Integration Tests).**

---

## ⚡ HƯỚNG DẪN KHỞI CHẠY NHANH (QUICKSTART)

Hệ thống dùng **MongoDB** làm cơ sở dữ liệu: cần dịch vụ MongoDB đang chạy (mặc định `mongodb://127.0.0.1:27017`, đổi bằng biến `MONGODB_URI`). Cấu trúc collection, bộ đếm id và dữ liệu mẫu được tự tạo ở lần chạy đầu tiên, sau đó chỉ cần Node.js và 1 lệnh duy nhất!

### 1. Khởi chạy ứng dụng
Mở terminal tại thư mục dự án và chạy:
```bash
npm install            # cài phụ thuộc
npm start
```
Server sẽ tự động:
- Kết nối MongoDB (mặc định mongodb://127.0.0.1:27017), tự tạo collection/index và nạp dữ liệu mẫu
- Tự động nạp toàn bộ dữ liệu mẫu (sách, độc giả, phiếu mượn, nợ phạt, quy định)
- Mở máy chủ tại cổng `3000`

### 2. Truy cập hệ thống
Mở trình duyệt web và truy cập địa chỉ:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 TÀI KHOẢN THỬ NGHIỆM ĐỂ CHẤM ĐỒ ÁN

Tại màn hình đăng nhập đã tích hợp sẵn **các nút click nhanh (1-Click Fill)** để chấm điểm thuận tiện:

| Vai trò (Role) | Tên đăng nhập | Mật khẩu | Quyền hạn và tính năng chính |
|---|---|---|---|
| **Quản Trị Viên (Admin)** | `admin` | `admin123` | Toàn quyền hệ thống, cấu hình quy định QĐ1 - QĐ6, quản lý tài khoản & phân quyền, xem mọi báo cáo |
| **Thủ Thư (Librarian)** | `thuthu01` | `thuthu123` | Quản lý sách, lập thẻ độc giả (QĐ2), lập phiếu mượn (QĐ3), nhận trả sách & tính phạt (QĐ4), thu tiền phạt & in biên lai (QĐ5), xem báo cáo (QĐ6), xuất file Excel |
| **Độc Giả (Reader)** | `docgia01` | `docgia123` | Tra cứu danh mục sách trực tuyến (OPAC), xem thẻ thư viện cá nhân, lịch sử mượn trả và hạn trả |

---

## 🎯 CÁC CHỨC NĂNG NGHIỆP VỤ ĐÁP ỨNG CHUẨN ĐỒ ÁN TKPM

### 1. Quản lý Quy định Hệ thống (QĐ1 - QĐ6) — Cốt lõi đồ án
- Cho phép Admin thay đổi các thông số nghiệp vụ linh hoạt tại giao diện `/rules`:
  - **QĐ1:** Khoảng cách năm xuất bản tối đa để tiếp nhận sách (mặc định: 8 năm).
  - **QĐ2:** Độ tuổi độc giả tối thiểu (18) và tối đa (55 tuổi); Thời hạn sử dụng thẻ (6 tháng).
  - **QĐ3:** Số lượng sách mượn tối đa cùng lúc (5 cuốn); Số ngày mượn tối đa (14 ngày); Tùy chọn chặn mượn nếu đang có sách quá hạn.
  - **QĐ4:** Tiền phạt trễ hạn mỗi ngày (1.000 VNĐ / ngày).
  - **QĐ5:** Quy tắc kiểm soát số tiền thu tiền phạt $\le$ số tiền nợ.
  - Quản lý danh mục Thể loại sách và Loại độc giả.

### 2. Tiếp nhận sách & Quản lý Kho sách (QĐ1)
- Tiếp nhận sách mới, kiểm tra ràng buộc năm xuất bản ($\le 8$ năm) và thể loại hợp lệ.
- Tự động sinh mã vạch cá biệt cho từng cuốn sách (`BK0001-01`, `BK0001-02`,...).
- Tra cứu sách (OPAC) theo tên, tác giả, ISBN, thể loại, tình trạng còn/hết trong kho.
- Bổ sung bản sách cá biệt, xếp vị trí kệ sách.
- Xuất danh sách toàn bộ sách ra file Excel (`.xlsx`).

### 3. Lập thẻ Độc giả & Quản lý Thẻ thư viện (QĐ2)
- Lập thẻ độc giả mới, kiểm tra độ tuổi hợp lệ (18 - 55 tuổi) qua ngày sinh với thông báo trực quan theo thời gian thực.
- Tự động tính ngày hết hạn thẻ (+6 tháng).
- Giao diện thẻ thư viện trực quan với mã vạch cá biệt, hỗ trợ in ấn.
- Gia hạn thời hạn thẻ độc giả (+6 tháng hoặc +12 tháng).
- Quản lý công nợ phạt và lịch sử mượn trả của từng độc giả.
- Xuất danh sách độc giả ra file Excel.

### 4. Cho mượn sách (QĐ3)
- Lập phiếu mượn sách (`PMxxxx`).
- Tự động kiểm tra điều kiện mượn: Thẻ còn hạn, không giữ sách quá hạn, số lượng mượn không vượt quá giới hạn tối đa.
- Chỉ hiển thị các cuốn sách thực sự có sẵn trong kho.
- Tự động tính ngày hẹn trả (+14 ngày) và hỗ trợ gia hạn thời gian mượn.

### 5. Nhận trả sách & Tính tiền phạt (QĐ4)
- Ghi nhận trả từng cuốn sách trong phiếu mượn.
- Tự động đối chiếu ngày trả với hạn trả: nếu trả trễ, tự động tính số ngày trễ và số tiền phạt theo công thức: $\text{Số ngày trễ} \times 1.000\text{ đ}$.
- Ghi nhận tình trạng sách bị hư hại hoặc làm mất và tính phí bồi thường.
- Tự động cộng dồn tiền phạt vào tổng nợ của độc giả.

### 6. Thu tiền phạt & In biên lai (QĐ5)
- Lập phiếu thu tiền phạt (`PTxxxx`) cho độc giả có nợ phạt.
- Kiểm tra nghiêm ngặt quy định: **Số tiền thu không được vượt quá số tiền độc giả đang nợ**.
- Tự động trừ nợ sau khi thu tiền thành công.
- In biên lai thu tiền phạt chuẩn mẫu in có chữ ký độc giả và thủ thư.
- Xuất danh sách phiếu thu tiền phạt ra file Excel.

### 7. Báo cáo & Thống kê (QĐ6)
- **Báo cáo 6.1:** Báo cáo tình hình mượn sách theo thể loại trong tháng (Bảng số liệu chi tiết, tỉ lệ %, biểu đồ Doughnut Chart, xuất Excel).
- **Báo cáo 6.2:** Báo cáo thống kê sách trả trễ theo ngày (Danh sách sách quá hạn, số ngày trễ, thông tin độc giả, số điện thoại liên hệ, xuất Excel).
- **Dashboard Tổng quan:** KPI số liệu, biểu đồ tần suất mượn sách, top sách được mượn nhiều nhất.

---

## 🧪 CHẠY KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTING)

Dự án bao gồm bộ kiểm thử tự động toàn diện viết bằng **Jest** và **Supertest**, kiểm thử đầy đủ các quy định nghiệp vụ và API:

```bash
npm test
```

Kết quả: **16 / 16 Test Cases Passed 100%**:
- `tests/rules.test.js`: Kiểm thử Unit test cho các quy định QĐ1, QĐ2, QĐ4, QĐ5.
- `tests/api.test.js`: Kiểm thử tích hợp Integration test cho các RESTful API endpoints.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
DoAnCuoiKy/
├── data/
│   └── (thư mục dữ liệu cũ - hệ thống hiện tại dùng MongoDB)
├── docs/                    # Bộ hồ sơ đặc tả thiết kế chuẩn đồ án TKPM
│   ├── 1_TONG_QUAN_DO_AN.md
│   ├── 2_BUSINESS_RULES_QD1_QD6.md
│   ├── 3_DATABASE_DESIGN_ERD.md
│   ├── 4_API_SPECIFICATION.md
│   └── 5_TEST_CASES_TEST_REPORT.md
├── src/
│   ├── config/
│   │   ├── db.js            # Kết nối MongoDB, bộ đếm id, index
│   │   └── seed.js          # Dữ liệu mẫu ban đầu (sách, độc giả, phiếu mượn)
│   ├── controllers/         # Các Controller xử lý nghiệp vụ & view
│   ├── middleware/          # Xác thực Session & Phân quyền RBAC
│   ├── routes/
│   │   ├── webRoutes.js     # Router giao diện Web EJS
│   │   └── apiRoutes.js     # Router RESTful API JSON
│   ├── services/            # Tầng logic cốt lõi (RuleService, BookService,...)
│   ├── utils/               # Tiện ích xuất Excel (xlsx)
│   └── views/               # Giao diện EJS Template Engine
│       ├── layouts/         # Layout khung
│       ├── partials/        # Sidebar, Header, Alerts, Dialogs
│       ├── auth/            # Đăng nhập, Hồ sơ cá nhân
│       ├── dashboard/       # Bảng điều khiển & biểu đồ Chart.js
│       ├── books/           # Quản lý kho sách & tiếp nhận sách mới (QĐ1)
│       ├── readers/         # Quản lý thẻ độc giả (QĐ2)
│       ├── borrow/          # Lập phiếu mượn (QĐ3), trả sách & phạt (QĐ4)
│       ├── fines/           # Lập phiếu thu tiền phạt & in biên lai (QĐ5)
│       ├── rules/           # Cấu hình quy định động hệ thống (QĐ1 - QĐ6)
│       ├── reports/         # Báo cáo mượn thể loại & sách trả trễ (QĐ6)
│       └── users/           # Quản lý tài khoản người dùng & phân quyền
├── tests/                   # Bộ kiểm thử tự động
│   ├── rules.test.js        # Unit test cho logic quy định
│   └── api.test.js          # Integration test cho API
├── package.json
├── server.js                # Điểm khởi chạy chính của ứng dụng
└── README.md
```

---

---

## ⚙️ CI/CD VỚI GITHUB ACTIONS

Kho mã nguồn đã cấu hình sẵn hai pipeline trong `.github/workflows/`.

### 1. `ci.yml` — Kiểm tra chất lượng (CI)

Kích hoạt khi `push` / `pull_request` vào nhánh `main` hoặc `master`, hoặc chạy tay từ tab **Actions**:

| Bước | Nội dung |
|---|---|
| Cài phụ thuộc | `npm ci` theo đúng `package-lock.json` |
| Kiểm tra cú pháp | `node --check` toàn bộ tệp `.js` (bắt lỗi như thiếu ngoặc) |
| Kiểm thử | `npm test` (Jest + Supertest) kèm báo cáo độ phủ |
| Khởi động thử | Chạy thật `npm start` rồi gọi `GET /login`, yêu cầu HTTP 200 |
| Ma trận phiên bản | Node 20 và Node 22 |

Báo cáo độ phủ được lưu thành artifact `coverage-report` (7 ngày).

### 2. `cd.yml` — Phát hành & triển khai (CD)

Kích hoạt khi `push` vào nhánh chính, khi đẩy tag dạng `v*`, hoặc chạy tay:

1. Cài phụ thuộc và **chạy lại test** — test lỗi thì dừng, không phát hành.
2. Đóng gói `library-app-<version>.tar.gz` (không kèm `node_modules`, `data`, `tests`).
3. Nếu là tag `v*`: tạo **GitHub Release** kèm gói phát hành và ghi chú tự động.
4. Nếu là nhánh chính: triển khai qua SSH, `npm ci --omit=dev` và khởi động lại bằng PM2.

### 3. Secrets cần thiết lập (Settings → Secrets and variables → Actions)

| Secret | Bắt buộc | Mô tả |
|---|---|---|
| `DEPLOY_HOST` | Có | IP hoặc tên miền máy chủ |
| `DEPLOY_USER` | Có | Tài khoản SSH |
| `DEPLOY_SSH_KEY` | Có | Nội dung private key SSH |
| `DEPLOY_PATH` | Có | Thư mục mã nguồn trên máy chủ |
| `DEPLOY_PORT` | Không | Cổng SSH, mặc định `22` |
| `PM2_APP_NAME` | Không | Tên tiến trình PM2, mặc định `library-app` |

> Nếu chưa cấu hình secrets, pipeline vẫn chạy xanh và chỉ **bỏ qua** bước triển khai (có ghi chú rõ trong log), nên dùng được CI ngay sau khi đẩy mã nguồn lên GitHub.

Máy chủ đích cần có sẵn `git`, Node.js 20+, npm và `pm2` (`npm i -g pm2`).

### 4. Biến môi trường

Sao chép `.env.example` thành `.env` (đã nằm trong `.gitignore`) và chỉnh `PORT`, `NODE_ENV`, `SESSION_SECRET`. Ở môi trường production bắt buộc đặt `SESSION_SECRET` là chuỗi ngẫu nhiên dài, không dùng giá trị mặc định.

---

## 👨‍💻 BẢN QUYỀN & THÔNG TIN HỌC PHẦN
Đồ án môn học Thiết Kế Phần Mềm (Software Engineering Project).
Mọi thắc mắc hoặc cần hỗ trợ thêm về đồ án, vui lòng liên hệ nhóm phát triển.
