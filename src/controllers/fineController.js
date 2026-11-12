const fineService = require('../services/fineService');
const readerService = require('../services/readerService');
const { exportToExcel } = require('../utils/excelExport');

class FineController {
  async index(req, res) {
    const { search, reader_id } = req.query;
    const receipts = await fineService.getAllReceipts({ search, readerId: reader_id });

    res.render('fines/index', {
      title: 'Quản lý Thu Tiền Phạt',
      receipts,
      filters: { search, reader_id }
    });
  }

  async showCreate(req, res) {
    const { reader_id } = req.query;
    const debtors = await fineService.getDebtors();

    let selectedReader = null;
    if (reader_id) {
      selectedReader = await readerService.getReaderById(reader_id);
    }

    res.render('fines/create', {
      title: 'Lập phiếu thu tiền phạt',
      debtors,
      selectedReader
    });
  }

  async create(req, res) {
    const { reader_id, collected_amount, note } = req.body;

    try {
      const receipt = await fineService.createReceipt({
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

  async showDetail(req, res) {
    const receipt = await fineService.getReceiptById(req.params.id);
    if (!receipt) {
      req.flash('error', 'Không tìm thấy phiếu thu.');
      return res.redirect('/fines');
    }

    res.render('fines/detail', {
      title: `Phiếu thu: ${receipt.receipt_code}`,
      receipt
    });
  }

  async printReceipt(req, res) {
    const receipt = await fineService.getReceiptById(req.params.id);
    if (!receipt) {
      req.flash('error', 'Không tìm thấy phiếu thu.');
      return res.redirect('/fines');
    }

    res.render('fines/print', {
      layout: false, // print-only standalone layout
      receipt
    });
  }

  async exportExcel(req, res) {
    const receipts = await fineService.getAllReceipts();
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
