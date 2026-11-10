# BÁO CÁO KIỂM THỬ PHẦN MỀM (TEST CASES & TEST REPORT)
## MÔN THIẾT KẾ PHẦN MỀM (TKPM)

---

### 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ
- **Công cụ kiểm thử tự động:** Jest 29.x & Supertest 7.x
- **Tổng số ca kiểm thử (Test Cases):** 16 ca kiểm thử tự động
- **Số ca Passed:** 16 / 16 (Tỉ lệ đạt: **100%**)
- **Số ca Failed:** 0
- **Phạm vi kiểm thử:** Quy định nghiệp vụ QĐ1 -> QĐ5, Xử lý tính phạt, Ràng buộc dữ liệu, RESTful API.

---

### 2. MA TRẬN TEST CASES CHI TIẾT THEO QUY ĐỊNH (TEST MATRIX)

| Test Case ID | Chức năng kiểm thử | Tiền điều kiện | Các bước thực hiện | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| **TC_QD1_01** | Kiểm tra năm xuất bản hợp lệ (QĐ1) | Năm hiện tại $Y$ | Nhập sách xuất bản năm $Y - 3$ | Hệ thống chấp nhận tiếp nhận sách | Sách được tạo thành công | **PASS** |
| **TC_QD1_02** | Chặn sách xuất bản quá $N$ năm (QĐ1) | $N = 8$ năm | Nhập sách xuất bản năm $Y - 10$ | Báo lỗi vi phạm QĐ1, chặn lưu | Báo lỗi: *"QĐ1 vi phạm: Chỉ nhận sách trong vòng 8 năm"* | **PASS** |
| **TC_QD1_03** | Chặn năm xuất bản tương lai (QĐ1) | Năm hiện tại $Y$ | Nhập sách xuất bản năm $Y + 2$ | Báo lỗi năm xuất bản không hợp lệ | Từ chối tiếp nhận | **PASS** |
| **TC_QD2_01** | Kiểm tra tuổi độc giả hợp lệ (QĐ2) | Quy định 18 - 55 tuổi | Nhập độc giả 20 tuổi | Hệ thống cho phép cấp thẻ | Thẻ được tạo với hạn +6 tháng | **PASS** |
| **TC_QD2_02** | Chặn độc giả dưới 18 tuổi (QĐ2) | Quy định 18 - 55 tuổi | Nhập độc giả 15 tuổi | Báo lỗi vi phạm QĐ2 về độ tuổi | Báo lỗi: *"QĐ2 vi phạm: Tuổi độc giả phải từ 18 đến 55"* | **PASS** |
| **TC_QD2_03** | Chặn độc giả trên 55 tuổi (QĐ2) | Quy định 18 - 55 tuổi | Nhập độc giả 60 tuổi | Báo lỗi vi phạm QĐ2 về độ tuổi | Báo lỗi: *"QĐ2 vi phạm: Tuổi độc giả phải từ 18 đến 55"* | **PASS** |
| **TC_QD2_04** | Tính ngày hết hạn thẻ độc giả (QĐ2) | Ngày cấp: 01/01/2026 | Tạo thẻ với thời hạn $M = 6$ tháng | Hạn dùng là 01/07/2026 | Hạn dùng chính xác 01/07/2026 | **PASS** |
| **TC_QD3_01** | Chặn mượn sách khi thẻ hết hạn (QĐ3) | Độc giả có thẻ hết hạn | Chọn mượn 1 cuốn sách | Báo lỗi thẻ hết hạn, chặn mượn | Báo lỗi thẻ hết hạn | **PASS** |
| **TC_QD3_02** | Chặn mượn sách khi có sách quá hạn (QĐ3) | Độc giả đang giữ sách trễ | Chọn mượn 1 cuốn sách mới | Báo lỗi yêu cầu trả sách quá hạn | Báo lỗi đang có sách quá hạn | **PASS** |
| **TC_QD3_03** | Chặn mượn vượt quá $K$ cuốn (QĐ3) | Đang mượn 4 cuốn, $K = 5$ | Chọn mượn thêm 2 cuốn sách | Báo lỗi vượt quá số lượng tối đa 5 cuốn | Báo lỗi vượt quá hạn mức | **PASS** |
| **TC_QD4_01** | Trả sách đúng hạn (QĐ4) | Hạn trả: 20/05, Trả: 18/05 | Thực hiện trả sách đúng hạn | Số ngày trễ: 0, Tiền phạt: 0 VNĐ | Tiền phạt: 0 VNĐ | **PASS** |
| **TC_QD4_02** | Tính tiền phạt trả sách trễ hạn (QĐ4) | Hạn trả: 10/05, Trả: 15/05 | Thực hiện trả sách trễ 5 ngày | Phạt = $5 \times 1.000 = 5.000$ VNĐ | Phạt đúng 5.000 VNĐ | **PASS** |
| **TC_QD5_01** | Chặn thu tiền vượt quá nợ (QĐ5) | Độc giả nợ 15.000 VNĐ | Nhập số tiền thu: 20.000 VNĐ | Báo lỗi QĐ5: Tiền thu vượt quá nợ | Báo lỗi: *"QĐ5 vi phạm: Số tiền thu không vượt quá nợ"* | **PASS** |
| **TC_QD5_02** | Thu tiền phạt hợp lệ (QĐ5) | Độc giả nợ 15.000 VNĐ | Nhập số tiền thu: 10.000 VNĐ | Thu thành công, nợ còn lại 5.000 VNĐ | Lập phiếu thu thành công, nợ còn 5.000 VNĐ | **PASS** |
| **TC_API_01** | API Danh sách sách | Server đang chạy | Gọi `GET /api/books` | Trả về JSON danh sách kèm count | Trả về 200 OK kèm danh sách sách | **PASS** |
| **TC_API_02** | API Cấu hình quy định | Server đang chạy | Gọi `GET /api/rules` | Trả về danh sách các tham số QĐ | Trả về 200 OK với đầy đủ key quy định | **PASS** |

---

### 3. LỆNH CHẠY KIỂM THỬ ĐỘC LẬP
Để kiểm tra lại toàn bộ kết quả kiểm thử trên máy, thực hiện lệnh:
```bash
npm test
```
Toàn bộ 16 test cases sẽ được thực thi tự động và xuất báo cáo trực quan ra màn hình terminal.
