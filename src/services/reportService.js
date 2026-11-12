const { getDb } = require('../config/db');

class ReportService {
  async getDashboardStats() {
    const db = await getDb();
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      totalBooks,
      totalCopies,
      availableCopies,
      totalReaders,
      activeBorrows,
      tickets,
      readers,
      receipts
    ] = await Promise.all([
      db.collection('books').countDocuments(),
      db.collection('book_copies').countDocuments(),
      db.collection('book_copies').countDocuments({ status: 'available' }),
      db.collection('readers').countDocuments(),
      db.collection('borrow_details').countDocuments({ status: 'borrowed' }),
      db.collection('borrow_tickets').find({}).toArray(),
      db.collection('readers').find({}).project({ total_debt: 1 }).toArray(),
      db.collection('fine_receipts').find({}).project({ collected_amount: 1 }).toArray()
    ]);

    const ticketMap = new Map(tickets.map(t => [t.id, t]));
    const borrowedDetails = await db.collection('borrow_details').find({ status: 'borrowed' }).toArray();

    const overdueTicketIds = new Set();
    for (const d of borrowedDetails) {
      const ticket = ticketMap.get(d.ticket_id);
      if (ticket && ticket.due_date < todayStr) overdueTicketIds.add(ticket.id);
    }

    const totalDebt = readers.reduce((sum, r) => sum + (Number(r.total_debt) || 0), 0);
    const totalCollected = receipts.reduce((sum, r) => sum + (Number(r.collected_amount) || 0), 0);

    // 5 phiếu mượn gần nhất
    const summary = await this.attachTicketSummaries(tickets);
    const recentBorrows = summary.sort((a, b) => b.id - a.id).slice(0, 5);

