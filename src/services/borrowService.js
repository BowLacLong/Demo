const { getDb, nextId } = require('../config/db');
const ruleService = require('./ruleService');
const bookService = require('./bookService');
const { escapeRegex } = require('../utils/search');

const todayStr = () => new Date().toISOString().split('T')[0];

class BorrowService {
  async getAllTickets({ search = '', status = '', readerId = '', limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    const filter = {};

    if (status) filter.status = status;
    if (readerId) filter.reader_id = Number(readerId);

    if (search && String(search).trim() !== '') {
      const regex = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
      const matchedReaders = await db.collection('readers')
        .find({ $or: [{ fullname: regex }, { reader_code: regex }] })
        .project({ id: 1 })
        .toArray();

      filter.$or = [
        { ticket_code: regex },
        ...(matchedReaders.length ? [{ reader_id: { $in: matchedReaders.map(r => r.id) } }] : [])
      ];
    }

    const tickets = await db.collection('borrow_tickets')
      .find(filter)
      .sort({ id: -1 })
      .skip(Number(offset) || 0)
      .limit(Number(limit) || 100)
      .toArray();

    return this.attachSummaries(tickets);
  }

  /**
   * Gắn thông tin độc giả, người lập phiếu và số cuốn đang giữ cho danh sách phiếu.
   */
  async attachSummaries(tickets) {
    if (tickets.length === 0) return [];

    const db = await getDb();
    const ticketIds = tickets.map(t => t.id);
    const readerIds = [...new Set(tickets.map(t => t.reader_id).filter(Boolean))];
    const userIds = [...new Set(tickets.map(t => t.created_by).filter(Boolean))];

    const [readers, users, details] = await Promise.all([
      readerIds.length ? db.collection('readers').find({ id: { $in: readerIds } }).toArray() : [],
      userIds.length ? db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, fullname: 1 }).toArray() : [],
      db.collection('borrow_details').find({ ticket_id: { $in: ticketIds } }).project({ ticket_id: 1, status: 1 }).toArray()
    ]);

    const readerMap = new Map(readers.map(r => [r.id, r]));
    const userMap = new Map(users.map(u => [u.id, u.fullname]));

    const countMap = new Map(ticketIds.map(id => [id, { total: 0, active: 0 }]));
    for (const d of details) {
      const stat = countMap.get(d.ticket_id);
      if (!stat) continue;
      stat.total += 1;
      if (d.status === 'borrowed') stat.active += 1;
    }

    const today = todayStr();

