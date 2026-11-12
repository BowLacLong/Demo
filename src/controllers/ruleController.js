const ruleService = require('../services/ruleService');
const bookService = require('../services/bookService');
const readerService = require('../services/readerService');
const db = require('../config/db');

class RuleController {
  index(req, res) {
    const rules = ruleService.getAllRules();
    const categories = bookService.getCategories();
    const readerTypes = readerService.getReaderTypes();

    res.render('rules/index', {
      title: 'Quản lý Quy định Thư viện',
      rules,
      categories,
      readerTypes
    });
  }

  update(req, res) {
    try {
      const updates = req.body;
      ruleService.updateManyRules(updates);
      req.flash('success', 'Đã cập nhật toàn bộ quy định hệ thống thành công!');
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/rules');
    }
  }

  addCategory(req, res) {
    const { code, name, description } = req.body;
    try {
      bookService.createCategory(code, name, description);
      req.flash('success', `Đã thêm thể loại mới: ${name} (${code})!`);
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', 'Lỗi thêm thể loại: ' + err.message);
      res.redirect('/rules');
    }
  }

  addReaderType(req, res) {
    const { code, name, max_borrow_limit } = req.body;
    try {
      db.prepare('INSERT INTO reader_types (code, name, max_borrow_limit) VALUES (?, ?, ?)')
        .run(code.trim().toUpperCase(), name.trim(), Number(max_borrow_limit) || 5);
      req.flash('success', `Đã thêm loại độc giả mới: ${name} (${code})!`);
      res.redirect('/rules');
    } catch (err) {
      req.flash('error', 'Lỗi thêm loại độc giả: ' + err.message);
      res.redirect('/rules');
    }
  }
}

module.exports = new RuleController();
