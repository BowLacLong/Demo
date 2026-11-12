const borrowService = require('../services/borrowService');
const readerService = require('../services/readerService');
const bookService = require('../services/bookService');
const ruleService = require('../services/ruleService');
const { exportToExcel } = require('../utils/excelExport');

class BorrowController {
  async index(req, res) {
    const { search, status, reader_id } = req.query;
    const tickets = await borrowService.getAllTickets({
      search,
      status,
      readerId: reader_id
    });

    res.render('borrow/index', {
      title: 'Quản lý Mượn Sách',
      tickets,
      filters: { search, status, reader_id }
    });
  }

  async showCreate(req, res) {
    const { reader_id } = req.query;
    const readers = await readerService.getAllReaders({ status: 'active' });
    const availableCopies = await bookService.getAvailableCopies();
    const rules = await ruleService.getRulesMap();

    let selectedReader = null;
    let eligibility = null;

    if (reader_id) {
      selectedReader = await readerService.getReaderById(reader_id);
      if (selectedReader) {
        eligibility = await ruleService.validateBorrowEligibility(selectedReader.id, 1);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDueDate = new Date(Date.now() + (rules.max_borrow_days || 14) * 86400000)
      .toISOString()
      .split('T')[0];

    res.render('borrow/create', {
      title: 'Lập phiếu mượn sách',
      readers,
      selectedReader,
      eligibility,
      availableCopies,
      rules,
      todayStr,
      defaultDueDate
    });
  }

  async create(req, res) {
    const { reader_id, copy_ids, borrow_date, note } = req.body;

    try {
      const copyIdArray = Array.isArray(copy_ids) ? copy_ids : (copy_ids ? [copy_ids] : []);
      const ticket = await borrowService.createBorrowTicket({
        readerId: Number(reader_id),
        copyIds: copyIdArray.map(Number),
        userId: req.session.user ? req.session.user.id : null,
        borrowDate: borrow_date,
        note
      });

      req.flash('success', `Đã lập phiếu mượn ${ticket.ticket_code} thành công với ${copyIdArray.length} cuốn sách!`);
      res.redirect(`/borrow/${ticket.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/borrow/create?reader_id=${reader_id}`);
    }
  }

  async showDetail(req, res) {
    const ticket = await borrowService.getTicketById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Không tìm thấy phiếu mượn.');
      return res.redirect('/borrow');
    }

    res.render('borrow/detail', {
      title: `Phiếu mượn: ${ticket.ticket_code}`,
      ticket
    });
  }

  async showReturn(req, res) {
    const ticket = await borrowService.getTicketById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Không tìm thấy phiếu mượn.');
      return res.redirect('/borrow');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const fineCalc = await ruleService.calculateFine(ticket.due_date, todayStr);

    res.render('borrow/return', {
      title: `Nhận trả sách - Phiếu ${ticket.ticket_code}`,
      ticket,
      todayStr,
      fineCalc
    });
  }

  async processReturn(req, res) {
    const { return_date } = req.body;
    try {
      // Mỗi cuốn sách được gửi lên theo bộ khoá phẳng: item_<detailId>_selected / _status / _damage_fee / _damage_note.
      // Không dùng items[<id>][...] vì bộ parse qs sẽ biến khoá số thành mảng và làm mất detailId.
      const itemsToReturn = [];
      for (const [key, value] of Object.entries(req.body)) {
        const matched = /^item_(\d+)_selected$/.exec(key);
        if (!matched) continue;
        if (value !== 'on' && value !== '1' && value !== 'true' && value !== true) continue;

        const detailId = Number(matched[1]);
        itemsToReturn.push({
          detailId,
          status: req.body[`item_${detailId}_status`] || 'returned',
          damageFee: Number(req.body[`item_${detailId}_damage_fee`]) || 0,
          damageNote: req.body[`item_${detailId}_damage_note`] || ''
        });
      }

      if (itemsToReturn.length === 0) {
        req.flash('error', 'Vui lòng chọn ít nhất 1 cuốn sách để hoàn trả.');
        return res.redirect(`/borrow/${req.params.id}/return`);
      }

      const result = await borrowService.returnBooks(
        req.params.id,
        itemsToReturn,
        return_date,
        req.session.user ? req.session.user.id : null
      );

      let msg = `Đã nhận trả ${itemsToReturn.length} cuốn sách thành công!`;
      if (result.totalFineAdded > 0) {
        msg += ` Phát sinh tiền phạt: ${result.totalFineAdded.toLocaleString('vi-VN')} VNĐ (Đã ghi vào nợ độc giả).`;
      }
      req.flash('success', msg);
      res.redirect(`/borrow/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/borrow/${req.params.id}/return`);
    }
  }

  async extend(req, res) {
    const { extra_days } = req.body;
    try {
      const ticket = await borrowService.extendTicket(req.params.id, Number(extra_days) || 7);
      req.flash('success', `Đã gia hạn mượn sách thành công! Hạn trả mới: ${ticket.due_date}`);
      res.redirect(`/borrow/${ticket.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/borrow/${req.params.id}`);
    }
  }

  async overdueList(req, res) {
    const overdueTickets = await borrowService.getOverdueTickets();
    res.render('borrow/overdue', {
      title: 'Danh sách phiếu mượn quá hạn',
      overdueTickets
    });
  }

  async exportExcel(req, res) {
    const tickets = await borrowService.getAllTickets();
    const exportData = tickets.map((t, idx) => ({
      STT: idx + 1,
      'Mã Phiếu': t.ticket_code,
      'Mã Độc Giả': t.reader_code,
      'Tên Độc Giả': t.reader_name,
      'Số ĐT': t.reader_phone || '',
      'Ngày Mượn': t.borrow_date,
      'Hạn Trả': t.due_date,
      'Số Sách Mượn': t.total_items,
      'Số Sách Đang Giữ': t.active_items,
      'Trạng Thái': t.status,
      'Quá Hạn?': t.is_overdue ? 'CÓ' : 'Không'
    }));

    exportToExcel(res, exportData, 'DanhSachPhieuMuon', 'Danh_Sach_Phieu_Muon');
  }
}

module.exports = new BorrowController();
