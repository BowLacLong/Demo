const readerService = require('../services/readerService');
const borrowService = require('../services/borrowService');
const reservationService = require('../services/reservationService');
const db = require('../config/db');

class PortalController {
  index(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'reader' || !user.reader_id) {
      req.flash('error', 'Chỉ tài khoản độc giả mới có thể truy cập cổng cá nhân.');
      return res.redirect('/dashboard');
    }

    const reader = readerService.getReaderById(user.reader_id);
    if (!reader) {
      req.flash('error', 'Hồ sơ độc giả liên kết không tồn tại.');
      return res.redirect('/books');
    }

    // Get active borrows with detailed remaining days calculation
    const activeBorrows = db.prepare(`
      SELECT bd.*, b.title as book_title, b.cover_image, bc.barcode,
             bt.ticket_code, bt.borrow_date, bt.due_date,
             (julianday(bt.due_date) - julianday('now')) as days_left
      FROM borrow_details bd
      JOIN borrow_tickets bt ON bd.ticket_id = bt.id
      JOIN book_copies bc ON bd.book_copy_id = bc.id
      JOIN books b ON bd.book_id = b.id
      WHERE bt.reader_id = ? AND bd.status = 'borrowed'
      ORDER BY bt.due_date ASC
    `).all(reader.id);

    activeBorrows.forEach(b => {
      b.days_left = Math.ceil(b.days_left);
      b.is_overdue = b.days_left < 0;
    });

    // Get reservations
    const reservations = reservationService.getAllReservations({ readerId: reader.id });

    // Get history
    const { tickets, receipts } = readerService.getReaderHistory(reader.id);

    res.render('portal/index', {
      title: 'Cổng Thông Tin Độc Giả',
      reader,
      activeBorrows,
      reservations,
      tickets,
      receipts
    });
  }

  reserveBook(req, res) {
    const user = req.session.user;
    const { book_id, note } = req.body;

    if (!user || user.role !== 'reader' || !user.reader_id) {
      req.flash('error', 'Vui lòng đăng nhập bằng tài khoản độc giả để đặt mượn sách.');
      return res.redirect(`/books/${book_id}`);
    }

    try {
      reservationService.createReservation(user.reader_id, Number(book_id), note);
      req.flash('success', 'Đã gửi yêu cầu đặt trước sách thành công! Thủ thư sẽ xử lý đơn của bạn.');
      res.redirect('/portal');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${book_id}`);
    }
  }

  cancelReservation(req, res) {
    try {
      reservationService.updateStatus(req.params.id, 'cancelled');
      req.flash('success', 'Đã hủy yêu cầu đặt trước sách.');
      res.redirect('/portal');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/portal');
    }
  }
}

module.exports = new PortalController;
