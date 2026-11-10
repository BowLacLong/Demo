# ĐẶC TẢ CHI TIẾT CÁC QUY ĐỊNH NGHIỆP VỤ (QĐ1 - QĐ6)
## MÔN THIẾT KẾ PHẦN MỀM (TKPM)

---

### TỔNG HỢP BẢNG THAM SỐ QUY ĐỊNH (SYSTEM PARAMETERS)
Các thông số quy định được quản lý động trong bảng `system_parameters` của cơ sở dữ liệu và có thể được Quản trị viên (Admin) thay đổi qua giao diện `/rules`:

| Mã tham số (Key) | Tên quy định | Giá trị mặc định | Đơn vị | Áp dụng tại |
|---|---|---|---|---|
| `max_publish_years_gap` | Khoảng cách năm xuất bản tối đa | 8 | Năm | **QĐ1** (Tiếp nhận sách) |
| `min_reader_age` | Tuổi tối thiểu của độc giả | 18 | Tuổi | **QĐ2** (Lập thẻ độc giả) |
| `max_reader_age` | Tuổi tối đa của độc giả | 55 | Tuổi | **QĐ2** (Lập thẻ độc giả) |
| `card_valid_months` | Thời hạn giá trị của thẻ | 6 | Tháng | **QĐ2** (Lập thẻ độc giả) |
| `max_borrow_books` | Số sách mượn tối đa cùng lúc | 5 | Cuốn | **QĐ3** (Cho mượn sách) |
| `max_borrow_days` | Số ngày mượn tối đa cho mỗi lần mượn | 14 | Ngày | **QĐ3** (Cho mượn sách) |
| `prevent_borrow_if_overdue` | Chặn mượn sách nếu có nợ sách quá hạn | 1 (Bật) | Boolean | **QĐ3** (Cho mượn sách) |
| `fine_per_day` | Tiền phạt cho mỗi ngày trả trễ | 1.000 | VNĐ/ngày | **QĐ4** (Nhận trả sách) |

---

### QUY ĐỊNH 1 (QĐ1) - TIẾP NHẬN SÁCH MỚI
1. **Nội dung:**
   - Khi tiếp nhận một đầu sách mới vào thư viện, chỉ tiếp nhận những sách được xuất bản trong vòng $N$ năm gần nhất tính từ năm hiện tại.
   - Thể loại của sách phải thuộc danh mục các thể loại hợp lệ đã được quy định trong hệ thống (A, B, C, D, E, F,...).
   - Trị giá sách phải là một số nguyên dương (> 0 VNĐ).
2. **Công thức kiểm tra:**
   $$\text{Năm Hiện Tại} - \text{Năm Xuất Bản} \le \text{max\_publish\_years\_gap}$$
   $$\text{Năm Xuất Bản} \le \text{Năm Hiện Tại}$$
3. **Xử lý vi phạm:**
   - Nếu $\text{Năm Xuất Bản} < \text{Năm Hiện Tại} - N$: Hệ thống hiển thị thông báo lỗi: *"QĐ1 vi phạm: Chỉ nhận sách xuất bản trong vòng N năm gần nhất"*, giao dịch tiếp nhận bị hủy bỏ.
   - Nếu $\text{Năm Xuất Bản} > \text{Năm Hiện Tại}$: Báo lỗi năm xuất bản không hợp lệ.

---

### QUY ĐỊNH 2 (QĐ2) - LẬP THẺ ĐỘC GIẢ
1. **Nội dung:**
   - Tuổi của độc giả tại thời điểm lập thẻ phải nằm trong khoảng $[\text{Tuổi\_Tối\_Thiểu}, \text{Tuổi\_Tối\_Đa}]$.
   - Thời hạn sử dụng của thẻ độc giả có giá trị trong vòng $M$ tháng tính từ ngày lập thẻ.
   - Độc giả phải thuộc các loại độc giả quy định (X, Y, Z,...).
2. **Công thức kiểm tra:**
   $$\text{Tuổi} = \text{Năm Hiện Tại} - \text{Năm Sinh}$$
   $$\text{min\_reader\_age} \le \text{Tuổi} \le \text{max\_reader\_age}$$
   $$\text{Ngày Hết Hạn} = \text{Ngày Lập Thẻ} + \text{card\_valid\_months}$$
3. **Xử lý vi phạm:**
   - Nếu $\text{Tuổi} < \text{min\_reader\_age}$ hoặc $\text{Tuổi} > \text{max\_reader\_age}$: Báo lỗi *"QĐ2 vi phạm: Tuổi độc giả phải từ 18 đến 55 tuổi"*, nút tạo thẻ bị vô hiệu hóa.

---

