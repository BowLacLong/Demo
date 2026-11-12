const db = require('../config/db');
const ruleService = require('./ruleService');
const bookService = require('./bookService');

class BorrowService {
  getAllTickets({ search = '', status = '', readerId = '', limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT bt.*, r.fullname as reader_name, r.reader_code, r.phone as reader_phone,
             u.fullname as creator_name,
             (SELECT COUNT(*) FROM borrow_details bd WHERE bd.ticket_id = bt.id) as total_items,
             (SELECT COUNT(*) FROM borrow_details bd WHERE bd.ticket_id = bt.id AND bd.status = 'borrowed') as active_items
      FROM borrow_tickets bt
      JOIN readers r ON bt.reader_id = r.id
      LEFT JOIN users u ON bt.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      sql += ` AND (bt.ticket_code LIKE ? OR r.fullname LIKE ? OR r.reader_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (status) {
      sql += ` AND bt.status = ?`;
      params.push(status);
    }

    if (readerId) {
      sql += ` AND bt.reader_id = ?`;
      params.push(readerId);
    }

    sql += ` ORDER BY bt.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const tickets = db.prepare(sql).all(...params);

    // Update overdue status dynamically if past due date and still active
    const todayStr = new Date().toISOString().split('T')[0];
    for (const t of tickets) {
      if (t.status === 'borrowing' && t.due_date < todayStr) {
        t.is_overdue = true;
      }
    }

    return tickets;
  }

  getTicketById(id) {
    const ticket = db.prepare(`
      SELECT bt.*, r.fullname as reader_name, r.reader_code, r.phone as reader_phone,
             r.email as reader_email, r.total_debt as reader_debt, r.expiry_date as reader_expiry,
             rt.name as reader_type_name,
             u.fullname as creator_name
      FROM borrow_tickets bt
      JOIN readers r ON bt.reader_id = r.id
      JOIN reader_types rt ON r.reader_type_id = rt.id
      LEFT JOIN users u ON bt.created_by = u.id
      WHERE bt.id = ?
    `).get(id);

    if (!ticket) return null;

    ticket.details = db.prepare(`
      SELECT bd.*, b.title as book_title, b.price as book_price, b.cover_image,
             bc.barcode, bc.location
      FROM borrow_details bd
      JOIN book_copies bc ON bd.book_copy_id = bc.id
      JOIN books b ON bd.book_id = b.id
      WHERE bd.ticket_id = ?
    `).all(id);

    const todayStr = new Date().toISOString().split('T')[0];
    ticket.is_overdue = ticket.status === 'borrowing' && ticket.due_date < todayStr;

    // Calculate potential current fine for active items
    if (ticket.is_overdue) {
      const fineCalc = ruleService.calculateFine(ticket.due_date, todayStr);
      ticket.current_potential_fine = fineCalc.fineAmount;
      ticket.overdue_days_count = fineCalc.overdueDays;
    }

    return ticket;
  }

  createBorrowTicket({ readerId, copyIds, userId, borrowDate, note = '' }) {
    if (!copyIds || !Array.isArray(copyIds) || copyIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 cuốn sách để cho mượn.');
    }

    // 1. Kiểm tra  về điều kiện mượn của độc giả
    const eligibility = ruleService.validateBorrowEligibility(readerId, copyIds.length);
    if (!eligibility.valid) {
      throw new Error(eligibility.message);
    }

    const today = new Date();
    const bDate = borrowDate ? new Date(borrowDate) : today;
    const maxBorrowDays = eligibility.maxBorrowDays || 14;
    const dueDate = new Date(bDate);
    dueDate.setDate(dueDate.getDate() + maxBorrowDays);

    const bDateStr = bDate.toISOString().split('T')[0];
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Check availability of all copies
    const copyPlaceholders = copyIds.map(() => '?').join(',');
    const copies = db.prepare(`
      SELECT bc.*, b.title, b.id as book_id 
      FROM book_copies bc
      JOIN books b ON bc.book_id = b.id
      WHERE bc.id IN (${copyPlaceholders})
    `).all(...copyIds);

    if (copies.length !== copyIds.length) {
      throw new Error('Một số bản sách được chọn không tồn tại trong hệ thống.');
    }

    for (const cp of copies) {
      if (cp.status !== 'available') {
        throw new Error(`Sách "${cp.title}" (Mã vạch: ${cp.barcode}) hiện không có sẵn (Trạng thái: ${cp.status}).`);
      }
    }

    // Generate ticket code: PM0001
    const lastId = db.prepare('SELECT MAX(id) as maxId FROM borrow_tickets').get().maxId || 0;
    const ticketCode = `PM${String(lastId + 1).padStart(4, '0')}`;

    let newTicketId;
    const insertTicket = db.prepare(`
      INSERT INTO borrow_tickets (ticket_code, reader_id, borrow_date, due_date, status, created_by, note)
      VALUES (?, ?, ?, ?, 'borrowing', ?, ?)
    `);

    const insertDetail = db.prepare(`
      INSERT INTO borrow_details (ticket_id, book_copy_id, book_id, return_date, status, fine_amount, overdue_days)
      VALUES (?, ?, ?, NULL, 'borrowed', 0, 0)
    `);

    const updateCopyStatus = db.prepare("UPDATE book_copies SET status = 'borrowed' WHERE id = ?");

    const tx = db.transaction(() => {
      const res = insertTicket.run(ticketCode, readerId, bDateStr, dueDateStr, userId || null, note);
      newTicketId = res.lastInsertRowid;

      for (const cp of copies) {
        insertDetail.run(newTicketId, cp.id, cp.book_id);
        updateCopyStatus.run(cp.id);
        bookService.recalculateCopies(cp.book_id);
      }
    });

    tx();
    return this.getTicketById(newTicketId);
  }

  /**
   * Trả sách
   * @param {number} ticketId
   * @param {Array<{ detailId: number, status: 'returned'|'lost'|'damaged', damageFee: number, damageNote: string }>} itemsToReturn
   * @param {string} returnDateStr
   * @param {number} userId
   */
  returnBooks(ticketId, itemsToReturn, returnDateStr = null, userId = null) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error('Không tìm thấy phiếu mượn.');

    const returnDate = returnDateStr ? returnDateStr : new Date().toISOString().split('T')[0];
    
    // Tính tiền phạt trễ hạn theo quy định
    const fineCalc = ruleService.calculateFine(ticket.due_date, returnDate);

    const updateDetail = db.prepare(`
      UPDATE borrow_details
      SET return_date = ?, status = ?, fine_amount = ?, overdue_days = ?, damage_note = ?
      WHERE id = ?
    `);

    const updateCopy = db.prepare('UPDATE book_copies SET status = ? WHERE id = ?');
    const updateReaderDebt = db.prepare('UPDATE readers SET total_debt = total_debt + ? WHERE id = ?');
    const updateTicketStatus = db.prepare('UPDATE borrow_tickets SET status = ? WHERE id = ?');

    let totalFineAdded = 0;

    const tx = db.transaction(() => {
      for (const item of itemsToReturn) {
        const detail = ticket.details.find(d => d.id === Number(item.detailId));
        if (!detail || detail.status !== 'borrowed') continue;

        let itemFine = 0;
        let copyNewStatus = 'available';

        // Tiền phạt trễ hạn nếu có
        if (fineCalc.overdueDays > 0) {
          itemFine += fineCalc.fineAmount;
        }

        // Nếu sách bị hỏng hoặc mất
        if (item.status === 'lost') {
          copyNewStatus = 'lost';
          // Nếu mất, đền tiền sách hoặc phí phụ thu
          const lossFee = Number(item.damageFee) || detail.book_price || 0;
          itemFine += lossFee;
        } else if (item.status === 'damaged') {
          copyNewStatus = 'damaged';
          const damageFee = Number(item.damageFee) || 0;
          itemFine += damageFee;
        }

        totalFineAdded += itemFine;

        updateDetail.run(
          returnDate,
          item.status || 'returned',
          itemFine,
          fineCalc.overdueDays,
          item.damageNote || null,
          detail.id
        );

        updateCopy.run(copyNewStatus, detail.book_copy_id);
        bookService.recalculateCopies(detail.book_id);
      }

      // Cộng tiền phạt vào nợ độc giả nếu có
      if (totalFineAdded > 0) {
        updateReaderDebt.run(totalFineAdded, ticket.reader_id);
      }

      // Kiểm tra xem tất cả các sách trong phiếu đã được trả chưa
      const remainingUnreturned = db.prepare(`
        SELECT COUNT(*) as count FROM borrow_details WHERE ticket_id = ? AND status = 'borrowed'
      `).get(ticketId).count;

      if (remainingUnreturned === 0) {
        updateTicketStatus.run('returned', ticketId);
      } else {
        updateTicketStatus.run('partially_returned', ticketId);
      }
    });

    tx();
    return {
      ticket: this.getTicketById(ticketId),
      totalFineAdded,
      overdueDays: fineCalc.overdueDays
    };
  }

