const db = require('../config/db');

class ReportService {
  getDashboardStats() {
    const todayStr = new Date().toISOString().split('T')[0];

    const totalBooks = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
    const totalCopies = db.prepare('SELECT COUNT(*) as count FROM book_copies').get().count;
    const availableCopies = db.prepare("SELECT COUNT(*) as count FROM book_copies WHERE status = 'available'").get().count;
    const totalReaders = db.prepare('SELECT COUNT(*) as count FROM readers').get().count;
    const activeBorrows = db.prepare("SELECT COUNT(*) as count FROM borrow_details WHERE status = 'borrowed'").get().count;
    
    const overdueCount = db.prepare(`
      SELECT COUNT(DISTINCT bt.id) as count
      FROM borrow_tickets bt
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      WHERE bd.status = 'borrowed' AND bt.due_date < ?
    `).get(todayStr).count;

    const totalDebt = db.prepare('SELECT SUM(total_debt) as sum FROM readers').get().sum || 0;
    const totalCollected = db.prepare('SELECT SUM(collected_amount) as sum FROM fine_receipts').get().sum || 0;

    // Recent 5 borrow activities
    const recentBorrows = db.prepare(`
      SELECT bt.*, r.fullname as reader_name, r.reader_code,
             COUNT(bd.id) as book_count
      FROM borrow_tickets bt
      JOIN readers r ON bt.reader_id = r.id
      JOIN borrow_details bd ON bt.id = bd.ticket_id
      GROUP BY bt.id
      ORDER BY bt.id DESC
      LIMIT 5
    `).all();

    // Top 5 borrowed books
    const topBooks = this.getTopBorrowedBooks(5);

    return {
      totalBooks,
      totalCopies,
      availableCopies,
      totalReaders,
      activeBorrows,
      overdueCount,
      totalDebt,
      totalCollected,
      recentBorrows,
      topBooks
    };
  }

  /**
   * [Quy định 6 - .1] Báo cáo tình hình mượn sách theo thể loại trong tháng
   */
  getMonthlyBorrowByCategory(month, year) {
    const targetMonth = String(month).padStart(2, '0');
    const targetYear = String(year);
    const datePrefix = `${targetYear}-${targetMonth}%`;

    // Tổng số lượt mượn trong tháng
    const totalBorrowsInMonth = db.prepare(`
      SELECT COUNT(bd.id) as total
      FROM borrow_details bd
      JOIN borrow_tickets bt ON bd.ticket_id = bt.id
      WHERE bt.borrow_date LIKE ?
    `).get(datePrefix).total || 0;

    const categoriesStats = db.prepare(`
      SELECT c.id, c.code, c.name as category_name,
             COUNT(bt.id) as borrow_count
      FROM categories c
      LEFT JOIN books b ON b.category_id = c.id
      LEFT JOIN borrow_details bd ON bd.book_id = b.id
      LEFT JOIN borrow_tickets bt ON bd.ticket_id = bt.id AND bt.borrow_date LIKE ?
      GROUP BY c.id
      ORDER BY borrow_count DESC, c.code ASC
    `).all(datePrefix);

    const reportData = categoriesStats.map(item => {
      const percentage = totalBorrowsInMonth > 0 
        ? ((item.borrow_count / totalBorrowsInMonth) * 100).toFixed(2) 
        : '0.00';
      return {
        ...item,
        percentage: Number(percentage)
      };
    });

    return {
      month: targetMonth,
      year: targetYear,
      totalBorrows: totalBorrowsInMonth,
      categories: reportData
    };
  }

  /**
   * [Quy định 6 - .2] Báo cáo thống kê sách trả trễ
   */
  getOverdueReport(targetDateStr = null) {
    const todayStr = targetDateStr || new Date().toISOString().split('T')[0];

    const overdueList = db.prepare(`
      SELECT bd.id as detail_id,
             b.title as book_title,
             bc.barcode,
             bt.ticket_code,
             bt.borrow_date,
             bt.due_date,
             r.fullname as reader_name,
             r.reader_code,
             r.phone as reader_phone,
             (julianday(?) - julianday(bt.due_date)) as overdue_days
      FROM borrow_details bd
      JOIN borrow_tickets bt ON bd.ticket_id = bt.id
      JOIN books b ON bd.book_id = b.id
      JOIN book_copies bc ON bd.book_copy_id = bc.id
      JOIN readers r ON bt.reader_id = r.id
      WHERE bd.status = 'borrowed' AND bt.due_date < ?
      ORDER BY bt.due_date ASC
    `).all(todayStr, todayStr);

    const formattedList = overdueList.map(item => ({
      ...item,
      overdue_days: Math.max(0, Math.ceil(item.overdue_days))
    }));

    return {
      reportDate: todayStr,
      totalOverdueItems: formattedList.length,
      items: formattedList
    };
  }

  getTopBorrowedBooks(limit = 10) {
    return db.prepare(`
      SELECT b.id, b.title, b.cover_image, c.name as category_name, a.name as author_name,
             COUNT(bd.id) as borrow_count
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN borrow_details bd ON bd.book_id = b.id
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT ?
    `).all(limit);
  }
}

module.exports = new ReportService();