### QUY ĐỊNH 3 (QĐ3) - CHO MƯỢN SÁCH
1. **Nội dung:**
   - Độc giả chỉ được phép mượn sách khi:
     - Thẻ độc giả còn trong thời hạn giá trị ($\text{Hạn Thẻ} \ge \text{Ngày Hiện Tại}$) và trạng thái thẻ đang hoạt động.
     - Độc giả không giữ cuốn sách nào đã bị quá hạn trả (nếu tham số `prevent_borrow_if_overdue` đang bật).
     - Tổng số sách đang mượn cộng với số sách muốn mượn thêm không vượt quá số lượng tối đa $K$ cuốn ($\le \text{max\_borrow\_books}$).
   - Bản sách cá biệt muốn mượn phải ở trạng thái "Có sẵn" (`available`).
   - Thời hạn mượn cho mỗi lần mượn là tối đa $D$ ngày ($\text{Hạn Trả} = \text{Ngày Mượn} + \text{max\_borrow\_days}$).
2. **Xử lý vi phạm:**
   - Thẻ hết hạn: Yêu cầu gia hạn thẻ trước khi mượn.
   - Đang có sách quá hạn: Bắt buộc hoàn trả sách quá hạn và thanh toán tiền phạt trước khi được mượn tiếp.
   - Vượt quá số lượng mượn: Chặn không cho chọn thêm sách quá hạn mức.

---

### QUY ĐỊNH 4 (QĐ4) - NHẬN TRẢ SÁCH & TÍNH TIỀN PHẠT
1. **Nội dung:**
   - Khi độc giả trả sách, hệ thống đối chiếu ngày trả thực tế với hạn hẹn trả trên phiếu mượn.
   - Nếu trả trễ hạn, hệ thống tự động tính số ngày trễ và phát sinh tiền phạt theo đơn giá quy định $P$ VNĐ/ngày cho mỗi cuốn sách trả trễ.
   - Nếu sách bị hư hại hoặc làm mất, tiền bồi thường sẽ được tính theo trị giá sách hoặc tỷ lệ hư hại quy định.
   - Toàn bộ số tiền phạt sẽ được tự động cộng dồn vào tổng tiền nợ (`total_debt`) của độc giả.
2. **Công thức tính:**
   $$\text{Số Ngày Trễ} = \max(0, \text{Ngày Thực Trả} - \text{Hạn Trả})$$
   $$\text{Tiền Phạt Trễ} = \text{Số Ngày Trễ} \times \text{fine\_per\_day}$$
   $$\text{Tổng Nợ Mới} = \text{Tổng Nợ Cũ} + \text{Tiền Phạt Trễ} + \text{Phí Hư Hỏng / Mất}$$

---

### QUY ĐỊNH 5 (QĐ5) - THU TIỀN PHẠT
1. **Nội dung:**
   - Khi độc giả nộp tiền phạt, thủ thư lập Phiếu Thu Tiền Phạt.
   - **Quy tắc bắt buộc:** Số tiền thu không được phép vượt quá tổng số tiền mà độc giả đang nợ thư viện.
   - Sau khi thu tiền, hệ thống trừ trực tiếp số tiền đã thu vào công nợ của độc giả.
2. **Công thức kiểm tra:**
   $$0 < \text{Số Tiền Thu} \le \text{Tổng Nợ Của Độc Giả}$$
   $$\text{Nợ Còn Lại} = \text{Tổng Nợ} - \text{Số Tiền Thu}$$
3. **Xử lý vi phạm:**
   - Nếu $\text{Số Tiền Thu} > \text{Tổng Nợ}$: Hệ thống cảnh báo đỏ và ngăn chặn lưu phiếu: *"QĐ5 vi phạm: Số tiền thu không được vượt quá số tiền độc giả đang nợ"*.

---

### QUY ĐỊNH 6 (QĐ6) - BÁO CÁO & THỐNG KÊ
Hệ thống cung cấp 2 biểu mẫu báo cáo chuẩn theo yêu cầu đồ án:
1. **Báo cáo 6.1 - Báo cáo mượn sách theo thể loại theo tháng:**
   - Tham số đầu vào: Tháng ($M$), Năm ($Y$).
   - Thông tin kết xuất: STT, Mã thể loại, Tên thể loại sách, Số lượt mượn, Tỉ lệ phần trăm mượn (%), Tổng số lượt mượn trong tháng.
   - Đồ thị trực quan dạng Doughnut Chart và hỗ trợ xuất file Excel.
2. **Báo cáo 6.2 - Báo cáo thống kê sách trả trễ:**
   - Tham số đầu vào: Ngày thống kê ($D$).
   - Thông tin kết xuất: STT, Mã phiếu mượn, Tên sách, Mã vạch cá biệt, Ngày mượn, Hạn trả, Số ngày trả trễ, Tên độc giả, Số điện thoại liên hệ.
   - Hỗ trợ xuất file Excel phục vụ công tác đốc thúc thu hồi sách.
