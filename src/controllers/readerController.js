const readerService = require('../services/readerService');
const ruleService = require('../services/ruleService');
const { exportToExcel } = require('../utils/excelExport');

class ReaderController {
  index(req, res) {
    const { search, type_id, status } = req.query;
    const readers = readerService.getAllReaders({
      search,
      typeId: type_id,
      status
    });

    const readerTypes = readerService.getReaderTypes();

    res.render('readers/index', {
      title: 'Quản lý Độc giả & Thẻ thư viện',
      readers,
      readerTypes,
      filters: { search, type_id, status }
    });
  }

  showCreate(req, res) {
    const readerTypes = readerService.getReaderTypes();
    const minAge = ruleService.getRule('min_reader_age', 18);
    const maxAge = ruleService.getRule('max_reader_age', 55);
    const cardMonths = ruleService.getRule('card_valid_months', 6);

    const today = new Date();
    const maxDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDob = new Date(today.getFullYear() - maxAge - 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    res.render('readers/create', {
      title: 'Lập thẻ độc giả mới',
      readerTypes,
      minAge,
      maxAge,
      cardMonths,
      minDob,
      maxDob,
      todayStr: today.toISOString().split('T')[0]
    });
  }

  create(req, res) {
    try {
      const newReader = readerService.createReader(req.body);
      req.flash('success', `Đã lập thẻ độc giả thành công! Mã thẻ: ${newReader.reader_code}`);
      res.redirect(`/readers/${newReader.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/readers/create');
    }
  }

  showDetail(req, res) {
    const reader = readerService.getReaderById(req.params.id);
    if (!reader) {
      req.flash('error', 'Không tìm thấy độc giả.');
      return res.redirect('/readers');
    }

    const { tickets, receipts } = readerService.getReaderHistory(reader.id);

    res.render('readers/detail', {
      title: `Thẻ độc giả: ${reader.fullname}`,
      reader,
      tickets,
      receipts
    });
  }

  showEdit(req, res) {
    const reader = readerService.getReaderById(req.params.id);
    if (!reader) {
      req.flash('error', 'Không tìm thấy độc giả.');
      return res.redirect('/readers');
    }

    const readerTypes = readerService.getReaderTypes();
    const minAge = ruleService.getRule('min_reader_age', 18);
    const maxAge = ruleService.getRule('max_reader_age', 55);

    res.render('readers/edit', {
      title: `Chỉnh sửa thẻ: ${reader.fullname}`,
      reader,
      readerTypes,
      minAge,
      maxAge
    });
  }

  update(req, res) {
    try {
      readerService.updateReader(req.params.id, req.body);
      req.flash('success', 'Cập nhật thông tin thẻ độc giả thành công!');
      res.redirect(`/readers/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/readers/${req.params.id}/edit`);
    }
  }

  extend(req, res) {
    const { months } = req.body;
    try {
      const reader = readerService.extendCard(req.params.id, Number(months) || 6);
      req.flash('success', `Đã gia hạn thẻ độc giả thành công đến ngày ${reader.expiry_date}!`);
      res.redirect(`/readers/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/readers/${req.params.id}`);
    }
  }

  delete(req, res) {
    try {
      readerService.deleteReader(req.params.id);
      req.flash('success', 'Đã xoá thẻ độc giả thành công.');
      res.redirect('/readers');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/readers/${req.params.id}`);
    }
  }

  exportExcel(req, res) {
    const readers = readerService.getAllReaders();
    const exportData = readers.map((r, idx) => ({
      STT: idx + 1,
      'Mã Độc Giả': r.reader_code,
      'Họ và Tên': r.fullname,
      'Ngày Sinh': r.date_of_birth,
      'Loại Độc Giả': r.type_name,
      'Địa Chỉ': r.address,
      'Email': r.email,
      'Điện Thoại': r.phone || '',
      'Ngày Lập Thẻ': r.created_date,
      'Hạn Sử Dụng': r.expiry_date,
      'Tổng Nợ Phạt': r.total_debt,
      'Đang Mượn': r.currently_borrowing,
      'Trạng Thái': r.status === 'active' ? 'Hoạt động' : 'Hết hạn/Khóa'
    }));

    exportToExcel(res, exportData, 'DanhSachDocGia', 'Danh_Sach_Doc_Gia');
  }
}

module.exports = new ReaderController();
