const fineService = require('../services/fineService');
const readerService = require('../services/readerService');
const db = require('../config/db');
const { exportToExcel } = require('../utils/excelExport');

class FineController {
  index(req, res) {
    const { search, reader_id } = req.query;
    const receipts = fineService.getAllReceipts({ search, readerId: reader_id });

    res.render('fines/index', {
      title: 'Quản lý Thu Tiền Phạt',
      receipts,
      filters: { search, reader_id }
    });
  }

  showCreate(req, res) {
    const { reader_id } = req.query;
    // Get readers who have debt > 0
    const debtors = db.prepare(`
      SELECT r.*, rt.name as type_name
      FROM readers r
      JOIN reader_types rt ON r.reader_type_id = rt.id
      WHERE r.total_debt > 0
      ORDER BY r.total_debt DESC
    `).all();

    let selectedReader = null;
    if (reader_id) {
      selectedReader = readerService.getReaderById(reader_id);
    }

    res.render('fines/create', {
      title: 'Lập phiếu thu tiền phạt',
      debtors,
      selectedReader
    });
  }

  create(req, res) {
    const { reader_id, collected_amount, note } = req.body;

    try {
      const receipt = fineService.createReceipt({
        readerId: Number(reader_id),
        collectedAmount: Number(collected_amount),
        userId: req.session.user ? req.session.user.id : null,
        note
      });

      req.flash('success', `Đã lập phiếu thu ${receipt.receipt_code} với số tiền ${receipt.collected_amount.toLocaleString('vi-VN')} VNĐ!`);
      res.redirect(`/fines/${receipt.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/fines/create?reader_id=${reader_id}`);
    }
  }

  showDetail(req, res) {
    const receipt = fineService.getReceiptById(req.params.id);
    if (!receipt) {
      req.flash('error', 'Không tìm thấy phiếu thu.');
      return res.redirect('/fines');
    }

    res.render('fines/detail', {
      title: `Phiếu thu: ${receipt.receipt_code}`,
      receipt
    });
  }

  printReceipt(req, res) {
    const receipt = fineService.getReceiptById(req.params.id);
    if (!receipt) {
      req.flash('error', 'Không tìm thấy phiếu thu.');
      return res.redirect('/fines');
    }

    res.render('fines/print', {
      layout: false, // print-only standalone layout
      receipt
    });
  }

  exportExcel(req, res) {
    const receipts = fineService.getAllReceipts();
    const exportData = receipts.map((r, idx) => ({
      STT: idx + 1,
      'Mã Phiếu Thu': r.receipt_code,
      'Mã Độc Giả': r.reader_code,
      'Tên Độc Giả': r.reader_name,
      'Số Tiền Thu (VNĐ)': r.collected_amount,
      'Tổng Nợ Trước Thu (VNĐ)': r.total_debt,
      'Còn Lại (VNĐ)': r.remaining_debt,
      'Ngày Thu': r.receipt_date,
      'Người Thu': r.creator_name || 'Admin',
      'Ghi Chú': r.note || ''
    }));

    exportToExcel(res, exportData, 'DanhSachPhieuThu', 'Danh_Sach_Phieu_Thu_Tien_Phat');
  }
}

module.exports = new FineController();
