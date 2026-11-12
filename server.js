const app = require('./src/app');
const { connect, disconnect, MONGO_URI, DB_NAME } = require('./src/config/db');
const seedDatabase = require('./src/config/seed');

const PORT = process.env.PORT || 3000;

async function start() {
  await connect();
  console.log(`Đã kết nối MongoDB: ${MONGO_URI} (database: ${DB_NAME})`);

  // Seed initial data if database is empty
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu mẫu:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log('====================================================');
    console.log('🚀 HỆ THỐNG QUẢN LÝ THƯ VIỆN ĐANG CHẠY!');
    console.log(`🌐 Địa chỉ truy cập: http://localhost:${PORT}`);
    console.log('🔑 Tài khoản mẫu:');
    console.log('   - Admin:      admin / admin123');
    console.log('   - Thủ thư:    thuthu01 / thuthu123');
    console.log('   - Độc giả:    docgia01 / docgia123');
    console.log('====================================================');
  });

  const shutdown = (signal) => {
    console.log(`\nNhận tín hiệu ${signal}, đang đóng kết nối...`);
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

start().catch((err) => {
  console.error('❌ Không kết nối được MongoDB:', err.message);
  console.error('   Kiểm tra dịch vụ MongoDB đang chạy và biến môi trường MONGODB_URI.');
  process.exit(1);
});
