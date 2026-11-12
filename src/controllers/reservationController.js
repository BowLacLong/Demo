const reservationService = require('../services/reservationService');

class ReservationController {
  index(req, res) {
    const { status } = req.query;
    const reservations = reservationService.getAllReservations({ status });

    res.render('reservations/index', {
      title: 'Quản Lý Đặt Mượn Sách Online',
      reservations,
      currentStatus: status || ''
    });
  }

  updateStatus(req, res) {
    const { status } = req.body;
    try {
      reservationService.updateStatus(req.params.id, status);
      req.flash('success', 'Đã cập nhật trạng thái yêu cầu đặt mượn sách!');
      res.redirect('/reservations');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/reservations');
    }
  }
}

module.exports = new ReservationController;
