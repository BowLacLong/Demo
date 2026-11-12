const db = require('../config/db');

class RuleService {
  /**
   * Lấy toàn bộ danh sách tham số quy định
   */
  getAllRules() {
    return db.prepare('SELECT * FROM system_parameters ORDER BY key ASC').all();
  }

  /**
   * Lấy map các tham số dưới dạng Object { key: parsed_value }
   */
  getRulesMap() {
    const rows = this.getAllRules();
    const map = {};
    for (const r of rows) {
      if (r.data_type === 'number') {
        map[r.key] = Number(r.value);
      } else if (r.data_type === 'boolean') {
        map[r.key] = r.value === '1' || r.value === 'true';
      } else {
        map[r.key] = r.value;
      }
    }
    return map;
  }

  /**
   * Lấy giá trị của một tham số cụ thể
   */
  getRule(key, defaultValue = null) {
    const row = db.prepare('SELECT value, data_type FROM system_parameters WHERE key = ?').get(key);
    if (!row) return defaultValue;
    if (row.data_type === 'number') return Number(row.value);
    if (row.data_type === 'boolean') return row.value === '1' || row.value === 'true';
    return row.value;
  }

  /**
   * Cập nhật giá trị quy định (Dành cho Admin)
   */
  updateRule(key, value) {
    const stmt = db.prepare(`
      UPDATE system_parameters 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE key = ?
    `);
    const info = stmt.run(String(value), key);
    return info.changes > 0;
  }

