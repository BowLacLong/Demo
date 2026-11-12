const { getDb } = require('../config/db');

class RuleService {
  /**
   * Lấy toàn bộ danh sách tham số quy định
   */
  async getAllRules() {
    const db = await getDb();
    return db.collection('system_parameters').find({}).sort({ key: 1 }).toArray();
  }

  /**
   * Lấy map các tham số dưới dạng Object { key: parsed_value }
   */
  async getRulesMap() {
    const rows = await this.getAllRules();
    return this.toRuleMap(rows);
  }

  toRuleMap(rows) {
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
  async getRule(key, defaultValue = null) {
    const db = await getDb();
    const row = await db.collection('system_parameters').findOne({ key });
    if (!row) return defaultValue;
    if (row.data_type === 'number') return Number(row.value);
    if (row.data_type === 'boolean') return row.value === '1' || row.value === 'true';
    return row.value;
  }

  /**
   * Cập nhật giá trị quy định (Dành cho Admin)
   */
  async updateRule(key, value) {
    const db = await getDb();
    const result = await db.collection('system_parameters').updateOne(
      { key },
      { $set: { value: String(value), updated_at: new Date() } }
    );
    return result.matchedCount > 0;
  }

  /**
   * Cập nhật nhiều quy định cùng lúc
   */
  async updateManyRules(rulesObj) {
    const entries = Object.entries(rulesObj || {});
    if (entries.length === 0) return true;

    const db = await getDb();
    await db.collection('system_parameters').bulkWrite(
      entries.map(([key, value]) => ({
        updateOne: {
          filter: { key },
          update: { $set: { value: String(value), updated_at: new Date() } }
        }
      }))
    );
    return true;
  }

  /**
   * [Quy định 1] Kiểm tra năm xuất bản sách khi tiếp nhận
   * "Chỉ nhận các sách xuất bản trong vòng N năm"
   */
  async validateBookEntry(publishYear) {
    const maxGap = await this.getRule('max_publish_years_gap', 8);
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
   * [Quy định 2] Kiểm tra tuổi độc giả khi lập thẻ
   * "Tuổi của độc giả phải từ Tuổi_Tối_Thiểu đến Tuổi_Tối_Đa"
   */
  async validateReaderAge(dateOfBirth) {
    const minAge = await this.getRule('min_reader_age', 18);
    const maxAge = await this.getRule('max_reader_age', 55);

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
  async calculateExpiryDate(createdDateStr) {
    const validMonths = await this.getRule('card_valid_months', 6);
    const createdDate = createdDateStr ? new Date(createdDateStr) : new Date();
    const expiry = new Date(createdDate);
    expiry.setMonth(expiry.getMonth() + Number(validMonths));
    return expiry.toISOString().split('T')[0];
  }

  /**
   * [Quy định 3] Kiểm tra điều kiện mượn sách
   * - Thẻ độc giả còn hạn
   * - Không giữ sách quá hạn (nếu bật cấu hình)
   * - Tổng số sách đang mượn + sách mượn mới không vượt quá K cuốn
   */
  async validateBorrowEligibility(readerId, newBooksCount = 1) {
    const db = await getDb();
    const rules = await this.getRulesMap();

    const reader = await db.collection('readers').findOne({ id: Number(readerId) });
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

    // Lấy toàn bộ chi tiết đang mượn của độc giả kèm hạn trả của phiếu
    const tickets = await db.collection('borrow_tickets')
      .find({ reader_id: Number(readerId) })
      .project({ id: 1, due_date: 1 })
      .toArray();
    const ticketDueMap = new Map(tickets.map(t => [t.id, t.due_date]));
    const ticketIds = tickets.map(t => t.id);

    const borrowedDetails = ticketIds.length
      ? await db.collection('borrow_details')
        .find({ ticket_id: { $in: ticketIds }, status: 'borrowed' })
        .toArray()
      : [];

    // 2. Kiểm tra sách quá hạn chưa trả
    if (rules.prevent_borrow_if_overdue) {
      const overdueCount = borrowedDetails.filter(d => {
        const due = ticketDueMap.get(d.ticket_id);
        return due && due < todayStr;
      }).length;

      if (overdueCount > 0) {
        return {
          valid: false,
          message: `Quy định: Độc giả hiện đang có ${overdueCount} cuốn sách quá hạn chưa trả. Cần hoàn trả sách và thanh toán phạt trước khi mượn sách mới!`
        };
      }
    }

    // 3. Kiểm tra số lượng sách đang mượn
    const currentBorrowing = borrowedDetails.length;
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
   * [Quy định 4] Tính tiền phạt khi trả sách trễ hạn
   * "Tiền phạt = Số ngày trễ * Tiền phạt mỗi ngày"
   */
  async calculateFine(dueDateStr, returnDateStr = null) {
    const returnDate = returnDateStr ? new Date(returnDateStr) : new Date();
    const dueDate = new Date(dueDateStr);

    returnDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = returnDate.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const finePerDay = await this.getRule('fine_per_day', 1000);
    const fineAmount = overdueDays * finePerDay;

    return {
      overdueDays,
      finePerDay,
      fineAmount
    };
  }

  /**
   * [Quy định 5] Kiểm tra số tiền thu tiền phạt
   * "Số tiền thu không được vượt quá số tiền độc giả đang nợ"
   */
  async validateFineCollection(readerId, collectedAmount) {
    const db = await getDb();
    const reader = await db.collection('readers').findOne({ id: Number(readerId) });
    if (!reader) {
      return { valid: false, message: 'Độc giả không tồn tại.' };
    }

    const amount = Number(collectedAmount);
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, message: 'Số tiền thu phải lớn hơn 0 VNĐ.' };
    }

    const totalDebt = Number(reader.total_debt) || 0;
    if (amount > totalDebt) {
      return {
        valid: false,
        totalDebt,
        collectedAmount: amount,
        message: `Quy định: Số tiền thu (${amount.toLocaleString('vi-VN')} VNĐ) không được vượt quá tổng nợ hiện tại của độc giả (${totalDebt.toLocaleString('vi-VN')} VNĐ).`
      };
    }

    return {
      valid: true,
      totalDebt,
      collectedAmount: amount,
      remainingDebt: totalDebt - amount
    };
  }
}

module.exports = new RuleService();
