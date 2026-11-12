const db = require('../config/db');

class ReservationService {
  getAllReservations({ status = '', readerId = '' } = {}) {
    let sql = `
      SELECT br.*, 
             b.title as book_title, b.cover_image, b.available_copies, b.total_copies,
             c.name as category_name,
             r.fullname as reader_name, r.reader_code, r.phone as reader_phone, r.email as reader_email
      FROM book_reservations br
      JOIN books b ON br.book_id = b.id
      JOIN categories c ON b.category_id = c.id
      JOIN readers r ON br.reader_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND br.status = ?';
      params.push(status);
    }

    if (readerId) {
      sql += ' AND br.reader_id = ?';
      params.push(readerId);
    }

    sql += ' ORDER BY br.id DESC';
    return db.prepare(sql).all(...params);
  }

  getReservationById(id) {
    return db.prepare(`
      SELECT br.*, 
             b.title as book_title, b.cover_image,
             r.fullname as reader_name, r.reader_code, r.phone as reader_phone
      FROM book_reservations br
      JOIN books b ON br.book_id = b.id
      JOIN readers r ON br.reader_id = r.id
      WHERE br.id = ?
    `).get(id);
  }

  createReservation(readerId, bookId, note = '') {
    const reader = db.prepare('SELECT * FROM readers WHERE id = ?').get(readerId);
    if (!reader) throw new Error('Không tìm thấy thông tin độc giả.');

    const todayStr = new Date().toISOString().split('T')[0];
    if (reader.expiry_date < todayStr || reader.status !== 'active') {
      throw new Error('Thẻ độc giả của bạn đã hết hạn hoặc bị tạm ngưng, không thể đặt sách online.');
    }

    // Check if reader already has pending reservation for this book
    const existing = db.prepare(`
      SELECT id FROM book_reservations 
      WHERE reader_id = ? AND book_id = ? AND status IN ('pending', 'approved')
    `).get(readerId, bookId);

    if (existing) {
      throw new Error('Bạn đã có một yêu cầu đặt trước cho cuốn sách này đang chờ xử lý.');
    }

    const stmt = db.prepare(`
      INSERT INTO book_reservations (reader_id, book_id, status, note)
      VALUES (?, ?, 'pending', ?)
    `);

    const res = stmt.run(readerId, bookId, note);
    return this.getReservationById(res.lastInsertRowid);
  }

  updateStatus(id, newStatus) {
    const allowed = ['pending', 'approved', 'fulfilled', 'cancelled'];
    if (!allowed.includes(newStatus)) {
      throw new Error('Trạng thái không hợp lệ.');
    }

    const stmt = db.prepare('UPDATE book_reservations SET status = ? WHERE id = ?');
    stmt.run(newStatus, id);
    return this.getReservationById(id);
  }
}

module.exports = new ReservationService;
