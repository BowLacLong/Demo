const borrowService = require('../services/borrowService');
const readerService = require('../services/readerService');
const bookService = require('../services/bookService');
const ruleService = require('../services/ruleService');
const db = require('../config/db');
const { exportToExcel } = require('../utils/excelExport');

class BorrowController {
  index(req, res) {
    const { search, status, reader_id } = req.query;
    const tickets = borrowService.getAllTickets({
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

  showCreate(req, res) {
    const { reader_id } = req.query;
    const readers = readerService.getAllReaders({ status: 'active' });
    
    // Get available book copies
    const availableCopies = db.prepare(`
      SELECT bc.*, b.title, b.isbn, b.cover_image, c.name as category_name
      FROM book_copies bc
      JOIN books b ON bc.book_id = b.id
      JOIN categories c ON b.category_id = c.id
      WHERE bc.status = 'available'
      ORDER BY b.title ASC, bc.barcode ASC
    `).all();

    const rules = ruleService.getRulesMap();
    let selectedReader = null;
    let eligibility = null;

    if (reader_id) {
      selectedReader = readerService.getReaderById(reader_id);
      if (selectedReader) {
        eligibility = ruleService.validateBorrowEligibility(selectedReader.id, 1);
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const defaultDueDate = new Date(Date.now() + (rules.max_borrow_days || 14) * 86400000).toISOString().split('T')[0];

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

  create(req, res) {
    const { reader_id, copy_ids, borrow_date, note } = req.body;

    try {
      const copyIdArray = Array.isArray(copy_ids) ? copy_ids : (copy_ids ? [copy_ids] : []);
      const ticket = borrowService.createBorrowTicket({
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

  showDetail(req, res) {
    const ticket = borrowService.getTicketById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Không tìm thấy phiếu mượn.');
      return res.redirect('/borrow');
    }

    res.render('borrow/detail', {
      title: `Phiếu mượn: ${ticket.ticket_code}`,
      ticket
    });
  }

  showReturn(req, res) {
    const ticket = borrowService.getTicketById(req.params.id);
    if (!ticket) {
      req.flash('error', 'Không tìm thấy phiếu mượn.');
      return res.redirect('/borrow');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const fineCalc = ruleService.calculateFine(ticket.due_date, todayStr);

    res.render('borrow/return', {
      title: `Nhận trả sách - Phiếu ${ticket.ticket_code}`,
      ticket,
      todayStr,
      fineCalc
    });
  }

  processReturn(req, res) {
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

      const result = borrowService.returnBooks(
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

  extend(req, res) {
    const { extra_days } = req.body;
    try {
      const ticket = borrowService.extendTicket(req.params.id, Number(extra_days) || 7);
      req.flash('success', `Đã gia hạn mượn sách thành công! Hạn trả mới: ${ticket.due_date}`);
      res.redirect(`/borrow/${ticket.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/borrow/${req.params.id}`);
    }
  }

  overdueList(req, res) {
    const overdueTickets = borrowService.getOverdueTickets();
    res.render('borrow/overdue', {
      title: 'Danh sách phiếu mượn quá hạn',
      overdueTickets
    });
  }

  exportExcel(req, res) {
    const tickets = borrowService.getAllTickets();
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
