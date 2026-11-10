const ruleService = require('../src/services/ruleService');
const seedDatabase = require('../src/config/seed');

beforeAll(() => {
  seedDatabase();
});

describe('Kiểm thử các Quy định Nghiệp vụ (QĐ1 -> QĐ5) - Môn TKPM', () => {
  describe('[Quy định 1 - QĐ1] Tiếp nhận sách mới', () => {
    test('Cho phép sách xuất bản trong khoảng N năm quy định (mặc định 8 năm)', () => {
      const curYear = new Date().getFullYear();
      const check = ruleService.validateBookEntry(curYear - 3);
      expect(check.valid).toBe(true);
    });

    test('Từ chối sách xuất bản quá N năm quy định (ví dụ 10 năm trước)', () => {
      const curYear = new Date().getFullYear();
      const check = ruleService.validateBookEntry(curYear - 10);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('QĐ1 vi phạm');
    });

    test('Từ chối sách có năm xuất bản lớn hơn năm hiện tại', () => {
      const curYear = new Date().getFullYear();
      const check = ruleService.validateBookEntry(curYear + 2);
      expect(check.valid).toBe(false);
    });
  });

  describe('[Quy định 2 - QĐ2] Lập thẻ độc giả', () => {
    test('Chấp nhận độc giả trong độ tuổi từ 18 đến 55 tuổi', () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 20}-01-01`;
      const check = ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(true);
      expect(check.age).toBe(20);
    });

    test('Từ chối độc giả dưới 18 tuổi', () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 15}-01-01`;
      const check = ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('QĐ2 vi phạm');
    });

    test('Từ chối độc giả trên 55 tuổi', () => {
      const curYear = new Date().getFullYear();
      const dob = `${curYear - 60}-01-01`;
      const check = ruleService.validateReaderAge(dob);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('QĐ2 vi phạm');
    });

    test('Tính đúng thời hạn thẻ độc giả (+6 tháng theo QĐ2)', () => {
      const expiry = ruleService.calculateExpiryDate('2026-01-01');
      expect(expiry).toBe('2026-07-01');
    });
  });

  describe('[Quy định 4 - QĐ4] Tính tiền phạt trả sách trễ hạn', () => {
    test('Không phạt nếu trả đúng hạn', () => {
      const res = ruleService.calculateFine('2026-05-20', '2026-05-18');
      expect(res.overdueDays).toBe(0);
      expect(res.fineAmount).toBe(0);
    });

    test('Tính đúng tiền phạt khi trả trễ hạn (1.000 VNĐ / ngày)', () => {
      const res = ruleService.calculateFine('2026-05-10', '2026-05-15');
      expect(res.overdueDays).toBe(5);
      expect(res.fineAmount).toBe(5000);
    });
  });

  describe('[Quy định 5 - QĐ5] Thu tiền phạt', () => {
    test('Từ chối thu số tiền lớn hơn tổng nợ của độc giả', () => {
      // Reader DG0002 has total_debt = 15.000 VNĐ in seed
      const check = ruleService.validateFineCollection(2, 20000);
      expect(check.valid).toBe(false);
      expect(check.message).toContain('QĐ5 vi phạm');
    });

    test('Chấp nhận thu số tiền nhỏ hơn hoặc bằng tổng nợ', () => {
      const check = ruleService.validateFineCollection(2, 10000);
      expect(check.valid).toBe(true);
      expect(check.remainingDebt).toBe(5000);
    });
  });
});