  extendTicket(ticketId, extraDays = 7) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error('Không tìm thấy phiếu mượn.');

    if (ticket.status !== 'borrowing') {
      throw new Error('Chỉ có thể gia hạn phiếu mượn đang trong trạng thái mượn.');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (ticket.due_date < todayStr) {
      throw new Error('Phiếu mượn đã quá hạn, không thể gia hạn. Vui lòng hoàn trả sách và nộp phạt!');
    }

    const curDue = new Date(ticket.due_date);
    curDue.setDate(curDue.getDate() + Number(extraDays));
    const newDueDate = curDue.toISOString().split('T')[0];

    db.prepare('UPDATE borrow_tickets SET due_date = ?, note = note || ? WHERE id = ?')
      .run(newDueDate, ` (Đã gia hạn +${extraDays} ngày đến ${newDueDate})`, ticketId);

    return this.getTicketById(ticketId);
  }

  getOverdueTickets() {
    const todayStr = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT bt.*, r.fullname as reader_name, r.reader_code, r.phone as reader_phone, r.email as reader_email,
             COUNT(bd.id) as overdue_items_count
      FROM borrow_tickets bt
      JOIN readers r ON bt.reader_id = r.id
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      WHERE bd.status = 'borrowed' AND bt.due_date < ?
      GROUP BY bt.id
      ORDER BY bt.due_date ASC
    `).all(todayStr);
  }
}

module.exports = new BorrowService();