  /**
   * Cập nhật nhiều quy định cùng lúc
   */
  updateManyRules(rulesObj) {
    const updateStmt = db.prepare(`
      UPDATE system_parameters 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE key = ?
    `);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(rulesObj)) {
        updateStmt.run(String(v), k);
      }
    });
    tx();
    return true;
  }

  /**
   * [Quy định 1 - ] Kiểm tra năm xuất bản sách khi tiếp nhận
   * "Chỉ nhận các sách xuất bản trong vòng N năm"
   */
  validateBookEntry(publishYear) {
    const maxGap = this.getRule('max_publish_years_gap', 8);
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - Number(publishYear);

    if (yearDiff < 0) {
      return { valid: false, message: `Năm xuất bản (${publishYear}) không được lớn hơn năm hiện tại (${currentYear}).` };
    }
    if (yearDiff > maxGap) {
      return { 
        valid: false, 
        message: `Quy định: Chỉ nhận sách xuất bản trong vòng ${maxGap} năm gần nhất (từ năm ${currentYear - maxGap} trở lại). Sách này năm ${publishYear} (cách ${yearDiff} năm).` 
      };
    }
    return { valid: true };
  }

  /**
   * [Quy định 2 - ] Kiểm tra tuổi độc giả khi lập thẻ
   * "Tuổi của độc giả phải từ Tuổi_Tối_Thiểu đến Tuổi_Tối_Đa"
   */
  validateReaderAge(dateOfBirth) {
    const minAge = this.getRule('min_reader_age', 18);
    const maxAge = this.getRule('max_reader_age', 55);

    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < minAge || age > maxAge) {
      return {
        valid: false,
        age,
        message: `Quy định: Tuổi độc giả phải từ ${minAge} đến ${maxAge} tuổi. Hiện tại độc giả ${age} tuổi.`
      };
    }
    return { valid: true, age };
  }

  /**
   * Tính ngày hết hạn thẻ dựa trên ngày cấp theo quy định (thời hạn M tháng)
   */
  calculateExpiryDate(createdDateStr) {
    const validMonths = this.getRule('card_valid_months', 6);
    const createdDate = createdDateStr ? new Date(createdDateStr) : new Date();
    const expiry = new Date(createdDate);
    expiry.setMonth(expiry.getMonth() + validMonths);
    return expiry.toISOString().split('T')[0];
  }

  /**
   * [Quy định 3 - ] Kiểm tra điều kiện mượn sách
   * - Thẻ độc giả còn hạn
   * - Không giữ sách quá hạn (nếu bật cấu hình)
   * - Tổng số sách đang mượn + sách mượn mới không vượt quá K cuốn
   */
  validateBorrowEligibility(readerId, newBooksCount = 1) {
    const rules = this.getRulesMap();
    const reader = db.prepare('SELECT * FROM readers WHERE id = ?').get(readerId);
    if (!reader) {
      return { valid: false, message: 'Không tìm thấy thông tin độc giả.' };
    }

    // 1. Kiểm tra hạn sử dụng thẻ độc giả
    const todayStr = new Date().toISOString().split('T')[0];
    if (reader.expiry_date < todayStr || reader.status !== 'active') {
      return { 
        valid: false, 
        message: `Quy định: Thẻ độc giả đã hết hạn vào ngày ${reader.expiry_date} hoặc đang bị khóa. Vui lòng gia hạn thẻ trước khi mượn.` 
      };
    }

    // 2. Kiểm tra sách quá hạn chưa trả
    if (rules.prevent_borrow_if_overdue) {
      const overdueCheck = db.prepare(`
        SELECT COUNT(*) as count 
        FROM borrow_tickets bt
        JOIN borrow_details bd ON bt.id = bd.ticket_id
        WHERE bt.reader_id = ? 
          AND bd.status = 'borrowed' 
          AND bt.due_date < ?
      `).get(readerId, todayStr);

      if (overdueCheck.count > 0) {
        return {
          valid: false,
          message: `Quy định: Độc giả hiện đang có ${overdueCheck.count} cuốn sách quá hạn chưa trả. Cần hoàn trả sách và thanh toán phạt trước khi mượn sách mới!`
        };
      }
    }

    // 3. Kiểm tra số lượng sách đang mượn
    const currentBorrowing = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrow_tickets bt
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      WHERE bt.reader_id = ? AND bd.status = 'borrowed'
    `).get(readerId).count;

    const maxBooks = rules.max_borrow_books || 5;
    if (currentBorrowing + newBooksCount > maxBooks) {
      return {
        valid: false,
        currentBorrowing,
        maxBooks,
        message: `Quy định: Độc giả chỉ được mượn tối đa ${maxBooks} cuốn. Hiện đang mượn ${currentBorrowing} cuốn, không thể mượn thêm ${newBooksCount} cuốn.`
      };
    }

    return { 
      valid: true, 
      currentBorrowing, 
      maxBorrowDays: rules.max_borrow_days || 14 
    };
  }

  /**
   * [Quy định 4 - ] Tính tiền phạt khi trả sách trễ hạn
   * "Tiền phạt = Số ngày trễ * Tiền phạt mỗi ngày"
   */
  calculateFine(dueDateStr, returnDateStr = null) {
    const returnDate = returnDateStr ? new Date(returnDateStr) : new Date();
    const dueDate = new Date(dueDateStr);
    
    // Normalize to date boundary
    returnDate.setHours(0,0,0,0);
    dueDate.setHours(0,0,0,0);

    const diffTime = returnDate.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const finePerDay = this.getRule('fine_per_day', 1000);
    const fineAmount = overdueDays * finePerDay;

    return {
      overdueDays,
      finePerDay,
      fineAmount
    };
  }

  /**
   * [Quy định 5 - ] Kiểm tra số tiền thu tiền phạt
   * "Số tiền thu không được vượt quá số tiền độc giả đang nợ"
   */
  validateFineCollection(readerId, collectedAmount) {
    const reader = db.prepare('SELECT total_debt, fullname FROM readers WHERE id = ?').get(readerId);
    if (!reader) {
      return { valid: false, message: 'Độc giả không tồn tại.' };
    }

    const amount = Number(collectedAmount);
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, message: 'Số tiền thu phải lớn hơn 0 VNĐ.' };
    }

    if (amount > reader.total_debt) {
      return {
        valid: false,
        totalDebt: reader.total_debt,
        collectedAmount: amount,
        message: `Quy định: Số tiền thu (${amount.toLocaleString('vi-VN')} VNĐ) không được vượt quá tổng nợ hiện tại của độc giả (${reader.total_debt.toLocaleString('vi-VN')} VNĐ).`
      };
    }

    return {
      valid: true,
      totalDebt: reader.total_debt,
      collectedAmount: amount,
      remainingDebt: reader.total_debt - amount
    };
  }
}

module.exports = new RuleService();
