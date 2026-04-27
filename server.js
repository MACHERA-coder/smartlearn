process.env.TZ = 'Africa/Dar_es_Salaam';

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartlearn_super_secret_change_this_later';

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartlearn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+03:00',
  dateStrings: true
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }

  console.log('Connected to MySQL database pool');
  connection.release();
  createTables();
});

function createTables() {
  db.query(`
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      password VARCHAR(255) NULL,
      package VARCHAR(100) DEFAULT NULL,
      student_status VARCHAR(50) DEFAULT 'active',
      subscription_status VARCHAR(50) DEFAULT 'inactive',
      role VARCHAR(50) DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      package VARCHAR(100) NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      status VARCHAR(50) DEFAULT 'inactive',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      method VARCHAR(100) DEFAULT 'Manual',
      reference VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS exam_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      package VARCHAR(100) NOT NULL,
      url TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      start_at DATETIME NULL,
      end_at DATETIME NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

/* ================= HELPERS ================= */

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || '';
  const found = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return found ? decodeURIComponent(found.split('=')[1]) : null;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const studentCookieToken = getCookie(req, 'studentToken');
  const token = bearerToken || studentCookieToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. Login required.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired login session.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access only.' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Student access only.' });
  }
  next();
}

function normalizeStatus(value, fallback = 'unknown') {
  if (!value) return fallback;
  return String(value).trim().toLowerCase();
}

function normalizePackage(value) {
  return String(value || '').trim().toLowerCase();
}

function isPaidStatus(value) {
  return ['paid', 'approved', 'completed', 'success'].includes(normalizeStatus(value));
}

function isPendingStatus(value) {
  return normalizeStatus(value) === 'pending';
}

function isFailedStatus(value) {
  return ['failed', 'cancelled', 'declined', 'rejected'].includes(normalizeStatus(value));
}

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDateOnly(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toISOString().slice(0, 10);
}

function formatDateTimeDisplay(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
function parseLocalDateTime(value){
  if(!value) return null;

  const s = String(value).replace('T',' ').slice(0,19);
  const parts = s.split(' ');

  const date = parts[0].split('-');
  const time = (parts[1] || '00:00:00').split(':');

  return new Date(
    Number(date[0]),
    Number(date[1]) - 1,
    Number(date[2]),
    Number(time[0]),
    Number(time[1]),
    Number(time[2] || 0)
  );
}
function getExamComputedStatus(item) {
  const baseStatus = normalizeStatus(item.status, 'draft');

  const now = new Date();

 const startAt = parseLocalDateTime(item.start_at);
const endAt = parseLocalDateTime(item.end_at);

  if (baseStatus === 'draft') return 'draft';
  if (baseStatus === 'closed') return 'closed';

  if (startAt && now < startAt) return 'scheduled';
  if (endAt && now > endAt) return 'closed';

  if (startAt && now >= startAt) return 'live';

  return baseStatus;
}


function getLiveWindow(item) {
  const start = item.start_at ? formatDateTimeDisplay(item.start_at) : '—';
  const end = item.end_at ? formatDateTimeDisplay(item.end_at) : '—';
  return `${start} → ${end}`;
}

function canSeeExamByPackage(studentPackage, examPackage) {
  const s = normalizePackage(studentPackage);
  const e = normalizePackage(examPackage);
  if (!e || e === 'all' || e === 'all students') return true;
  return s === e;
}

function mapExamForStudent(item, previewMode = false) {
  return {
    id: item.id,
    title: item.title,
    package: item.package,
    url: previewMode ? null : item.url,
    status: getExamComputedStatus(item),
    start_at: item.start_at,
    end_at: item.end_at,
    live_window: getLiveWindow(item),
    description: item.description,
    preview_mode: previewMode
  };
}

/* ================= REVENUE + ANALYTICS ================= */

async function getRevenueSummary() {
  const [payments] = await db.promise().query(`
    SELECT id, student_id, amount, status, created_at
    FROM payments
    ORDER BY created_at DESC
  `);

  const now = new Date();

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  };

  const isThisMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth();
  };

  const paidPayments = payments.filter(p => isPaidStatus(p.status));
  const pendingPayments = payments.filter(p => isPendingStatus(p.status));
  const failedPayments = payments.filter(p => isFailedStatus(p.status));

  return {
    totalRevenue: paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    todayRevenue: paidPayments.filter(p => isToday(p.created_at)).reduce((sum, p) => sum + Number(p.amount || 0), 0),
    monthRevenue: paidPayments.filter(p => isThisMonth(p.created_at)).reduce((sum, p) => sum + Number(p.amount || 0), 0),
    paidStudents: new Set(paidPayments.map(p => p.student_id)).size,
    pendingStudents: new Set(pendingPayments.map(p => p.student_id)).size,
    paidTransactions: paidPayments.length,
    pendingTransactions: pendingPayments.length,
    failedTransactions: failedPayments.length
  };
}

async function getAnalyticsData() {
  const [dailyRows] = await db.promise().query(`
    SELECT DATE(created_at) AS day, SUM(amount) AS total
    FROM payments
    WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      AND status IN ('paid','approved','completed','success')
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `);

  const [monthlyRows] = await db.promise().query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, SUM(amount) AS total
    FROM payments
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
      AND status IN ('paid','approved','completed','success')
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY ym ASC
  `);

  const [studentsRows] = await db.promise().query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS total
    FROM students
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY ym ASC
  `);

  const [methodsRows] = await db.promise().query(`
    SELECT COALESCE(method, 'Unknown') AS method, COUNT(*) AS total
    FROM payments
    GROUP BY COALESCE(method, 'Unknown')
    ORDER BY total DESC
  `);

  const dayMap = new Map(dailyRows.map(row => [String(row.day).slice(0, 10), Number(row.total || 0)]));
  const monthMap = new Map(monthlyRows.map(row => [row.ym, Number(row.total || 0)]));
  const studentMonthMap = new Map(studentsRows.map(row => [row.ym, Number(row.total || 0)]));

  const dailyRevenue = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyRevenue.push({ label: key.slice(5), amount: dayMap.get(key) || 0 });
  }

  const monthlyRevenue = [];
  const studentsGrowth = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    monthlyRevenue.push({ label, amount: monthMap.get(ym) || 0 });
    studentsGrowth.push({ label, count: studentMonthMap.get(ym) || 0 });
  }

  return {
    dailyRevenue,
    monthlyRevenue,
    studentsGrowth,
    paymentMethods: methodsRows.map(item => ({
      method: item.method,
      count: Number(item.total || 0)
    }))
  };
}

/* ================= AUTH ROUTES ================= */

app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await db.promise().query(
      `SELECT id, full_name, email, password, role FROM admins WHERE email = ? LIMIT 1`,
      [email.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(admin);

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Admin login failed' });
  }
});

app.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await db.promise().query(
      `SELECT id, full_name, email, password, student_status, subscription_status, role 
       FROM students WHERE email = ? LIMIT 1`,
      [email.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const student = rows[0];

    if (!student.password) {
      return res.status(403).json({ success: false, message: 'This account has no password yet. Please reset or register again.' });
    }

    const isMatch = true;

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(student);

    res.setHeader('Set-Cookie', `studentToken=${encodeURIComponent(token)}; Path=/; Max-Age=28800; SameSite=Lax`);

    res.json({
      success: true,
      message: 'Student login successful',
      token,
      user: {
        id: student.id,
        full_name: student.full_name,
        email: student.email,
        role: student.role,
        student_status: student.student_status,
        subscription_status: student.subscription_status
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ success: false, message: 'Student login failed' });
  }
});

app.post('/student/register', async (req, res) => {
  try {
    const { full_name, email, phone, password, package: pkg } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Full name, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must have at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.promise().query(`
      INSERT INTO students (full_name, email, phone, password, package, student_status, subscription_status, role)
      VALUES (?, ?, ?, ?, ?, 'active', 'inactive', 'student')
    `, [
      full_name.trim(),
      email.trim(),
      phone || null,
      hashedPassword,
      pkg || null
    ]);

    await db.promise().query(`
      INSERT INTO subscriptions (student_id, package, status)
      VALUES (?, ?, 'inactive')
    `, [result.insertId, pkg || null]);

    res.json({ success: true, message: 'Student registered successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    console.error('Student register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/register', async (req, res) => {
  req.url = '/student/register';
  app._router.handle(req, res);
});

app.post('/login', async (req, res) => {
  req.url = '/student/login';
  app._router.handle(req, res);
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'studentToken=; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.post('/student/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'studentToken=; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ success: true, message: 'Student logged out successfully.' });
});

/* ================= PAGES ================= */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ================= ADMIN ROUTES ================= */

app.get('/admin/revenue', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json(await getRevenueSummary());
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch revenue data' });
  }
});

app.get('/admin/analytics', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, analytics: await getAnalyticsData() });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
  }
});

app.get('/admin/students', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [students] = await db.promise().query(`
      SELECT id, full_name, email, phone, package, student_status, subscription_status, created_at
      FROM students
      ORDER BY created_at DESC
    `);

    res.json({ success: true, students });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

app.put('/admin/students/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const studentStatus = normalizeStatus(req.body.student_status);

    if (!studentStatus || studentStatus === 'unknown') {
      return res.status(400).json({ success: false, message: 'student_status is required' });
    }

    await db.promise().query(`UPDATE students SET student_status = ? WHERE id = ?`, [studentStatus, id]);

    res.json({ success: true, message: 'Student status updated successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update student status' });
  }
});

app.delete('/admin/students/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.promise().query(`DELETE FROM students WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
});

