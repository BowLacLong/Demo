const db = require('../config/db');
const ruleService = require('./ruleService');

class FineService {
  getAllReceipts({ search = '', readerId = '', limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT fr.*, r.fullname as reader_name, r.reader_code, r.phone as reader_phone,
             u.fullname as creator_name
      FROM fine_receipts fr
      JOIN readers r ON fr.reader_id = r.id
      LEFT JOIN users u ON fr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      sql += ` AND (fr.receipt_code LIKE ? OR r.fullname LIKE ? OR r.reader_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (readerId) {
      sql += ` AND fr.reader_id = ?`;
      params.push(readerId);
    }

    sql += ` ORDER BY fr.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  getReceiptById(id) {
    return db.prepare(`
      SELECT fr.*, r.fullname as reader_name, r.reader_code, r.phone as reader_phone,
             r.email as reader_email, r.address as reader_address,
             u.fullname as creator_name
      FROM fine_receipts fr
      JOIN readers r ON fr.reader_id = r.id
      LEFT JOIN users u ON fr.created_by = u.id
      WHERE fr.id = ?
    `).get(id);
  }

  createReceipt({ readerId, collectedAmount, userId = null, note = '' }) {
    // 1. Kiểm tra QĐ5: Số tiền thu không được vượt quá số tiền độc giả đang nợ
    const validation = ruleService.validateFineCollection(readerId, collectedAmount);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const { totalDebt, collectedAmount: amount, remainingDebt } = validation;

    // Generate receipt code: PT0001
    const lastId = db.prepare('SELECT MAX(id) as maxId FROM fine_receipts').get().maxId || 0;
    const receiptCode = `PT${String(lastId + 1).padStart(4, '0')}`;

    const insertReceipt = db.prepare(`
      INSERT INTO fine_receipts (receipt_code, reader_id, total_debt, collected_amount, remaining_debt, created_by, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateReaderDebt = db.prepare('UPDATE readers SET total_debt = ? WHERE id = ?');

    let newReceiptId;
    const tx = db.transaction(() => {
      const res = insertReceipt.run(
        receiptCode,
        readerId,
        totalDebt,
        amount,
        remainingDebt,
        userId,
        note
      );
      newReceiptId = res.lastInsertRowid;
      updateReaderDebt.run(remainingDebt, readerId);
    });

    tx();
    return this.getReceiptById(newReceiptId);
  }
}

module.exports = new FineService();
