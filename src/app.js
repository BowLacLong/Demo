const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
require('dotenv').config();

// Ensure DB is initialized
require('./config/db');

const { attachLocals } = require('./middleware/authMiddleware');
const webRoutes = require('./routes/webRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser & Method Override
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'thu-vien-tkpm-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Flash messages
app.use(flash());

// Attach local variables to all templates
app.use(attachLocals);

// Mount Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Không tìm thấy trang (404)',
    message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.',
    statusCode: 404
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).render('error', {
    title: 'Lỗi hệ thống (500)',
    message: process.env.NODE_ENV === 'production' 
      ? 'Đã xảy ra sự cố nội bộ. Vui lòng liên hệ quản trị viên.' 
      : err.message,
    statusCode: 500
  });
});

module.exports = app;
