const express = require('express');
const router = express.Router();

const db = require('../config/db');
router.use(express.urlencoded({ extended: true }));


// Admin login page
router.get('/login', (req, res) => {
  res.render('admin/login', { message: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = `SELECT * FROM admins WHERE email = ? AND password = ?`;
  db.query(sql, [email, password], (err, result) => {
    if (err) throw err;

    if (result.length === 0) {
      return res.render('admin/login', { message: 'Invalid credentials' });
    }

    req.session.admin = result[0]; // save admin session
    res.redirect('/admin/dashboard');
  });
});

















// ✅ Protect ALL routes below this line
router.use((req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
});










function checkAdminAuth(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// Show form
router.get('/register-client',checkAdminAuth, (req, res) => {
  res.render('admin/register-client'); // you'll create this file next
});

// Handle form POST
router.post('/register-client',checkAdminAuth, (req, res) => {
  const { name, email, mobile, gender, religion } = req.body;
  const query = `
    INSERT INTO users (name, email, mobile, gender, religion, joined_date, subscribed, status)
    VALUES (?, ?, ?, ?, ?, CURDATE(), 0, 'Active')
  `;
  db.query(query, [name, email, mobile, gender, religion], (err, result) => {
    if (err) throw err;
    res.redirect('/admin/users'); // redirect to users page
  });
});


router.get('/caste-language',checkAdminAuth, (req, res) => {
  const castesQuery = 'SELECT * FROM castes';
  const languagesQuery = 'SELECT * FROM languages';

  db.query(castesQuery, (err1, casteResults) => {
    if (err1) throw err1;
    db.query(languagesQuery, (err2, languageResults) => {
      if (err2) throw err2;
      res.render('admin/caste-language', {
        castes: casteResults,
        languages: languageResults
      });
    });
  });
});

router.post('/caste-language',checkAdminAuth, (req, res) => {
  const { caste, language } = req.body;

  const insertCaste = 'INSERT INTO castes (name) VALUES (?)';
  const insertLanguage = 'INSERT INTO languages (name) VALUES (?)';

  db.query(insertCaste, [caste], (err1) => {
    if (err1) throw err1;
    db.query(insertLanguage, [language], (err2) => {
      if (err2) throw err2;
      res.redirect('/admin/caste-language');
    });
  });
});



// Income page
router.get('/income', checkAdminAuth,(req, res) => {
  db.query('SELECT * FROM incomes ORDER BY id DESC', (err, results) => {
    if (err) throw err;
    res.render('admin/income', { incomes: results });
  });
});

router.post('/income',checkAdminAuth, (req, res) => {
  const { amount, language } = req.body;
  const query = 'INSERT INTO incomes (amount, language) VALUES (?, ?)';
  db.query(query, [amount, language], (err) => {
    if (err) throw err;
    res.redirect('/admin/income');
  });
});

// Manglik GET page
router.get('/manglik',checkAdminAuth, (req, res) => {
  db.query('SELECT * FROM manglik', (err, results) => {
    if (err) throw err;
    res.render('admin/manglik', { mangliks: results });
  });
});

// Manglik POST
router.post('/manglik',checkAdminAuth, (req, res) => {
  const { type, language } = req.body;
  const query = 'INSERT INTO manglik (type, language, status) VALUES (?, ?, "Active")';
  db.query(query, [type, language], (err) => {
    if (err) throw err;
    res.redirect('/admin/manglik');
  });
});









router.get('/dashboard',checkAdminAuth, (req, res) => {
  const counts = {};
 // ✅ DEFINING filter & query SAFELY
  const filter = req.query.filter || '';
  const query = req.query.query || '';

  db.query('SELECT COUNT(*) AS total FROM users', (err1, result1) => {
    if (err1) throw err1;
    counts.totalUsers = result1[0].total;

    db.query('SELECT COUNT(*) AS subscribed FROM users WHERE subscribed = 1', (err2, result2) => {
      if (err2) throw err2;
      counts.subscribedUsers = result2[0].subscribed;

      db.query("SELECT COUNT(*) AS suspended FROM users WHERE status = 'Suspended'", (err3, result3) => {
        if (err3) throw err3;
        counts.suspendedUsers = result3[0].suspended;

        // ✅ NOW ADD RELIGION DATA
        db.query("SELECT religion, COUNT(*) AS count FROM users GROUP BY religion", (err4, religionData) => {
          if (err4) throw err4;

          const monthlyQuery = `
            SELECT DATE_FORMAT(joined_date, '%b') AS month, COUNT(*) AS count
            FROM users
            GROUP BY month
            ORDER BY STR_TO_DATE(month, '%b')
          `;

           db.query(monthlyQuery, (err5, monthlyData) => {
            if (err5) throw err5;

            // 🧠 Profile moderation query
            let moderationQuery = 'SELECT * FROM users ORDER BY joined_date DESC LIMIT 1';
            let params = [];

            if (filter && query) {
              const allowed = ['name', 'email', 'religion'];
              if (allowed.includes(filter)) {
                moderationQuery = `SELECT * FROM users WHERE ${filter} LIKE ? LIMIT 1`;
                params = [`%${query}%`];
              }
            }

            db.query(moderationQuery, params, (err6, moderationUsers) => {
              if (err6) throw err6;
          

          res.render('admin/dashboard', {
            counts,
            religionData,
            monthlyData
,moderationUsers,
                filter,
                query});                     }); // ✅ This line makes it available to EJS
          });
        });
      });
    });
  });
});


router.get('/activity-log',checkAdminAuth, (req, res) => {
  const queries = {
    loginLogs: `
      SELECT log.*, m.name AS manager_name
      FROM manager_activity_log log
      JOIN managers m ON log.manager_id = m.id
      ORDER BY log.timestamp DESC
    `,
    attendanceLogs: `
      SELECT a.*, m.name AS manager_name
      FROM attendence_logs a
      JOIN managers m ON a.manager_id = m.id
      ORDER BY a.date DESC
    `,
    messages: `
      SELECT m.*, sender.name AS sender_name, receiver.name AS receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      ORDER BY m.timestamp DESC
      LIMIT 50
    `,
    interests: `
      SELECT i.*, fromU.name AS from_name, toU.name AS to_name
      FROM interests i
      JOIN users fromU ON i.fromUser = fromU.id
      JOIN users toU ON i.toUser = toU.id
      ORDER BY i.sent_at DESC
      LIMIT 50
    `,
    caseReports: `
      SELECT c.*, m.name AS manager_name
      FROM case_reports c
      JOIN managers m ON c.manager_id = m.id
      ORDER BY c.created_at DESC
    `,
    escalationRequests: `
      SELECT e.*, m.name AS manager_name
      FROM escalation_requests e
      JOIN managers m ON e.manager_id = m.id
      ORDER BY e.created_at DESC
    `,
    // userReports: `
    //   SELECT r.*, m.name AS reporter_name, u.name AS reported_user
    //   FROM user_reports r
    //   JOIN managers m ON r.reporter_id = m.id
    //   JOIN users u ON r.reported_user_id = u.id
    //   ORDER BY r.created_at DESC
    // `,
    monthlyReports: `
      SELECT r.*, m.name AS manager_name
      FROM monthly_reports r
      JOIN managers m ON r.manager_id = m.id
      ORDER BY r.submitted_at DESC
    `
  };

  const keys = Object.keys(queries);
  const results = {};
  let completed = 0;

  keys.forEach(key => {
    db.query(queries[key], (err, rows) => {
      if (err) return res.status(500).send('DB Error: ' + key);
      results[key] = rows;
      completed++;

      if (completed === keys.length) {
        res.render('admin/activity-log', results); // ✅ Renders admin/activity-log.ejs
      }
    });
  });
});
























router.get('/users',checkAdminAuth, (req, res) => {
  db.query('SELECT * FROM users', (err, result) => {
    if (err) throw err;
    res.render('admin/users', { users: result });
  });
});



router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});


module.exports = router;
