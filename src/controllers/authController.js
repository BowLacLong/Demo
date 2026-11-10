const userService = require('../services/userService');

class AuthController {
  showLogin(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('auth/login', {
      title: 'Đăng nhập hệ thống'
    });
  }

  login(req, res) {
    const { username, password } = req.body;
    try {
      const user = userService.authenticate(username, password);
      if (!user) {
        req.flash('error', 'Tên đăng nhập hoặc mật khẩu không chính xác.');
        return res.redirect('/login');
      }

      req.session.user = user;
      req.flash('success', `Chào mừng ${user.fullname} đã đăng nhập thành công!`);

      if (user.role === 'reader') {
        return res.redirect('/books');
      }
      return res.redirect('/dashboard');
    } catch (err) {
      req.flash('error', err.message);
      return res.redirect('/login');
    }
  }

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }

  showProfile(req, res) {
    const user = userService.getUserById(req.session.user.id);
    res.render('auth/profile', {
      title: 'Hồ sơ cá nhân',
      user
    });
  }

  changePassword(req, res) {
    const { old_password, new_password, confirm_password } = req.body;

    if (new_password !== confirm_password) {
      req.flash('error', 'Mật khẩu xác nhận không khớp.');
      return res.redirect('/profile');
    }

    try {
      userService.changePassword(req.session.user.id, old_password, new_password);
      req.flash('success', 'Đổi mật khẩu thành công!');
      return res.redirect('/profile');
    } catch (err) {
      req.flash('error', err.message);
      return res.redirect('/profile');
    }
  }
}

module.exports = new AuthController();
