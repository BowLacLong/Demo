const reportService = require('../services/reportService');
const ruleService = require('../services/ruleService');

class DashboardController {
  async index(req, res) {
    try {
      const stats = await reportService.getDashboardStats();
      const rules = await ruleService.getRulesMap();

      // Get monthly borrow data for the chart (current year)
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const categoryReport = await reportService.getMonthlyBorrowByCategory(currentMonth, currentYear);

      res.render('dashboard/index', {
        title: 'Bảng điều khiển - Tổng quan thư viện',
        stats,
        rules,
        categoryReport,
        currentYear,
        currentMonth
      });
    } catch (err) {
      req.flash('error', 'Lỗi tải dữ liệu bảng điều khiển: ' + err.message);
      res.render('dashboard/index', {
        title: 'Bảng điều khiển',
        stats: {},
        rules: {},
        categoryReport: { categories: [] }
      });
    }
  }
}

module.exports = new DashboardController();
