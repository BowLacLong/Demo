const reservationService = require('../services/reservationService');

class ReservationController {
  async index(req, res) {
    const { status } = req.query;
    const reservations = await reservationService.getAllReservations({ status });

    res.render('reservations/index', {
      title: 'Quản Lý Đặt Mượn Sách Online',
      reservations,
      currentStatus: status || ''
    });
  }

  async updateStatus(req, res) {
    const { status } = req.body;
    try {
      await reservationService.updateStatus(req.params.id, status);
      req.flash('success', 'Đã cập nhật trạng thái yêu cầu đặt mượn sách!');
      res.redirect('/reservations');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/reservations');
    }
  }
}

module.exports = new ReservationController();
