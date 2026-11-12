const { getDb, nextId } = require('../config/db');
const bcrypt = require('bcryptjs');

class UserService {
  async authenticate(username, password) {
    const db = await getDb();
    const user = await db.collection('users').findOne({ username: String(username || '').trim() });
    if (!user) return null;
    if (!user.is_active) {
      throw new Error('Tài khoản này đã bị vô hiệu hóa.');
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return null;

    let reader = null;
    if (user.role === 'reader' && user.reader_id) {
      reader = await db.collection('readers').findOne({ id: user.reader_id });
    }

    const { password: _ignored, ...userWithoutPass } = user;
    return { ...userWithoutPass, reader };
  }

  async getAllUsers() {
    const db = await getDb();
    const users = await db.collection('users').find({}).sort({ id: 1 }).toArray();
    return this.attachReaders(users);
  }

  async getUserById(id) {
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: Number(id) });
    if (!user) return null;

    const { password: _ignored, ...userWithoutPass } = user;
    const [withReader] = await this.attachReaders([userWithoutPass]);
    return withReader;
  }

  async attachReaders(users) {
    const db = await getDb();
    const readerIds = users.map(u => u.reader_id).filter(Boolean);
    const readers = readerIds.length
      ? await db.collection('readers').find({ id: { $in: readerIds } }).toArray()
      : [];
    const readerMap = new Map(readers.map(r => [r.id, r]));

    return users.map(u => {
      const reader = u.reader_id ? readerMap.get(u.reader_id) : null;
      return {
        ...u,
        reader_code: reader ? reader.reader_code : null,
        linked_reader_name: reader ? reader.fullname : null
      };
    });
  }

  async createUser({ username, password, fullname, email, role, reader_id = null }) {
    const db = await getDb();
    const trimmedUsername = String(username || '').trim();

    const existing = await db.collection('users').findOne({ username: trimmedUsername });
    if (existing) {
      throw new Error(`Tên đăng nhập "${trimmedUsername}" đã tồn tại trên hệ thống.`);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = await nextId('users');

    await db.collection('users').insertOne({
      id,
      username: trimmedUsername,
      password: hashedPassword,
      fullname: String(fullname || '').trim(),
      email: email ? String(email).trim() : null,
      role,
      reader_id: reader_id ? Number(reader_id) : null,
      is_active: 1,
      created_at: new Date()
    });

    return this.getUserById(id);
  }

  async updateUser(id, { fullname, email, role, is_active }) {
    const db = await getDb();
    await db.collection('users').updateOne(
      { id: Number(id) },
      {
        $set: {
          fullname: String(fullname || '').trim(),
          email: email ? String(email).trim() : null,
          role,
          is_active: is_active !== undefined ? Number(is_active) : 1
        }
      }
    );

    return this.getUserById(id);
  }

  async changePassword(id, oldPassword, newPassword) {
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: Number(id) });
    if (!user) throw new Error('Người dùng không tồn tại.');

    const isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) throw new Error('Mật khẩu hiện tại không chính xác.');

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.collection('users').updateOne({ id: Number(id) }, { $set: { password: hashedPassword } });
    return true;
  }

  async resetPassword(id, newPassword = '123456') {
    const db = await getDb();
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.collection('users').updateOne({ id: Number(id) }, { $set: { password: hashedPassword } });
    return true;
  }

  async deleteUser(id) {
    const user = await this.getUserById(id);
    if (!user) throw new Error('Người dùng không tồn tại.');
    if (user.username === 'admin') {
      throw new Error('Không thể xoá tài khoản Quản trị viên tối cao (admin)!');
    }

    const db = await getDb();
    const result = await db.collection('users').deleteOne({ id: Number(id) });
    return result.deletedCount > 0;
  }
}

module.exports = new UserService();
