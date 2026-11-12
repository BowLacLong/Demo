const request = require('supertest');
const app = require('../src/app');
const { resetDatabase, disconnect } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');

beforeAll(async () => {
  await resetDatabase();
  await seedDatabase();
}, 60000);

afterAll(async () => {
  await disconnect();
});

describe('Kiểm thử RESTful API Thư Viện', () => {
  test('GET /api/books - Danh sách sách trả về thành công', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });

  test('GET /api/books/:id - Xem chi tiết sách', async () => {
    const res = await request(app).get('/api/books/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(Array.isArray(res.body.data.copies)).toBe(true);
  });

  test('GET /api/readers - Danh sách độc giả', async () => {
    const res = await request(app).get('/api/readers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/rules - Danh sách các tham số quy định hệ thống', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some(r => r.key === 'min_reader_age')).toBe(true);
  });

  test('GET /api/stats - Thống kê số liệu dashboard', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalBooks).toBeGreaterThan(0);
  });
});
