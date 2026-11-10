# ĐẶC TẢ GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (RESTFUL API SPECIFICATION)
## MÔN THIẾT KẾ PHẦN MỀM (TKPM)

---

### TỔNG QUAN VỀ RESTFUL API
Hệ thống cung cấp đầy đủ các API RESTful theo chuẩn JSON, hỗ trợ tích hợp mở rộng với ứng dụng di động hoặc cổng thông tin tra cứu bên thứ ba.
- **Base URL:** `http://localhost:3000/api`
- **Content-Type:** `application/json`

---

### 1. QUẢN LÝ SÁCH (`/api/books`)

#### 1.1 Lấy danh sách sách & tra cứu (OPAC)
- **Method:** `GET`
- **Endpoint:** `/api/books`
- **Query Parameters:**
  - `search` (string): Tìm kiếm theo tên sách, ISBN, tác giả.
  - `categoryId` (int): Lọc theo ID thể loại sách.
  - `availableOnly` (boolean): `true` nếu chỉ lấy sách còn sẵn trong kho.
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": 1,
      "title": "Clean Code - Mã Sạch Trong Lập Trình",
      "category_id": 1,
      "category_name": "Công nghệ Thông tin & Lập trình",
      "category_code": "A",
      "author_name": "Robert C. Martin (Uncle Bob)",
      "publisher_name": "NXB Thông tin và Truyền thông",
      "publish_year": 2022,
      "price": 185000,
      "total_copies": 4,
      "available_copies": 3
    }
  ]
}
```

#### 1.2 Xem chi tiết một cuốn sách
- **Method:** `GET`
- **Endpoint:** `/api/books/:id`
- **Response `200 OK`:** Trả về thông tin chi tiết đầu sách kèm danh sách mã vạch bản sách cá biệt (`copies`).

#### 1.3 Tiếp nhận sách mới (QĐ1)
- **Method:** `POST`
- **Endpoint:** `/api/books`
- **Request Body:**
```json
{
  "title": "Lập Trình Web Fullstack",
  "category_id": 1,
  "author_id": 1,
  "publisher_id": 1,
  "publish_year": 2024,
  "price": 120000,
  "initial_copies": 3,
  "location": "Kệ 1 - Ngăn 1"
}
```
- **Response `201 Created`:** Sách và các bản sách cá biệt được tạo thành công.
- **Response `400 Bad Request`:** Báo lỗi nếu vi phạm QĐ1 (năm xuất bản quá 8 năm).

---

### 2. QUẢN LÝ ĐỘC GIẢ (`/api/readers`)

#### 2.1 Lấy danh sách độc giả
- **Method:** `GET`
- **Endpoint:** `/api/readers`
- **Query Parameters:** `search`, `typeId`, `status`.

#### 2.2 Lập thẻ độc giả mới (QĐ2)
- **Method:** `POST`
- **Endpoint:** `/api/readers`
- **Request Body:**
```json
{
  "fullname": "Lê Văn C",
  "date_of_birth": "2004-03-15",
  "reader_type_id": 1,
  "address": "Thủ Đức, TP.HCM",
  "email": "levanc@student.edu.vn",
  "phone": "0909112233"
}
```
- **Response `201 Created`:** Thẻ độc giả được tạo với mã tự động `DGxxxx` và hạn thẻ +6 tháng.
- **Response `400 Bad Request`:** Báo lỗi nếu vi phạm QĐ2 (độ tuổi không thuộc khoảng 18 - 55 tuổi).

---

### 3. QUẢN LÝ MƯỢN - TRẢ (`/api/borrow`)

#### 3.1 Lập phiếu mượn sách (QĐ3)
- **Method:** `POST`
- **Endpoint:** `/api/borrow`
- **Request Body:**
```json
{
  "readerId": 1,
  "copyIds": [1, 2],
  "borrowDate": "2026-11-10",
  "note": "Mượn phục vụ đồ án cuối kỳ"
}
```
- **Response `201 Created`:** Trả về phiếu mượn được lập và cập nhật trạng thái bản sách sang `borrowed`.
- **Response `400 Bad Request`:** Lỗi nếu thẻ hết hạn, độc giả đang nợ sách quá hạn, hoặc tổng số sách vượt quá 5 cuốn (QĐ3).

#### 3.2 Nhận trả sách & tính tiền phạt (QĐ4)
- **Method:** `POST`
- **Endpoint:** `/api/borrow/:id/return`
- **Request Body:**
```json
{
  "return_date": "2026-11-25",
  "items": [
    {
      "detailId": 1,
      "status": "returned",
      "damageFee": 0,
      "damageNote": ""
    }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalFineAdded": 5000,
    "overdueDays": 5
  }
}
```

---

### 4. THU TIỀN PHẠT (`/api/fines`)

#### 4.1 Lập phiếu thu tiền phạt (QĐ5)
- **Method:** `POST`
- **Endpoint:** `/api/fines`
- **Request Body:**
```json
{
  "readerId": 2,
  "collectedAmount": 10000,
  "note": "Nộp tiền phạt quá hạn 10 ngày"
}
```
- **Response `201 Created`:** Trả về phiếu thu `PTxxxx` và trừ tiền nợ của độc giả.
- **Response `400 Bad Request`:** Lỗi nếu số tiền thu lớn hơn tổng tiền nợ hiện tại (QĐ5).

---

### 5. CẤU HÌNH QUY ĐỊNH & THỐNG KÊ (`/api/rules`, `/api/stats`)
- `GET /api/rules`: Lấy toàn bộ tham số quy định hệ thống.
- `PUT /api/rules`: Cập nhật giá trị quy định (Admin).
- `GET /api/stats`: Lấy thống kê tổng quan (Dashboard counters).
- `GET /api/reports/categories?month=11&year=2026`: Báo cáo mượn theo thể loại (QĐ6.1).
- `GET /api/reports/overdue?date=2026-11-10`: Báo cáo sách quá hạn (QĐ6.2).
