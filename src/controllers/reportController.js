const reportService = require('../services/reportService');
const { exportToExcel } = require('../utils/excelExport');

class ReportController {
  async categoryReport(req, res) {
    const today = new Date();
    const month = req.query.month || (today.getMonth() + 1);
    const year = req.query.year || today.getFullYear();

    const report = await reportService.getMonthlyBorrowByCategory(month, year);

    res.render('reports/categories', {
      title: 'Báo cáo mượn sách theo thể loại',
      report,
      selectedMonth: Number(month),
      selectedYear: Number(year)
    });
  }

  async overdueReport(req, res) {
    const today = new Date().toISOString().split('T')[0];
    const date = req.query.date || today;

    const report = await reportService.getOverdueReport(date);

    res.render('reports/overdue', {
      title: 'Báo cáo thống kê sách trả trễ',
      report,
      selectedDate: date
    });
  }

  async exportCategoryExcel(req, res) {
    const month = req.query.month || (new Date().getMonth() + 1);
    const year = req.query.year || new Date().getFullYear();
    const report = await reportService.getMonthlyBorrowByCategory(month, year);

    const exportData = report.categories.map((c, idx) => ({
      STT: idx + 1,
      'Mã Thể Loại': c.code,
      'Tên Thể Loại': c.category_name,
      'Số Lượt Mượn': c.borrow_count,
      'Tỉ Lệ (%)': `${c.percentage}%`
    }));

    exportToExcel(res, exportData, `BaoCaoTheLoai_T${month}_${year}`, `Bao_Cao_Muon_The_Loai_Thang_${month}_${year}`);
  }

  async exportOverdueExcel(req, res) {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const report = await reportService.getOverdueReport(date);

    const exportData = report.items.map((item, idx) => ({
      STT: idx + 1,
      'Mã Phiếu Mượn': item.ticket_code,
      'Mã Vạch Sách': item.barcode,
      'Tên Sách': item.book_title,
      'Tên Độc Giả': item.reader_name,
      'Mã Độc Giả': item.reader_code,
      'Điện Thoại': item.reader_phone || '',
      'Ngày Mượn': item.borrow_date,
      'Hạn Trả': item.due_date,
      'Số Ngày Trễ': item.overdue_days
    }));

    exportToExcel(res, exportData, `BaoCaoTraTre_${date}`, `Bao_Cao_Sach_Tra_Tre_${date}`);
  }
}

module.exports = new ReportController();
