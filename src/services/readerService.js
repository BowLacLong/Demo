const db = require('../config/db');
const ruleService = require('./ruleService');

class ReaderService {
  getAllReaders({ search = '', typeId = '', status = '', limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT r.*, rt.name as type_name, rt.code as type_code, rt.max_borrow_limit,
             (SELECT COUNT(*) FROM borrow_tickets bt JOIN borrow_details bd ON bt.id = bd.ticket_id WHERE bt.reader_id = r.id AND bd.status = 'borrowed') as currently_borrowing
      FROM readers r
      JOIN reader_types rt ON r.reader_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      sql += ` AND (r.fullname LIKE ? OR r.reader_code LIKE ? OR r.email LIKE ? OR r.phone LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (typeId) {
      sql += ` AND r.reader_type_id = ?`;
      params.push(typeId);
    }

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  getReaderById(id) {
    const reader = db.prepare(`
      SELECT r.*, rt.name as type_name, rt.code as type_code, rt.max_borrow_limit,
             (SELECT COUNT(*) FROM borrow_tickets bt JOIN borrow_details bd ON bt.id = bd.ticket_id WHERE bt.reader_id = r.id AND bd.status = 'borrowed') as currently_borrowing
      FROM readers r
      JOIN reader_types rt ON r.reader_type_id = rt.id
      WHERE r.id = ?
    `).get(id);

    if (!reader) return null;

    // Check overdue books
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrow_tickets bt
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      WHERE bt.reader_id = ? AND bd.status = 'borrowed' AND bt.due_date < ?
    `).get(id, todayStr).count;

    reader.overdue_books_count = overdueCount;
    return reader;
  }

  getReaderByCode(code) {
    return db.prepare('SELECT id FROM readers WHERE reader_code = ?').get(code);
  }

  createReader(readerData) {
    // 1. Kiểm tra  về độ tuổi
    const ageCheck = ruleService.validateReaderAge(readerData.date_of_birth);
    if (!ageCheck.valid) {
      throw new Error(ageCheck.message);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const createdDate = readerData.created_date || todayStr;
    const expiryDate = readerData.expiry_date || ruleService.calculateExpiryDate(createdDate);

    // Auto-generate reader code: DG0001
    const lastId = db.prepare('SELECT MAX(id) as maxId FROM readers').get().maxId || 0;
    const readerCode = readerData.reader_code || `DG${String(lastId + 1).padStart(4, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO readers (reader_code, fullname, date_of_birth, reader_type_id, address, email, phone, created_date, expiry_date, total_debt, status, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)
    `);

    const res = stmt.run(
      readerCode,
      readerData.fullname.trim(),
      readerData.date_of_birth,
      readerData.reader_type_id,
      readerData.address.trim(),
      readerData.email.trim(),
      readerData.phone ? readerData.phone.trim() : null,
      createdDate,
      expiryDate,
      readerData.avatar || null
    );

    return this.getReaderById(res.lastInsertRowid);
  }

  updateReader(id, readerData) {
    if (readerData.date_of_birth) {
      const ageCheck = ruleService.validateReaderAge(readerData.date_of_birth);
      if (!ageCheck.valid) {
        throw new Error(ageCheck.message);
      }
    }

    const stmt = db.prepare(`
      UPDATE readers
      SET fullname = ?, date_of_birth = ?, reader_type_id = ?, 
          address = ?, email = ?, phone = ?, status = ?
      WHERE id = ?
    `);

    stmt.run(
      readerData.fullname.trim(),
      readerData.date_of_birth,
      readerData.reader_type_id,
      readerData.address.trim(),
      readerData.email.trim(),
      readerData.phone ? readerData.phone.trim() : null,
      readerData.status || 'active',
      id
    );

    return this.getReaderById(id);
  }

  extendCard(id, months = 6) {
    const reader = this.getReaderById(id);
    if (!reader) throw new Error('Không tìm thấy độc giả');

    const currentExpiry = new Date(reader.expiry_date);
    const now = new Date();
    // Gia hạn từ ngày hết hạn cũ nếu chưa qua, hoặc từ hôm nay nếu đã hết hạn
    const baseDate = currentExpiry > now ? currentExpiry : now;
    baseDate.setMonth(baseDate.getMonth() + Number(months));
    const newExpiry = baseDate.toISOString().split('T')[0];

    db.prepare('UPDATE readers SET expiry_date = ?, status = ? WHERE id = ?').run(newExpiry, 'active', id);
    return this.getReaderById(id);
  }

  deleteReader(id) {
    const activeBorrows = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrow_tickets bt
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      WHERE bt.reader_id = ? AND bd.status = 'borrowed'
    `).get(id).count;

    if (activeBorrows > 0) {
      throw new Error(`Độc giả này đang mượn ${activeBorrows} cuốn sách, không thể xoá thẻ thư viện!`);
    }

    const reader = this.getReaderById(id);
    if (reader && reader.total_debt > 0) {
      throw new Error(`Độc giả này đang nợ phạt ${reader.total_debt.toLocaleString('vi-VN')} VNĐ, phải thanh toán xong mới được xoá thẻ!`);
    }

    // Xoá user liên kết nếu có
    db.prepare('DELETE FROM users WHERE reader_id = ?').run(id);
    const res = db.prepare('DELETE FROM readers WHERE id = ?').run(id);
    return res.changes > 0;
  }

  getReaderHistory(readerId) {
    const tickets = db.prepare(`
      SELECT bt.*, u.fullname as creator_name
      FROM borrow_tickets bt
      LEFT JOIN users u ON bt.created_by = u.id
      WHERE bt.reader_id = ?
      ORDER BY bt.id DESC
    `).all(readerId);

    for (const t of tickets) {
      t.details = db.prepare(`
        SELECT bd.*, b.title as book_title, bc.barcode, b.cover_image
        FROM borrow_details bd
        JOIN book_copies bc ON bd.book_copy_id = bc.id
        JOIN books b ON bd.book_id = b.id
        WHERE bd.ticket_id = ?
      `).all(t.id);
    }

    const receipts = db.prepare(`
      SELECT fr.*, u.fullname as creator_name
      FROM fine_receipts fr
      LEFT JOIN users u ON fr.created_by = u.id
      WHERE fr.reader_id = ?
      ORDER BY fr.id DESC
    `).all(readerId);

    return { tickets, receipts };
  }

  getReaderTypes() {
    return db.prepare('SELECT * FROM reader_types ORDER BY id ASC').all();
  }
}

module.exports = new ReaderService();
