const app = require('./src/app');
const seedDatabase = require('./src/config/seed');

const PORT = process.env.PORT || 3000;

// Seed initial data if database is empty
try {
  seedDatabase();
} catch (err) {
  console.error('Lỗi khi nạp dữ liệu mẫu:', err.message);
}

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 HỆ THỐNG QUẢN LÝ THƯ VIỆN ĐANG CHẠY!`);
  console.log(`🌐 Địa chỉ truy cập: http://localhost:${PORT}`);
  console.log(`🔑 Tài khoản mẫu:`);
  console.log(`   - Admin:      admin / admin123`);
  console.log(`   - Thủ thư:    thuthu01 / thuthu123`);
  console.log(`   - Độc giả:    docgia01 / docgia123`);
  console.log('====================================================');
});
