const ruleService = require('../src/services/ruleService');
const { resetDatabase, disconnect } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');

beforeAll(async () => {
  await resetDatabase();
  await seedDatabase();
}, 60000);

afterAll(async () => {
  await disconnect();
});

describe('Kiểm thử các Quy định Nghiệp vụ Thư Viện', () => {
  describe('Quy định tiếp nhận sách mới', () => {
    test('Cho phép sách xuất bản trong khoảng N năm quy định (mặc định 8 năm)', async () => {
      const curYear = new Date().getFullYear();
      const check = await ruleService.validateBookEntry(curYear - 3);
      expect(check.valid).toBe(true);
    });

    test('Từ chối sách xuất bản quá N năm quy định (ví dụ 10 năm trước)', async () => {
      const curYear = new Date().getFullYear();
      const check = await ruleService.validateBookEntry(curYear - 10);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('Chỉ nhận sách xuất bản trong vòng');
    });

    test('Từ chối sách có năm xuất bản lớn hơn năm hiện tại', async () => {
      const curYear = new Date().getFullYear();
      const check = await ruleService.validateBookEntry(curYear + 2);
      expect(check.valid).toBe(false);
    });
  });

  describe('Quy định lập thẻ độc giả', () => {
    test('Chấp nhận độc giả trong độ tuổi từ 18 đến 55 tuổi', async () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 20}-01-01`;
      const check = await ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(true);
      expect(check.age).toBe(20);
    });

    test('Từ chối độc giả dưới 18 tuổi', async () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 15}-01-01`;
      const check = await ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('Tuổi độc giả phải từ');
    });

    test('Từ chối độc giả trên 55 tuổi', async () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 60}-01-01`;
      const check = await ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('Tuổi độc giả phải từ');
    });

    test('Tính đúng thời hạn thẻ độc giả (+6 tháng)', async () => {
      const expiry = await ruleService.calculateExpiryDate('2026-01-01');
      expect(expiry).toBe('2026-07-01');
    });
  });

  describe('Quy định tính tiền phạt trả sách trễ hạn', () => {
    test('Không phạt nếu trả đúng hạn', async () => {
      const res = await ruleService.calculateFine('2026-05-20', '2026-05-18');
      expect(res.overdueDays).toBe(0);
      expect(res.fineAmount).toBe(0);
    });

    test('Tính đúng tiền phạt khi trả trễ hạn (1.000 VNĐ / ngày)', async () => {
      const res = await ruleService.calculateFine('2026-05-10', '2026-05-15');
      expect(res.overdueDays).toBe(5);
      expect(res.fineAmount).toBe(5000);
    });
  });

  describe('Quy định thu tiền phạt', () => {
    test('Từ chối thu số tiền lớn hơn tổng nợ của độc giả', async () => {
      const check = await ruleService.validateFineCollection(2, 20000);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('không được vượt quá tổng nợ');
    });

    test('Chấp nhận thu số tiền nhỏ hơn hoặc bằng tổng nợ', async () => {
      const check = await ruleService.validateFineCollection(2, 10000);
      expect(check.valid).toBe(true);
      expect(check.remainingDebt).toBe(5000);
    });
  });
});
