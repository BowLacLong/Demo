const { getDb, nextId } = require('../config/db');
const ruleService = require('./ruleService');
const { escapeRegex, searchOr } = require('../utils/search');

class ReaderService {
  async getAllReaders({ search = '', typeId = '', status = '', limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    const filter = {};

    if (search && String(search).trim() !== '') {
      Object.assign(filter, searchOr(String(search).trim(), ['fullname', 'reader_code', 'email', 'phone']));
    }

    if (typeId) filter.reader_type_id = Number(typeId);
    if (status) filter.status = status;

    const readers = await db.collection('readers')
      .find(filter)
      .sort({ id: -1 })
      .skip(Number(offset) || 0)
      .limit(Number(limit) || 100)
      .toArray();

    return this.attachStats(readers);
  }

  async attachStats(readers) {
    if (readers.length === 0) return [];

    const db = await getDb();
    const readerIds = readers.map(r => r.id);

    const [types, tickets] = await Promise.all([
      db.collection('reader_types').find({}).toArray(),
      db.collection('borrow_tickets')
        .find({ reader_id: { $in: readerIds } })
        .project({ id: 1, reader_id: 1, due_date: 1 })
        .toArray()
    ]);

    const typeMap = new Map(types.map(t => [t.id, t]));
    const ticketById = new Map(tickets.map(t => [t.id, t]));
    const ticketIds = tickets.map(t => t.id);

    const details = ticketIds.length
      ? await db.collection('borrow_details')
        .find({ ticket_id: { $in: ticketIds }, status: 'borrowed' })
        .toArray()
      : [];

    const todayStr = new Date().toISOString().split('T')[0];
    const stats = new Map(readerIds.map(id => [id, { borrowing: 0, overdue: 0 }]));

    for (const d of details) {
      const ticket = ticketById.get(d.ticket_id);
      if (!ticket) continue;
      const stat = stats.get(ticket.reader_id);
      if (!stat) continue;
      stat.borrowing += 1;
      if (ticket.due_date < todayStr) stat.overdue += 1;
    }

    return readers.map(r => {
      const type = typeMap.get(r.reader_type_id);
      const stat = stats.get(r.id) || { borrowing: 0, overdue: 0 };
      return {
        ...r,
        type_name: type ? type.name : null,
        type_code: type ? type.code : null,
        max_borrow_limit: type ? type.max_borrow_limit : null,
        currently_borrowing: stat.borrowing,
        overdue_books_count: stat.overdue
      };
    });
  }

  async getReaderById(id) {
    const db = await getDb();
    const reader = await db.collection('readers').findOne({ id: Number(id) });
    if (!reader) return null;

    const [withStats] = await this.attachStats([reader]);
    return withStats;
  }

  async getReaderByCode(code) {
    const db = await getDb();
    const reader = await db.collection('readers').findOne({ reader_code: code });
    return reader ? { id: reader.id } : undefined;
  }

  async findByEmailOrCode(term) {
    const db = await getDb();
    const regex = { $regex: escapeRegex(term), $options: 'i' };
    return db.collection('readers').findOne({ $or: [{ email: regex }, { reader_code: regex }] });
  }

  normalizePhone(phone) {
    if (phone === undefined || phone === null) return null;

    const value = String(phone).trim();
    if (!value) return null;

    if (!/^[0-9]+$/.test(value)) {
      throw new Error('Số điện thoại chỉ được nhập chữ số.');
    }

    if (value.length > 10) {
      throw new Error('Số điện thoại chỉ được nhập tối đa 10 số.');
    }

    return value;
  }

  async createReader(readerData) {
    // 1. Kiểm tra về độ tuổi
    const ageCheck = await ruleService.validateReaderAge(readerData.date_of_birth);
    if (!ageCheck.valid) {
      throw new Error(ageCheck.message);
    }

    const db = await getDb();
    const todayStr = new Date().toISOString().split('T')[0];
    const createdDate = readerData.created_date || todayStr;
    const expiryDate = readerData.expiry_date || await ruleService.calculateExpiryDate(createdDate);

    const id = await nextId('readers');
    const readerCode = readerData.reader_code || `DG${String(id).padStart(4, '0')}`;

    const existing = await db.collection('readers').findOne({ reader_code: readerCode });
    if (existing) {
      throw new Error(`Mã độc giả "${readerCode}" đã tồn tại trên hệ thống.`);
    }

    await db.collection('readers').insertOne({
      id,
      reader_code: readerCode,
      fullname: String(readerData.fullname || '').trim(),
      date_of_birth: readerData.date_of_birth,
      reader_type_id: Number(readerData.reader_type_id),
      address: String(readerData.address || '').trim(),
      email: String(readerData.email || '').trim(),
      phone: this.normalizePhone(readerData.phone),
      created_date: createdDate,
      expiry_date: expiryDate,
      total_debt: 0,
      status: 'active',
      avatar: readerData.avatar || null,
      created_at: new Date()
    });

    return this.getReaderById(id);
  }

  async updateReader(id, readerData) {
    if (readerData.date_of_birth) {
      const ageCheck = await ruleService.validateReaderAge(readerData.date_of_birth);
      if (!ageCheck.valid) {
        throw new Error(ageCheck.message);
      }
    }

    const db = await getDb();
    await db.collection('readers').updateOne(
      { id: Number(id) },
      {
        $set: {
          fullname: String(readerData.fullname || '').trim(),
          date_of_birth: readerData.date_of_birth,
          reader_type_id: Number(readerData.reader_type_id),
          address: String(readerData.address || '').trim(),
          email: String(readerData.email || '').trim(),
          phone: this.normalizePhone(readerData.phone),
          status: readerData.status || 'active'
        }
      }
    );

    return this.getReaderById(id);
  }

  async extendCard(id, months = 6) {
    const reader = await this.getReaderById(id);
    if (!reader) throw new Error('Không tìm thấy độc giả');

    const currentExpiry = new Date(reader.expiry_date);
    const now = new Date();
    // Gia hạn từ ngày hết hạn cũ nếu chưa qua, hoặc từ hôm nay nếu đã hết hạn
    const baseDate = currentExpiry > now ? currentExpiry : now;
    baseDate.setMonth(baseDate.getMonth() + Number(months));
    const newExpiry = baseDate.toISOString().split('T')[0];

    const db = await getDb();
    await db.collection('readers').updateOne(
      { id: Number(id) },
      { $set: { expiry_date: newExpiry, status: 'active' } }
    );

    return this.getReaderById(id);
  }

  async deleteReader(id) {
    const db = await getDb();
    const readerId = Number(id);

    const tickets = await db.collection('borrow_tickets')
      .find({ reader_id: readerId })
      .project({ id: 1 })
      .toArray();
    const ticketIds = tickets.map(t => t.id);

    const activeBorrows = ticketIds.length
      ? await db.collection('borrow_details')
        .countDocuments({ ticket_id: { $in: ticketIds }, status: 'borrowed' })
      : 0;

    if (activeBorrows > 0) {
      throw new Error(`Độc giả này đang mượn ${activeBorrows} cuốn sách, không thể xoá thẻ thư viện!`);
    }

    const reader = await db.collection('readers').findOne({ id: readerId });
    if (reader && Number(reader.total_debt) > 0) {
      throw new Error(`Độc giả này đang nợ phạt ${Number(reader.total_debt).toLocaleString('vi-VN')} VNĐ, phải thanh toán xong mới được xoá thẻ!`);
    }

    // Xoá user liên kết nếu có
    await db.collection('users').deleteMany({ reader_id: readerId });
    const result = await db.collection('readers').deleteOne({ id: readerId });
    return result.deletedCount > 0;
  }

  async getReaderHistory(readerId) {
    const db = await getDb();
    const id = Number(readerId);

    const [tickets, users] = await Promise.all([
      db.collection('borrow_tickets').find({ reader_id: id }).sort({ id: -1 }).toArray(),
      db.collection('users').find({}).project({ id: 1, fullname: 1 }).toArray()
    ]);

    const userMap = new Map(users.map(u => [u.id, u.fullname]));
    const ticketIds = tickets.map(t => t.id);

    const details = ticketIds.length
      ? await db.collection('borrow_details').find({ ticket_id: { $in: ticketIds } }).toArray()
      : [];

    const [books, copies] = await Promise.all([
      db.collection('books').find({}).project({ id: 1, title: 1, cover_image: 1 }).toArray(),
      db.collection('book_copies').find({}).project({ id: 1, barcode: 1 }).toArray()
    ]);
    const bookMap = new Map(books.map(b => [b.id, b]));
    const copyMap = new Map(copies.map(c => [c.id, c]));

    const detailsByTicket = new Map();
    for (const d of details) {
      const book = bookMap.get(d.book_id) || {};
      const copy = copyMap.get(d.book_copy_id) || {};
      const enriched = {
        ...d,
        book_title: book.title || null,
        cover_image: book.cover_image || null,
        barcode: copy.barcode || null
      };
      if (!detailsByTicket.has(d.ticket_id)) detailsByTicket.set(d.ticket_id, []);
      detailsByTicket.get(d.ticket_id).push(enriched);
    }

    const withDetails = tickets.map(t => ({
      ...t,
      creator_name: userMap.get(t.created_by) || null,
      details: detailsByTicket.get(t.id) || []
    }));

    const receipts = await db.collection('fine_receipts').find({ reader_id: id }).sort({ id: -1 }).toArray();
    const withCreator = receipts.map(r => ({ ...r, creator_name: userMap.get(r.created_by) || null }));

    return { tickets: withDetails, receipts: withCreator };
  }

  async getReaderTypes() {
    const db = await getDb();
    return db.collection('reader_types').find({}).sort({ id: 1 }).toArray();
  }

  async createReaderType({ code, name, max_borrow_limit }) {
    const db = await getDb();
    const normalizedCode = String(code || '').trim().toUpperCase();

    const existing = await db.collection('reader_types').findOne({ code: normalizedCode });
    if (existing) {
      throw new Error(`Mã loại độc giả "${normalizedCode}" đã tồn tại.`);
    }

    const id = await nextId('reader_types');
    await db.collection('reader_types').insertOne({
      id,
      code: normalizedCode,
      name: String(name || '').trim(),
      max_borrow_limit: Number(max_borrow_limit) || 5,
      created_at: new Date()
    });

    return id;
  }

  /**
   * Danh sách sách độc giả đang mượn kèm số ngày còn lại (dùng cho cổng độc giả).
   */
  async getActiveBorrows(readerId) {
    const db = await getDb();
    const id = Number(readerId);

    const tickets = await db.collection('borrow_tickets').find({ reader_id: id }).toArray();
    if (tickets.length === 0) return [];

    const ticketMap = new Map(tickets.map(t => [t.id, t]));
    const details = await db.collection('borrow_details')
      .find({ ticket_id: { $in: tickets.map(t => t.id) }, status: 'borrowed' })
      .toArray();

    if (details.length === 0) return [];

    const bookIds = [...new Set(details.map(d => d.book_id))];
    const copyIds = [...new Set(details.map(d => d.book_copy_id))];

    const [books, copies] = await Promise.all([
      db.collection('books').find({ id: { $in: bookIds } }).toArray(),
      db.collection('book_copies').find({ id: { $in: copyIds } }).toArray()
    ]);

    const bookMap = new Map(books.map(b => [b.id, b]));
    const copyMap = new Map(copies.map(c => [c.id, c]));
    const now = new Date();

    return details.map(d => {
      const ticket = ticketMap.get(d.ticket_id);
      const book = bookMap.get(d.book_id);
      const copy = copyMap.get(d.book_copy_id);
      const daysLeft = Math.ceil((new Date(ticket.due_date).getTime() - now.getTime()) / 86400000);

      return {
        ticket_id: ticket.id,
        ticket_code: ticket.ticket_code,
        borrow_date: ticket.borrow_date,
        due_date: ticket.due_date,
        book_id: d.book_id,
        book_title: book ? book.title : null,
        cover_image: book ? book.cover_image : null,
        barcode: copy ? copy.barcode : null,
        days_left: daysLeft,
        is_overdue: daysLeft < 0
      };
    }).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }
}

module.exports = new ReaderService();