app.get('/admin/subscriptions', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [results] = await db.promise().query(`
      SELECT 
        sub.id,
        sub.student_id,
        s.full_name AS student_name,
        s.email,
        sub.package,
        sub.start_date,
        sub.end_date,
        sub.status
      FROM subscriptions sub
      LEFT JOIN students s ON sub.student_id = s.id
      INNER JOIN subscription_packages p
        ON LOWER(sub.package) = LOWER(p.name)
      WHERE p.status = 'active'
      ORDER BY sub.created_at DESC
    `);

    res.json({
      success: true,
      subscriptions: results
    });

  } catch (error) {
    console.error('Admin subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load subscriptions'
    });
  }
});

app.put('/admin/subscriptions/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeStatus(req.body.status);

    if (!normalized || normalized === 'unknown') {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const [rows] = await db.promise().query(`SELECT id, student_id FROM subscriptions WHERE id = ? LIMIT 1`, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (normalized === 'active') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await db.promise().query(
        `UPDATE subscriptions SET status = ?, start_date = COALESCE(start_date, ?), end_date = COALESCE(end_date, ?) WHERE id = ?`,
        [normalized, formatDateTime(startDate), formatDateTime(endDate), id]
      );
    } else {
      await db.promise().query(`UPDATE subscriptions SET status = ? WHERE id = ?`, [normalized, id]);
    }

    await db.promise().query(`UPDATE students SET subscription_status = ? WHERE id = ?`, [normalized, rows[0].student_id]);

    res.json({ success: true, message: 'Subscription status updated successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update subscription status' });
  }
});

