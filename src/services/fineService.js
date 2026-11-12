const { getDb, nextId } = require('../config/db');
const ruleService = require('./ruleService');
const { escapeRegex } = require('../utils/search');

class FineService {
  async getAllReceipts({ search = '', readerId = '', limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    const filter = {};

    if (readerId) filter.reader_id = Number(readerId);

    if (search && String(search).trim() !== '') {
      const regex = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
      const matchedReaders = await db.collection('readers')
        .find({ $or: [{ fullname: regex }, { reader_code: regex }] })
        .project({ id: 1 })
        .toArray();

      filter.$or = [
        { receipt_code: regex },
        ...(matchedReaders.length ? [{ reader_id: { $in: matchedReaders.map(r => r.id) } }] : [])
      ];
    }

    const receipts = await db.collection('fine_receipts')
      .find(filter)
      .sort({ id: -1 })
      .skip(Number(offset) || 0)
      .limit(Number(limit) || 100)
      .toArray();

    return this.attachRelations(receipts);
  }

  async attachRelations(receipts) {
    if (receipts.length === 0) return [];

    const db = await getDb();
    const readerIds = [...new Set(receipts.map(r => r.reader_id).filter(Boolean))];
    const userIds = [...new Set(receipts.map(r => r.created_by).filter(Boolean))];

    const [readers, users] = await Promise.all([
      readerIds.length ? db.collection('readers').find({ id: { $in: readerIds } }).toArray() : [],
      userIds.length ? db.collection('users').find({ id: { $in: userIds } }).project({ id: 1, fullname: 1 }).toArray() : []
    ]);

    const readerMap = new Map(readers.map(r => [r.id, r]));
    const userMap = new Map(users.map(u => [u.id, u.fullname]));

    return receipts.map(r => {
      const reader = readerMap.get(r.reader_id);
      return {
        ...r,
        reader_name: reader ? reader.fullname : null,
        reader_code: reader ? reader.reader_code : null,
        reader_phone: reader ? reader.phone : null,
        reader_email: reader ? reader.email : null,
        reader_address: reader ? reader.address : null,
        creator_name: userMap.get(r.created_by) || null
      };
    });
  }

  async getReceiptById(id) {
    const db = await getDb();
    const receipt = await db.collection('fine_receipts').findOne({ id: Number(id) });
    if (!receipt) return null;

    const [withRelations] = await this.attachRelations([receipt]);
    return withRelations;
  }

  async createReceipt({ readerId, collectedAmount, userId = null, note = '' }) {
    // 1. Kiểm tra số tiền thu không được vượt quá số tiền độc giả đang nợ
    const validation = await ruleService.validateFineCollection(readerId, collectedAmount);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const { totalDebt, collectedAmount: amount, remainingDebt } = validation;
    const db = await getDb();

    const id = await nextId('fine_receipts');
    const receiptCode = `PT${String(id).padStart(4, '0')}`;

    await db.collection('fine_receipts').insertOne({
      id,
      receipt_code: receiptCode,
      reader_id: Number(readerId),
      total_debt: totalDebt,
      collected_amount: amount,
      remaining_debt: remainingDebt,
      receipt_date: new Date().toISOString(),
      created_by: userId ? Number(userId) : null,
      note: note || ''
    });

    await db.collection('readers').updateOne(
      { id: Number(readerId) },
      { $set: { total_debt: remainingDebt } }
    );

    return this.getReceiptById(id);
  }

  /**
   * Danh sách độc giả đang nợ phạt (dùng cho form lập phiếu thu).
   */
  async getDebtors() {
    const db = await getDb();
    const readers = await db.collection('readers').find({ total_debt: { $gt: 0 } }).sort({ total_debt: -1 }).toArray();
    const types = await db.collection('reader_types').find({}).toArray();
    const typeMap = new Map(types.map(t => [t.id, t]));

    return readers.map(r => {
      const type = typeMap.get(r.reader_type_id);
      return { ...r, type_name: type ? type.name : null };
    });
  }
}

module.exports = new FineService();
