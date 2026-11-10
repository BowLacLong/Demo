# BÁO CÁO TỔNG QUAN ĐỒ ÁN MÔN THIẾT KẾ PHẦN MỀM (TKPM)
## ĐỀ TÀI: XÂY DỰNG VÀ PHÁT TRIỂN HỆ THỐNG QUẢN LÝ THƯ VIỆN

---

### 1. Thông Tin Chung
- **Tên đề tài:** Hệ Thống Quản Lý Thư Viện Chuẩn Quy Định Nghiệp Vụ (Library Management System).
- **Học phần:** Thiết Kế Phần Mềm (Software Engineering Project - SEP).
- **Mục tiêu:** Xây dựng ứng dụng web quản trị và phục vụ mượn trả sách hoàn chỉnh, giải quyết bài toán quản lý tài nguyên sách, hồ sơ độc giả, kiểm soát quy trình mượn - trả, tính toán tiền phạt và kết xuất báo cáo thống kê chính xác theo các quy định nghiệp vụ động (QĐ1 -> QĐ6).

---

### 2. Đối Tượng Sử Dụng & Phân Quyền (RBAC)
Hệ thống thiết kế theo mô hình phân quyền chặt chẽ gồm 3 nhóm người dùng:
1. **Quản trị viên (Admin):**
   - Quản lý toàn bộ người dùng hệ thống và cấp quyền truy cập.
   - Toàn quyền thay đổi các thông số Quy định Nghiệp vụ (QĐ1 -> QĐ6) linh hoạt mà không cần sửa mã nguồn.
   - Quản lý danh mục thể loại sách, loại độc giả, nhà xuất bản, tác giả.
   - Xem toàn bộ báo cáo doanh thu phạt, tình hình mượn trả và dashboard tổng quan.
2. **Thủ thư (Librarian):**
   - Tiếp nhận sách mới vào thư viện (kiểm tra QĐ1).
   - Lập thẻ độc giả mới, gia hạn thẻ (kiểm tra QĐ2).
   - Lập phiếu mượn sách (kiểm tra điều kiện hợp lệ theo QĐ3).
   - Tiếp nhận trả sách, ghi nhận hư hỏng/mất và tính tiền phạt trễ hạn tự động (theo QĐ4).
   - Lập phiếu thu tiền phạt, in biên lai cho độc giả (theo QĐ5).
   - Tra cứu sách, in mã vạch và xuất danh sách ra file Excel.
   - Lập và xuất báo cáo mượn theo thể loại và báo cáo sách trả trễ (theo QĐ6).
3. **Độc giả (Reader / Sinh viên):**
   - Tra cứu trực tuyến thông tin sách (OPAC - Online Public Access Catalog), kiểm tra tình trạng còn/hết trong kho.
   - Xem thông tin thẻ thư viện cá nhân, lịch sử mượn trả, hạn trả của các sách đang mượn.
   - Tra cứu các khoản tiền phạt đã nộp và số tiền còn nợ.

---

### 3. Kiến Trúc Hệ Thống (Architectural Design)
Hệ thống được tổ chức theo kiến trúc **3-Tier / MVC (Model - View - Controller)** chuẩn mực của ngành Công nghệ Phần mềm:

```
[ Client Browser ]
        │ HTTP / HTML5 / AJAX
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION LAYER (Giao diện hiển thị)                  │
│    - EJS Templates (Server-Side Rendering)                 │
│    - Tailwind CSS, SweetAlert2, Chart.js, FontAwesome 6     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. APPLICATION / BUSINESS LOGIC LAYER (Nghiệp vụ cốt lõi)   │
│    - Express.js Router (Web routes & RESTful API routes)    │
│    - Middleware (Session Auth, RBAC Authorization Guard)    │
│    - Controllers (Xử lý request, chuẩn bị dữ liệu render)   │
│    - Services (Quy định QĐ1-QĐ5, tính tiền phạt, công nợ)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. DATA PERSISTENCE LAYER (Lưu trữ dữ liệu)                │
│    - SQLite 3 (Database file: data/library.db)             │
│    - better-sqlite3 driver (Tốc độ cao, ACID transactions)  │
│    - Database Indexes & Foreign Key Constraints             │
└─────────────────────────────────────────────────────────────┘
```

---

### 4. Công Nghệ Sử Dụng
| Thành phần | Công nghệ / Thư viện | Lý do lựa chọn |
|---|---|---|
| **Runtime** | Node.js (v18 - v26+) | Xử lý bất đồng bộ mạnh mẽ, hiện đại, đa nền tảng |
| **Framework** | Express.js 5.x | Chuẩn mực web service, kiến trúc route rõ ràng, hỗ trợ RESTful API |
| **Template Engine** | EJS (Embedded JavaScript) | Render trang nhanh, không phụ thuộc build tool phức tạp, dễ chấm điểm |
| **Giao diện UI** | Tailwind CSS + SweetAlert2 | Giao diện hiện đại, chuẩn Responsive trên PC và Mobile |
| **Biểu đồ** | Chart.js | Trực quan hóa dữ liệu mượn sách và báo cáo thống kê |
| **Database** | SQLite 3 (`better-sqlite3`) | Chạy tự động, lưu trực tiếp dạng tệp `library.db`, không cần cài đặt SQL Server/MySQL |
| **Bảo mật** | `bcryptjs` + `express-session` | Mã hóa mật khẩu bảo mật (Salt 10 vòng), quản lý phiên an toàn |
| **Xuất dữ liệu** | `xlsx` | Kết xuất danh sách sách, độc giả, phiếu mượn và báo cáo ra file Excel (.xlsx) |
| **Testing** | `Jest` + `Supertest` | Kiểm thử đơn vị (Unit Test) cho các Rule và kiểm thử API tự động |