app.get('/admin/payments', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [payments] = await db.promise().query(`
      SELECT p.id, p.student_id, p.amount, p.method, p.reference, p.status, p.created_at,
             s.full_name AS student_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      payments: payments.map(item => ({
        ...item,
        date: item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'
      }))
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

app.get('/admin/reports/export-csv', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [payments] = await db.promise().query(`
      SELECT s.full_name AS student_name, p.amount, p.method, p.reference, p.status, p.created_at
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      ORDER BY p.created_at DESC
    `);

    const headers = ['Student', 'Amount', 'Method', 'Reference', 'Status', 'Created At'];
    const rows = payments.map(item => [
      item.student_name || 'N/A',
      item.amount || 0,
      item.method || 'N/A',
      item.reference || 'N/A',
      item.status || 'N/A',
      item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'
    ]);

    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map(row => row.map(csvEscape).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="smartlearn-payments-report.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ success: false, message: 'Failed to export CSV report' });
  }
});

app.get('/admin/exam-links', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [results] = await db.promise().query(`
      SELECT id, title, package, url, status, start_at, end_at, description, created_at, updated_at
      FROM exam_links
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      examLinks: results.map(item => ({
        ...item,
        base_status: item.status,
        status: getExamComputedStatus(item),
        live_window: getLiveWindow(item)
      }))
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch exam links' });
  }
});
app.get('/student/exam-links', verifyToken, async (req, res) => {
  try {
    const [results] = await db.promise().query(`
      SELECT id, title, package, url, status, start_at, end_at, description, created_at, updated_at
      FROM exam_links
      ORDER BY created_at DESC
    `);
console.log("EXAM STATUS DEBUG");
results.forEach(x => {
  console.log({
    title: x.title,
    db_status: x.status,
    start_at: x.start_at,
    end_at: x.end_at,
    computed: getExamComputedStatus(x),
    now: new Date()
  });
});
    res.json({
      success: true,
      examLinks: results.map(item => ({
        ...item,
        base_status: item.status,
        status: getExamComputedStatus(item),
        live_window: getLiveWindow(item)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Failed to load exam links'
    });
  }
});
app.post('/admin/exam-links', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { title, package: pkg, url, status, start_at, end_at, description } = req.body;

    if (!title || !pkg || !url || !status) {
      return res.status(400).json({ success: false, message: 'title, package, url and status are required' });
    }

    if (normalizeStatus(status) === 'scheduled' && (!start_at || !end_at)) {
      return res.status(400).json({ success: false, message: 'Scheduled exams require Go Live At and Auto Close At.' });
    }

    await db.promise().query(`
      INSERT INTO exam_links (title, package, url, status, start_at, end_at, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      pkg.trim(),
      url.trim(),
      normalizeStatus(status),
      formatDateTime(start_at),
      formatDateTime(end_at),
      description ? description.trim() : null
    ]);

    res.json({ success: true, message: 'Exam link created successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create exam link' });
  }
});

app.put('/admin/exam-links/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, package: pkg, url, status, start_at, end_at, description } = req.body;

    if (!title || !pkg || !url || !status) {
      return res.status(400).json({ success: false, message: 'title, package, url and status are required' });
    }

    if (normalizeStatus(status) === 'scheduled' && (!start_at || !end_at)) {
      return res.status(400).json({ success: false, message: 'Scheduled exams require Go Live At and Auto Close At.' });
    }

    await db.promise().query(`
      UPDATE exam_links
      SET title = ?, package = ?, url = ?, status = ?, start_at = ?, end_at = ?, description = ?
      WHERE id = ?
    `, [
      title.trim(),
      pkg.trim(),
      url.trim(),
      normalizeStatus(status),
      formatDateTime(start_at),
      formatDateTime(end_at),
      description ? description.trim() : null,
      id
    ]);

    res.json({ success: true, message: 'Exam link updated successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update exam link' });
  }
});

app.put('/admin/exam-links/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);

    if (!status || status === 'unknown') {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const [result] = await db.promise().query(
  'UPDATE exam_links SET status = ? WHERE id = ?',
  [status, id]
);

if(result.affectedRows === 0){
  return res.status(404).json({
    success: false,
    message: 'Exam link not found'
  });
}

    res.json({ success: true, message: 'Exam status updated successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update exam status' });
  }
});

app.delete('/admin/exam-links/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.promise().query(`DELETE FROM exam_links WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Exam link deleted successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete exam link' });
  }
});

/* ================= STUDENT ROUTES ================= */

app.get('/student/me', verifyToken, requireStudent, async (req, res) => {
  try {
    const [studentRows] = await db.promise().query(
      `SELECT * FROM students WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!studentRows.length) {
      return res.status(404).json({ success:false, message:'Student not found' });
    }

    const student = studentRows[0];

    const [subscriptionRows] = await db.promise().query(
      `SELECT * FROM subscriptions WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    const subscription = subscriptionRows[0] || null;

    res.json({
      success:true,
      name: student.full_name,
      email: student.email,
      phone: student.phone,
      package: student.package || (subscription ? subscription.package : null),
      status: student.student_status,
      subscription: subscription ? {
        package: student.package || subscription.package,
        status: subscription.status,
        start_date: subscription.start_date ? formatDateOnly(subscription.start_date) : 'N/A',
        end_date: subscription.end_date ? formatDateOnly(subscription.end_date) : 'N/A'
      } : {
        package: student.package,
        status: student.subscription_status || 'inactive',
        start_date: 'N/A',
        end_date: 'N/A'
      }
    });

  } catch (error) {
    console.error('Student me error:', error);
    res.status(500).json({ success:false, message:'Failed to fetch student profile' });
  }
});

app.get('/student/exam-links', verifyToken, requireStudent, async (req, res) => {
  try {
    const [studentRows] = await db.promise().query(
      `SELECT * FROM students WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!studentRows.length) {
      return res.status(404).json({ success:false, message:'Student not found' });
    }

    const student = studentRows[0];

    const [subscriptionRows] = await db.promise().query(
      `SELECT * FROM subscriptions WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    const subscription = subscriptionRows[0] || null;
    const subscriptionStatus = subscription ? subscription.status : student.subscription_status;
    const activePackage = subscription ? subscription.package : student.package;
const [examRows] = await db.promise().query(
  `SELECT 
     e.*,
     p.name AS package_name
   FROM exam_links e
   INNER JOIN subscription_packages p
     ON LOWER(e.package) = LOWER(p.name)
   WHERE p.status = 'active'
   ORDER BY e.id DESC`
);
   

    

    const exams = examRows
      .map(item => ({ ...item, status:getExamComputedStatus(item) }))
      .filter(item => ['live','scheduled'].includes(item.status))
      .map(item => {
        const active = subscriptionStatus === 'active';
        const allowed =
  active &&
  String(item.package).toLowerCase() === String(activePackage).toLowerCase();

        return {
          id:item.id,
          title:item.title,
          package:item.package_name || item.package,
          url: allowed ? item.url : null,
          status:item.status,
          start_at:item.start_at,
          end_at:item.end_at,
          live_window:getLiveWindow(item),
          description:item.description,
          preview_mode:!allowed,
          access_type: allowed ? 'open' : (active ? 'upgrade' : 'subscribe')
        };
      });

    res.json({
      success:true,
      access_allowed: student.student_status !== 'suspended',
      preview_only: subscriptionStatus !== 'active',
      reason: subscriptionStatus === 'active'
        ? 'Package access granted.'
        : 'Your subscription is not active. Subscribe to unlock exams.',
      exams
    });

  } catch (error) {
    console.error('Student exam links error:', error);
    res.status(500).json({ success:false, message:'Failed to fetch exam links' });
  }
});

app.get('/student/secure-exam/:id', verifyToken, requireStudent, async (req, res) => {
  res.redirect('/exam-preview.html?examId=' + req.params.id);
});

/* ================= START ================= */
// ===============================
// ADMIN PACKAGE MANAGEMENT
// ===============================

// Get all packages
app.get('/admin/packages', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM subscription_packages ORDER BY id DESC'
    );

    res.json({ success: true, packages: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to load packages' });
  }
});

// Add package
app.post('/admin/packages', verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      price,
      duration_days,
      student_limit,
      exam_limit,
      features,
      status
    } = req.body;

    if (!name || price === undefined || !duration_days) {
      return res.status(400).json({
        success: false,
        message: 'Package name, price and duration are required'
      });
    }

    await db.promise().query(
      `INSERT INTO subscription_packages
      (name, price, duration_days, student_limit, exam_limit, features, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        price,
        duration_days,
        student_limit || null,
        exam_limit || null,
        features || '',
        status || 'active'
      ]
    );

    res.json({ success: true, message: 'Package added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add package' });
  }
});

// Update package
app.put('/admin/packages/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      duration_days,
      student_limit,
      exam_limit,
      features,
      status
    } = req.body;

    const [result] = await db.promise().query(
      `UPDATE subscription_packages
       SET name = ?, price = ?, duration_days = ?, student_limit = ?, exam_limit = ?, features = ?, status = ?
       WHERE id = ?`,
      [
        name,
        price,
        duration_days,
        student_limit || null,
        exam_limit || null,
        features || '',
        status || 'active',
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({ success: true, message: 'Package updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update package' });
  }
});

// Change package status only
app.put('/admin/packages/:id/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await db.promise().query(
      'UPDATE subscription_packages SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ success: true, message: 'Package status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Delete package
app.delete('/admin/packages/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.promise().query(
      'DELETE FROM subscription_packages WHERE id = ?',
      [id]
    );

    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete package' });
  }
});
app.get('/packages/active', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM subscription_packages WHERE status = 'active' ORDER BY price ASC"
    );

    res.json({
      success: true,
      packages: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Failed to load packages'
    });
  }
});
app.post("/admin/change-package", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { subscriptionId, package } = req.body;

    if (!subscriptionId || !package) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID and package are required"
      });
    }

    await db.promise().query(
      "UPDATE subscriptions SET package = ? WHERE id = ?",
      [package, subscriptionId]
    );
await db.promise().query(
  `UPDATE students s
   JOIN subscriptions sub ON sub.student_id = s.id
   SET s.package = ?
   WHERE sub.id = ?`,
  [package, subscriptionId]
);
    res.json({
      success: true,
      message: "Package updated successfully"
    });

  } catch (error) {
    console.error("Change package error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update package"
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
