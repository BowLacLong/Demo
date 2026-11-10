const db = require('../config/db');
const bcrypt = require('bcryptjs');

class UserService {
  authenticate(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) return null;
    if (!user.is_active) {
      throw new Error('Tài khoản này đã bị vô hiệu hóa.');
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return null;

    // Attach reader info if role is reader
    if (user.role === 'reader' && user.reader_id) {
      user.reader = db.prepare('SELECT * FROM readers WHERE id = ?').get(user.reader_id);
    }

    const { password: _, ...userWithoutPass } = user;
    return userWithoutPass;
  }

  getAllUsers() {
    return db.prepare(`
      SELECT u.id, u.username, u.fullname, u.email, u.role, u.is_active, u.created_at,
             r.reader_code, r.fullname as linked_reader_name
      FROM users u
      LEFT JOIN readers r ON u.reader_id = r.id
      ORDER BY u.id ASC
    `).all();
  }

  getUserById(id) {
    const user = db.prepare(`
      SELECT u.id, u.username, u.fullname, u.email, u.role, u.reader_id, u.is_active, u.created_at,
             r.reader_code, r.fullname as linked_reader_name
      FROM users u
      LEFT JOIN readers r ON u.reader_id = r.id
      WHERE u.id = ?
    `).get(id);

    return user;
  }

  createUser({ username, password, fullname, email, role, reader_id = null }) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      throw new Error(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống.`);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, password, fullname, email, role, reader_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const res = stmt.run(
      username.trim(),
      hashedPassword,
      fullname.trim(),
      email ? email.trim() : null,
      role,
      reader_id || null
    );

    return this.getUserById(res.lastInsertRowid);
  }

  updateUser(id, { fullname, email, role, is_active }) {
    const stmt = db.prepare(`
      UPDATE users
      SET fullname = ?, email = ?, role = ?, is_active = ?
      WHERE id = ?
    `);

    stmt.run(
      fullname.trim(),
      email ? email.trim() : null,
      role,
      is_active !== undefined ? Number(is_active) : 1,
      id
    );

    return this.getUserById(id);
  }

  changePassword(id, oldPassword, newPassword) {
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(id);
    if (!user) throw new Error('Người dùng không tồn tại.');

    const isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) throw new Error('Mật khẩu hiện tại không chính xác.');

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
    return true;
  }

  resetPassword(id, newPassword = '123456') {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
    return true;
  }

  deleteUser(id) {
    const user = this.getUserById(id);
    if (!user) throw new Error('Người dùng không tồn tại.');
    if (user.username === 'admin') {
      throw new Error('Không thể xoá tài khoản Quản trị viên tối cao (admin)!');
    }

    const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  }
}

module.exports = new UserService();
