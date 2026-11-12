const readerService = require('../services/readerService');
const reservationService = require('../services/reservationService');

class PortalController {
  async index(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'reader' || !user.reader_id) {
      req.flash('error', 'Chỉ tài khoản độc giả mới có thể truy cập cổng cá nhân.');
      return res.redirect('/dashboard');
    }

    const reader = await readerService.getReaderById(user.reader_id);
    if (!reader) {
      req.flash('error', 'Hồ sơ độc giả liên kết không tồn tại.');
      return res.redirect('/books');
    }

    const activeBorrows = await readerService.getActiveBorrows(reader.id);
    const reservations = await reservationService.getAllReservations({ readerId: reader.id });
    const { tickets, receipts } = await readerService.getReaderHistory(reader.id);

    res.render('portal/index', {
      title: 'Cổng Thông Tin Độc Giả',
      reader,
      activeBorrows,
      reservations,
      tickets,
      receipts
    });
  }

  async reserveBook(req, res) {
    const user = req.session.user;
    const { book_id, note } = req.body;

    if (!user || user.role !== 'reader' || !user.reader_id) {
      req.flash('error', 'Vui lòng đăng nhập bằng tài khoản độc giả để đặt mượn sách.');
      return res.redirect(`/books/${book_id}`);
    }

    try {
      await reservationService.createReservation(user.reader_id, Number(book_id), note);
      req.flash('success', 'Đã gửi yêu cầu đặt trước sách thành công! Thủ thư sẽ xử lý đơn của bạn.');
      res.redirect('/portal');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${book_id}`);
    }
  }

  async cancelReservation(req, res) {
    const user = req.session.user;
    try {
      const reservation = await reservationService.getReservationById(req.params.id);
      if (!reservation) {
        throw new Error('Không tìm thấy yêu cầu đặt mượn này.');
      }
      if (!user || !user.reader_id || reservation.reader_id !== user.reader_id) {
        throw new Error('Bạn chỉ có thể huỷ yêu cầu đặt mượn của chính mình.');
      }
      await reservationService.updateStatus(req.params.id, 'cancelled');
      req.flash('success', 'Đã hủy yêu cầu đặt trước sách.');
      res.redirect('/portal');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/portal');
    }
  }
}

module.exports = new PortalController();
