const userService = require('../services/userService');
const readerService = require('../services/readerService');

class UserController {
  index(req, res) {
    const users = userService.getAllUsers();
    const readers = readerService.getAllReaders();

    res.render('users/index', {
      title: 'Quản lý Người dùng & Phân quyền',
      users,
      readers
    });
  }

  create(req, res) {
    try {
      userService.createUser(req.body);
      req.flash('success', `Đã tạo tài khoản "${req.body.username}" thành công!`);
      res.redirect('/users');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/users');
    }
  }

  update(req, res) {
    try {
      userService.updateUser(req.params.id, req.body);
      req.flash('success', 'Cập nhật tài khoản thành công!');
      res.redirect('/users');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/users');
    }
  }

  resetPassword(req, res) {
    try {
      userService.resetPassword(req.params.id, '123456');
      req.flash('success', 'Đã đặt lại mật khẩu về mặc định: 123456');
      res.redirect('/users');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/users');
    }
  }

  delete(req, res) {
    try {
      userService.deleteUser(req.params.id);
      req.flash('success', 'Đã xoá tài khoản thành công.');
      res.redirect('/users');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/users');
    }
  }
}

module.exports = new UserController();