    return tickets.map(t => {
      const reader = readerMap.get(t.reader_id);
      const stat = countMap.get(t.id) || { total: 0, active: 0 };
      return {
        ...t,
        reader_name: reader ? reader.fullname : null,
        reader_code: reader ? reader.reader_code : null,
        reader_phone: reader ? reader.phone : null,
        creator_name: userMap.get(t.created_by) || null,
        total_items: stat.total,
        active_items: stat.active,
        is_overdue: t.status === 'borrowing' && t.due_date < today
      };
    });
  }

  async getTicketById(id) {
    const db = await getDb();
    const ticketId = Number(id);
    const ticket = await db.collection('borrow_tickets').findOne({ id: ticketId });
    if (!ticket) return null;

    const reader = ticket.reader_id
      ? await db.collection('readers').findOne({ id: ticket.reader_id })
      : null;
    const readerType = reader
      ? await db.collection('reader_types').findOne({ id: reader.reader_type_id })
      : null;
    const creator = ticket.created_by
      ? await db.collection('users').findOne({ id: ticket.created_by })
      : null;

    const details = await db.collection('borrow_details').find({ ticket_id: ticketId }).toArray();
    const bookIds = [...new Set(details.map(d => d.book_id).filter(Boolean))];
    const copyIds = [...new Set(details.map(d => d.book_copy_id).filter(Boolean))];

    const [books, copies] = await Promise.all([
      bookIds.length ? db.collection('books').find({ id: { $in: bookIds } }).project({ id: 1, title: 1, price: 1, cover_image: 1 }).toArray() : [],
      copyIds.length ? db.collection('book_copies').find({ id: { $in: copyIds } }).project({ id: 1, barcode: 1, location: 1 }).toArray() : []
    ]);

    const bookMap = new Map(books.map(b => [b.id, b]));
    const copyMap = new Map(copies.map(c => [c.id, c]));

    const enrichedDetails = details.map(d => {
      const book = bookMap.get(d.book_id) || {};
      const copy = copyMap.get(d.book_copy_id) || {};
      return {
        ...d,
        book_title: book.title || null,
        book_price: book.price || 0,
        cover_image: book.cover_image || null,
        barcode: copy.barcode || null,
        location: copy.location || null
      };
    });

    const isOverdue = ticket.status === 'borrowing' && ticket.due_date < todayStr();
    let currentPotentialFine = 0;
    let overdueDaysCount = 0;

    if (isOverdue) {
      const fineCalc = await ruleService.calculateFine(ticket.due_date, todayStr());
      currentPotentialFine = fineCalc.fineAmount;
      overdueDaysCount = fineCalc.overdueDays;
    }

    return {
      ...ticket,
      reader_name: reader ? reader.fullname : null,
      reader_code: reader ? reader.reader_code : null,
      reader_phone: reader ? reader.phone : null,
      reader_email: reader ? reader.email : null,
      reader_debt: reader ? reader.total_debt : 0,
      reader_expiry: reader ? reader.expiry_date : null,
      reader_type_name: readerType ? readerType.name : null,
      creator_name: creator ? creator.fullname : null,
      details: enrichedDetails,
      is_overdue: isOverdue,
      current_potential_fine: currentPotentialFine,
      overdue_days_count: overdueDaysCount
    };
  }

  async createBorrowTicket({ readerId, copyIds, userId, borrowDate, note = '' }) {
    if (!copyIds || !Array.isArray(copyIds) || copyIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 cuốn sách để cho mượn.');
    }

    // 1. Kiểm tra điều kiện mượn của độc giả
    const eligibility = await ruleService.validateBorrowEligibility(readerId, copyIds.length);
    if (!eligibility.valid) {
      throw new Error(eligibility.message);
    }

    const db = await getDb();
    const bDate = borrowDate ? new Date(borrowDate) : new Date();
    const maxBorrowDays = eligibility.maxBorrowDays || 14;
    const dueDate = new Date(bDate);
    dueDate.setDate(dueDate.getDate() + maxBorrowDays);

    const bDateStr = bDate.toISOString().split('T')[0];
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // 2. Kiểm tra bản sách có sẵn
    const numericCopyIds = copyIds.map(Number);
    const copies = await db.collection('book_copies')
      .find({ id: { $in: numericCopyIds } })
      .toArray();

    if (copies.length !== numericCopyIds.length) {
      throw new Error('Một số bản sách được chọn không tồn tại trong hệ thống.');
    }

    const bookIds = [...new Set(copies.map(c => c.book_id))];
    const books = bookIds.length
      ? await db.collection('books').find({ id: { $in: bookIds } }).project({ id: 1, title: 1 }).toArray()
      : [];
    const bookMap = new Map(books.map(b => [b.id, b]));

    for (const cp of copies) {
      if (cp.status !== 'available') {
        const title = bookMap.get(cp.book_id) ? bookMap.get(cp.book_id).title : null;
        throw new Error(`Sách "${title}" (Mã vạch: ${cp.barcode}) hiện không có sẵn (Trạng thái: ${cp.status}).`);
      }
    }

    // 3. Tạo phiếu mượn
    const ticketId = await nextId('borrow_tickets');
    const ticketCode = `PM${String(ticketId).padStart(4, '0')}`;

    await db.collection('borrow_tickets').insertOne({
      id: ticketId,
      ticket_code: ticketCode,
      reader_id: Number(readerId),
      borrow_date: bDateStr,
      due_date: dueDateStr,
      status: 'borrowing',
      created_by: userId ? Number(userId) : null,
      note: note || '',
      created_at: new Date()
    });

    for (const cp of copies) {
      await db.collection('borrow_details').insertOne({
        id: await nextId('borrow_details'),
        ticket_id: ticketId,
        book_copy_id: cp.id,
        book_id: cp.book_id,
        return_date: null,
        status: 'borrowed',
        fine_amount: 0,
        overdue_days: 0,
        damage_note: null
      });

      await db.collection('book_copies').updateOne({ id: cp.id }, { $set: { status: 'borrowed' } });
      await bookService.recalculateCopies(cp.book_id);
    }

    return this.getTicketById(ticketId);
  }

  /**
   * Trả sách
   * @param {number} ticketId
   * @param {Array<{ detailId: number, status: 'returned'|'lost'|'damaged', damageFee: number, damageNote: string }>} itemsToReturn
   * @param {string} returnDateStr
   * @param {number} userId
   */
  async returnBooks(ticketId, itemsToReturn, returnDateStr = null, userId = null) {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Không tìm thấy phiếu mượn.');
    if (!Array.isArray(itemsToReturn)) itemsToReturn = [];

    const db = await getDb();
    const returnDate = returnDateStr ? returnDateStr : todayStr();

    // Tính tiền phạt trễ hạn theo quy định
    const fineCalc = await ruleService.calculateFine(ticket.due_date, returnDate);

    let totalFineAdded = 0;

    const processedBooks = new Set();

    for (const item of itemsToReturn) {
      const detail = ticket.details.find(d => d.id === Number(item.detailId));
      if (!detail) continue;

      let itemFine = 0;
      let copyNewStatus = 'available';

      // Tiền phạt trễ hạn nếu có
      if (fineCalc.overdueDays > 0) {
        itemFine += fineCalc.fineAmount;
      }

      // Nếu sách bị hỏng hoặc mất
      if (item.status === 'lost') {
        copyNewStatus = 'lost';
        const lossFee = Number(item.damageFee) || detail.book_price || 0;
        itemFine += lossFee;
      } else if (item.status === 'damaged') {
        copyNewStatus = 'damaged';
        const damageFee = Number(item.damageFee) || 0;
        itemFine += damageFee;
      }

      totalFineAdded += itemFine;

      await db.collection('borrow_details').updateOne(
        { id: detail.id },
        {
          $set: {
            return_date: returnDate,
            status: item.status || 'returned',
            fine_amount: itemFine,
            overdue_days: fineCalc.overdueDays,
            damage_note: item.damageNote || null
          }
        }
      );

      await db.collection('book_copies').updateOne(
        { id: detail.book_copy_id },
        { $set: { status: copyNewStatus } }
      );

      // Theo dõi sách đã cập nhật để recalculate một lần duy nhất cho mỗi book_id
      processedBooks.add(detail.book_id);
    }

    // Sau khi xử lý xong tất cả cuốn sách, recalculate tổng quan cho từng book_id đã được sửa
    for (const bookId of processedBooks) {
      await bookService.recalculateCopies(bookId);
    }

    // Cộng tiền phạt vào nợ độc giả nếu có
    if (totalFineAdded > 0) {
      await db.collection('readers').updateOne(
        { id: ticket.reader_id },
        { $inc: { total_debt: totalFineAdded } }
      );
    }

    // Kiểm tra xem tất cả các sách trong phiếu đã được trả chưa
    const remainingUnreturned = await db.collection('borrow_details')
      .countDocuments({ ticket_id: Number(ticketId), status: 'borrowed' });

    await db.collection('borrow_tickets').updateOne(
      { id: Number(ticketId) },
      { $set: { status: remainingUnreturned === 0 ? 'returned' : 'partially_returned' } }
    );

    return {
      ticket: await this.getTicketById(ticketId),
      totalFineAdded,
      overdueDays: fineCalc.overdueDays
    };
  }

  async extendTicket(ticketId, extraDays = 7) {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Không tìm thấy phiếu mượn.');

    if (ticket.status !== 'borrowing') {
      throw new Error('Chỉ có thể gia hạn phiếu mượn đang trong trạng thái mượn.');
    }

    if (ticket.due_date < todayStr()) {
      throw new Error('Phiếu mượn đã quá hạn, không thể gia hạn. Vui lòng hoàn trả sách và nộp phạt!');
    }

    const curDue = new Date(ticket.due_date);
    curDue.setDate(curDue.getDate() + Number(extraDays));
    const newDueDate = curDue.toISOString().split('T')[0];

    const db = await getDb();
    await db.collection('borrow_tickets').updateOne(
      { id: Number(ticketId) },
      {
        $set: {
          due_date: newDueDate,
          note: `${ticket.note || ''} (Đã gia hạn +${extraDays} ngày đến ${newDueDate})`
        }
      }
    );

    return this.getTicketById(ticketId);
  }

  async getOverdueTickets() {
    const db = await getDb();
    const today = todayStr();

    const tickets = await db.collection('borrow_tickets')
      .find({ due_date: { $lt: today }, status: { $in: ['borrowing', 'overdue', 'partially_returned'] } })
      .sort({ due_date: 1 })
      .toArray();

    if (tickets.length === 0) return [];

    const summaries = await this.attachSummaries(tickets);
    return summaries
      .filter(t => t.active_items > 0)
      .map(t => ({ ...t, overdue_items_count: t.active_items, is_overdue: true }));
  }
}

module.exports = new BorrowService();