    const topBooks = await this.getTopBorrowedBooks(5);

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      totalReaders,
      activeBorrows,
      overdueCount: overdueTicketIds.size,
      totalDebt,
      totalCollected,
      recentBorrows,
      topBooks
    };
  }

  async attachTicketSummaries(tickets) {
    if (tickets.length === 0) return [];

    const db = await getDb();
    const readerIds = [...new Set(tickets.map(t => t.reader_id).filter(Boolean))];
    const ticketIds = tickets.map(t => t.id);

    const [readers, details] = await Promise.all([
      readerIds.length ? db.collection('readers').find({ id: { $in: readerIds } }).toArray() : [],
      db.collection('borrow_details').find({ ticket_id: { $in: ticketIds } }).project({ ticket_id: 1 }).toArray()
    ]);

    const readerMap = new Map(readers.map(r => [r.id, r]));
    const countMap = new Map(ticketIds.map(id => [id, 0]));
    for (const d of details) {
      countMap.set(d.ticket_id, (countMap.get(d.ticket_id) || 0) + 1);
    }

    return tickets.map(t => {
      const reader = readerMap.get(t.reader_id);
      return {
        ...t,
        reader_name: reader ? reader.fullname : null,
        reader_code: reader ? reader.reader_code : null,
        book_count: countMap.get(t.id) || 0
      };
    });
  }

  /**
   * [Quy định 6.1] Báo cáo tình hình mượn sách theo thể loại trong tháng
   */
  async getMonthlyBorrowByCategory(month, year) {
    const targetMonth = String(month).padStart(2, '0');
    const targetYear = String(year);
    const prefix = `${targetYear}-${targetMonth}`;

    const db = await getDb();
    const [categories, books, tickets, details] = await Promise.all([
      db.collection('categories').find({}).sort({ code: 1 }).toArray(),
      db.collection('books').find({}).project({ id: 1, category_id: 1 }).toArray(),
      db.collection('borrow_tickets').find({}).project({ id: 1, borrow_date: 1 }).toArray(),
      db.collection('borrow_details').find({}).project({ ticket_id: 1, book_id: 1 }).toArray()
    ]);

    const ticketIdsInMonth = new Set(
      tickets.filter(t => String(t.borrow_date || '').startsWith(prefix)).map(t => t.id)
    );
    const bookCategoryMap = new Map(books.map(b => [b.id, b.category_id]));

    const counts = new Map(categories.map(c => [c.id, 0]));
    let totalBorrows = 0;

    for (const d of details) {
      if (!ticketIdsInMonth.has(d.ticket_id)) continue;
      const categoryId = bookCategoryMap.get(d.book_id);
      if (categoryId === undefined) continue;
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
      totalBorrows += 1;
    }

    const reportData = categories
      .map(c => ({
        id: c.id,
        code: c.code,
        category_name: c.name,
        borrow_count: counts.get(c.id) || 0
      }))
      .sort((a, b) => (b.borrow_count - a.borrow_count) || String(a.code).localeCompare(String(b.code)))
      .map(item => ({
        ...item,
        percentage: totalBorrows > 0 ? Number(((item.borrow_count / totalBorrows) * 100).toFixed(2)) : 0
      }));

    return {
      month: targetMonth,
      year: targetYear,
      totalBorrows,
      categories: reportData
    };
  }

  /**
   * [Quy định 6.2] Báo cáo thống kê sách trả trễ
   */
  async getOverdueReport(targetDateStr = null) {
    const db = await getDb();
    const todayStr = targetDateStr || new Date().toISOString().split('T')[0];
    const targetDate = new Date(todayStr);

    const [tickets, details, books, copies, readers] = await Promise.all([
      db.collection('borrow_tickets').find({}).toArray(),
      db.collection('borrow_details').find({ status: 'borrowed' }).toArray(),
      db.collection('books').find({}).project({ id: 1, title: 1 }).toArray(),
      db.collection('book_copies').find({}).project({ id: 1, barcode: 1 }).toArray(),
      db.collection('readers').find({}).toArray()
    ]);

    const ticketMap = new Map(tickets.map(t => [t.id, t]));
    const bookMap = new Map(books.map(b => [b.id, b]));
    const copyMap = new Map(copies.map(c => [c.id, c]));
    const readerMap = new Map(readers.map(r => [r.id, r]));

    const items = [];

    for (const d of details) {
      const ticket = ticketMap.get(d.ticket_id);
      if (!ticket || !(ticket.due_date < todayStr)) continue;

      const book = bookMap.get(d.book_id);
      const copy = copyMap.get(d.book_copy_id);
      const reader = readerMap.get(ticket.reader_id);
      const overdueDays = Math.max(
        0,
        Math.ceil((targetDate.getTime() - new Date(ticket.due_date).getTime()) / (1000 * 60 * 60 * 24))
      );

      items.push({
        detail_id: d.id,
        book_title: book ? book.title : null,
        barcode: copy ? copy.barcode : null,
        ticket_code: ticket.ticket_code,
        borrow_date: ticket.borrow_date,
        due_date: ticket.due_date,
        reader_name: reader ? reader.fullname : null,
        reader_code: reader ? reader.reader_code : null,
        reader_phone: reader ? reader.phone : null,
        overdue_days: overdueDays
      });
    }

    items.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

    return {
      reportDate: todayStr,
      totalOverdueItems: items.length,
      items
    };
  }

  async getTopBorrowedBooks(limit = 10) {
    const db = await getDb();
    const [details, books, categories, authors] = await Promise.all([
      db.collection('borrow_details').find({}).project({ book_id: 1 }).toArray(),
      db.collection('books').find({}).toArray(),
      db.collection('categories').find({}).toArray(),
      db.collection('authors').find({}).toArray()
    ]);

    const countMap = new Map();
    for (const d of details) {
      countMap.set(d.book_id, (countMap.get(d.book_id) || 0) + 1);
    }

    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const authorMap = new Map(authors.map(a => [a.id, a]));

    return books
      .map(b => {
        const category = categoryMap.get(b.category_id);
        const author = authorMap.get(b.author_id);
        return {
          id: b.id,
          title: b.title,
          cover_image: b.cover_image,
          category_name: category ? category.name : null,
          author_name: author ? author.name : null,
          borrow_count: countMap.get(b.id) || 0
        };
      })
      .sort((a, b) => b.borrow_count - a.borrow_count)
      .slice(0, Number(limit));
  }
}

module.exports = new ReportService();
