const ruleService = require('../services/ruleService');
const bookService = require('../services/bookService');
const readerService = require('../services/readerService');

class RuleController {
  async index(req, res) {
    const [rules, categories, readerTypes] = await Promise.all([
      ruleService.getAllRules(),
      bookService.getCategories(),
      readerService.getReaderTypes()
    ]);

    res.render('rules/index', {
      title: 'Quản lý Quy định Thư viện',
      rules,
      categories,
      readerTypes
    });
  }

  async update(req, res) {
    try {
      await ruleService.updateManyRules(req.body);
      req.flash('success', 'Đã cập nhật toàn bộ quy định hệ thống thành công!');
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/rules');
    }
  }

  async addCategory(req, res) {
    const { code, name, description } = req.body;
    try {
      await bookService.createCategory(code, name, description);
      req.flash('success', `Đã thêm thể loại mới: ${name} (${code})!`);
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', 'Lỗi thêm thể loại: ' + err.message);
      res.redirect('/rules');
    }
  }

  async addReaderType(req, res) {
    const { code, name, max_borrow_limit } = req.body;
    try {
      await readerService.createReaderType({ code, name, max_borrow_limit });
      req.flash('success', `Đã thêm loại độc giả mới: ${name} (${code})!`);
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', 'Lỗi thêm loại độc giả: ' + err.message);
      res.redirect('/rules');
    }
  }
}

module.exports = new RuleController();
