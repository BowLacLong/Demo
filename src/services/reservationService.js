const { getDb, nextId } = require('../config/db');

class ReservationService {
  async getAllReservations({ status = '', readerId = '' } = {}) {
    const db = await getDb();
    const filter = {};

    if (status) filter.status = status;
    if (readerId) filter.reader_id = Number(readerId);

    const reservations = await db.collection('book_reservations').find(filter).sort({ id: -1 }).toArray();
    if (reservations.length === 0) return [];

    const bookIds = [...new Set(reservations.map(r => r.book_id))];
    const readerIds = [...new Set(reservations.map(r => r.reader_id))];

    const [books, readers, categories] = await Promise.all([
      bookIds.length ? db.collection('books').find({ id: { $in: bookIds } }).toArray() : [],
      readerIds.length ? db.collection('readers').find({ id: { $in: readerIds } }).toArray() : [],
      db.collection('categories').find({}).toArray()
    ]);

    const bookMap = new Map(books.map(b => [b.id, b]));
    const readerMap = new Map(readers.map(r => [r.id, r]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    return reservations.map(r => {
      const book = bookMap.get(r.book_id);
      const reader = readerMap.get(r.reader_id);
      const category = book ? categoryMap.get(book.category_id) : null;

      return {
        ...r,
        book_title: book ? book.title : null,
        cover_image: book ? book.cover_image : null,
        available_copies: book ? (book.available_copies || 0) : 0,
        total_copies: book ? (book.total_copies || 0) : 0,
        category_name: category ? category.name : null,
        reader_name: reader ? reader.fullname : null,
        reader_code: reader ? reader.reader_code : null,
        reader_phone: reader ? reader.phone : null,
        reader_email: reader ? reader.email : null
      };
    });
  }

  async getReservationById(id) {
    const db = await getDb();
    const reservation = await db.collection('book_reservations').findOne({ id: Number(id) });
    if (!reservation) return null;

    const book = await db.collection('books').findOne({ id: reservation.book_id });
    const reader = await db.collection('readers').findOne({ id: reservation.reader_id });

    return {
      ...reservation,
      book_title: book ? book.title : null,
      cover_image: book ? book.cover_image : null,
      available_copies: book ? (book.available_copies || 0) : 0,
      total_copies: book ? (book.total_copies || 0) : 0,
      reader_name: reader ? reader.fullname : null,
      reader_code: reader ? reader.reader_code : null,
      reader_phone: reader ? reader.phone : null
    };
  }

  async createReservation(readerId, bookId, note = '') {
    const db = await getDb();
    const reader = await db.collection('readers').findOne({ id: Number(readerId) });
    if (!reader) throw new Error('Không tìm thấy thông tin độc giả.');

    const todayStr = new Date().toISOString().split('T')[0];
    if (!reader.expiry_date || reader.expiry_date < todayStr || reader.status !== 'active') {
      throw new Error('Thẻ độc giả của bạn đã hết hạn hoặc bị tạm ngưng, không thể đặt sách online.');
    }

    const book = await db.collection('books').findOne({ id: Number(bookId) });
    if (!book) throw new Error('Không tìm thấy sách cần đặt mượn.');

    // Mỗi độc giả chỉ có 1 yêu cầu đang chờ cho mỗi cuốn sách
    const existing = await db.collection('book_reservations').findOne({
      reader_id: Number(readerId),
      book_id: Number(bookId),
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      throw new Error('Bạn đã có một yêu cầu đặt trước cho cuốn sách này đang chờ xử lý.');
    }

    const id = await nextId('book_reservations');
    await db.collection('book_reservations').insertOne({
      id,
      reader_id: Number(readerId),
      book_id: Number(bookId),
      reserve_date: new Date().toISOString(),
      status: 'pending',
      note: note || ''
    });

    return this.getReservationById(id);
  }

  async updateStatus(id, newStatus) {
    const allowed = ['pending', 'approved', 'fulfilled', 'cancelled', 'expired'];
    if (!allowed.includes(newStatus)) {
      throw new Error('Trạng thái không hợp lệ.');
    }

    const db = await getDb();
    const reservation = await db.collection('book_reservations').findOne({ id: Number(id) });
    if (!reservation) {
      throw new Error('Không tìm thấy yêu cầu đặt mượn này.');
    }

    await db.collection('book_reservations').updateOne(
      { id: Number(id) },
      { $set: { status: newStatus } }
    );

    return this.getReservationById(id);
  }
}

module.exports = new ReservationService();
