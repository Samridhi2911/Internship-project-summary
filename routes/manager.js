const express = require('express');
const router = express.Router();
const db = require('../config/db');

function isManagerLoggedIn(req, res, next) {
  if (req.session.manager) return next();
  res.redirect('/manager/login');
}


router.get('/login', (req, res) => {
  res.render('manager/login', { error: null });
});


// router.post('/login', (req, res) => {
//   const { email, password } = req.body;

//   const query = 'SELECT * FROM managers WHERE email = ? AND password = ?';
//   db.query(query, [email, password], (err, results) => {
//     if (err) return res.status(500).send('DB error');
//     if (results.length === 0) {
//       return res.render('manager/login', { error: 'Invalid credentials' });
//     }

//     req.session.manager = results[0];
//     res.redirect('/manager/dashboard');
//   });
// });


router.get('/dashboard', isManagerLoggedIn, (req, res) => {
  res.render('manager/dashboard', { manager: req.session.manager });
});



router.get('/users', isManagerLoggedIn, (req, res) => {
  const query = `SELECT id, name, email, gender, caste, religion, status FROM users`;

  db.query(query, [], (err, users) => {
    if (err) return res.status(500).send('DB error');
    res.render('manager/users', {
      manager: req.session.manager,
      users
    });
  });
});


router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/manager/login');
});


router.get('/reminders', isManagerLoggedIn, (req, res) => {
  const userQuery = `SELECT id, name FROM users`;

  const reminderQuery = `
    SELECT r.*, u.name AS user_name
    FROM reminders r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.due_date ASC`;

  db.query(userQuery, (err, users) => {
    if (err) return res.status(500).send('User load error');
    db.query(reminderQuery, (err2, reminders) => {
      if (err2) return res.status(500).send('Reminder load error');
      res.render('manager/reminders', { users, reminders });
    });
  });
});


router.post('/reminders/send', isManagerLoggedIn, (req, res) => {
  const { user_ids, message, due_date, type } = req.body;
  const ids = Array.isArray(user_ids) ? user_ids : [user_ids];

  const values = ids.map(id => [id, message, due_date, type || 'custom']);

  const query = `INSERT INTO reminders (user_id, message, due_date, type) VALUES ?`;
  db.query(query, [values], (err) => {
    if (err) return res.status(500).send('Insert error');
    res.redirect('/manager/reminders');
  });
});


router.post('/reminders/:id/complete', isManagerLoggedIn, (req, res) => {
  db.query(`UPDATE reminders SET status = 'done' WHERE id = ?`, [req.params.id], () => {
    res.redirect('/manager/reminders');
  });
});

router.post('/reminders/:id/delete', isManagerLoggedIn, (req, res) => {
  db.query(`DELETE FROM reminders WHERE id = ?`, [req.params.id], () => {
    res.redirect('/manager/reminders');
  });
});



router.get('/reports', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;

  const query1 = `SELECT * FROM admin_circulars ORDER BY created_at DESC`;
  const query2 = `SELECT * FROM case_reports WHERE manager_id = ?`;
  const query3 = `SELECT * FROM escalation_requests WHERE manager_id = ?`;
  const query4 = `SELECT ur.*, u.name AS reported_user FROM user_reports ur JOIN users u ON ur.reported_user_id = u.id WHERE ur.reporter_id = ?`;

  db.query(query1, (err, circulars) => {
    if (err) return res.status(500).send('Error loading circulars');
    db.query(query2, [managerId], (err2, cases) => {
      db.query(query3, [managerId], (err3, escalations) => {
        db.query(query4, [managerId], (err4, reports) => {
          res.render('manager/reports', {
            circulars,
            cases,
            escalations,
            reports
          });
        });
      });
    });
  });
});







router.post('/reports/user-report', isManagerLoggedIn, (req, res) => {
  const { reported_user_id, reason } = req.body;
  const reporter_id = req.session.manager.id;

  const query = `INSERT INTO user_reports (reported_user_id, reporter_id, reason) VALUES (?, ?, ?)`;
  db.query(query, [reported_user_id, reporter_id, reason], (err) => {
    if (err) return res.status(500).send('Error submitting report');
    res.redirect('/manager/reports');
  });
});


router.post('/reports/case', isManagerLoggedIn, (req, res) => {
  const { case_title, description } = req.body;
  const manager_id = req.session.manager.id;

  const query = `INSERT INTO case_reports (manager_id, case_title, description) VALUES (?, ?, ?)`;
  db.query(query, [manager_id, case_title, description], (err) => {
    if (err) return res.status(500).send('Error saving case report');
    res.redirect('/manager/reports');
  });
});


router.post('/reports/escalation', isManagerLoggedIn, (req, res) => {
  const { subject, details } = req.body;
  const manager_id = req.session.manager.id;

  const query = `INSERT INTO escalation_requests (manager_id, subject, details) VALUES (?, ?, ?)`;
  db.query(query, [manager_id, subject, details], (err) => {
    if (err) return res.status(500).send('Error sending escalation');
    res.redirect('/manager/reports');
  });
});














router.get('/attendence', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;
  const today = new Date().toISOString().slice(0, 10);

  const todayQuery = `SELECT * FROM attendence_logs WHERE manager_id = ? AND date = ? LIMIT 1`;
  const allQuery = `SELECT * FROM attendence_logs WHERE manager_id = ? ORDER BY date DESC`;
  const monthQuery = `SELECT * FROM monthly_reports WHERE manager_id = ? ORDER BY submitted_at DESC`;

db.query(todayQuery, [managerId, today], (err, todayRows) => {
  if (err) return res.status(500).send('Error fetching today\'s log');
  
  const todayLog = todayRows && todayRows.length > 0 ? todayRows[0] : null;

  db.query(allQuery, [managerId], (err2, logs) => {
    if (err2) return res.status(500).send('Error loading logs');

    db.query(monthQuery, [managerId], (err3, monthlyReports) => {
      if (err3) return res.status(500).send('Error loading monthly reports');

      res.render('manager/attendence', { todayLog, logs, monthlyReports });
    });
  });
});
});


router.post('/attendence/checkin', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const query = `INSERT INTO attendence_logs (manager_id, check_in, date) VALUES (?, ?, ?)`;
  db.query(query, [managerId, now, date], (err) => {
    if (err) return res.status(500).send('Check-in failed');
    res.redirect('/manager/attendance');
  });
});


router.post('/attendence/checkout', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;
  const { summary } = req.body;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const query = `UPDATE attendence_logs SET check_out = ?, summary = ? WHERE manager_id = ? AND date = ?`;
  db.query(query, [now, summary, managerId, date], (err) => {
    if (err) return res.status(500).send('Check-out failed');
    res.redirect('/manager/attendence');
  });
});


router.post('/attendence/monthly', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;
  const { content } = req.body;
  const now = new Date();
  const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const query = `INSERT INTO monthly_reports (manager_id, month_year, content) VALUES (?, ?, ?)`;
  db.query(query, [managerId, monthYear, content], (err) => {
    if (err) return res.status(500).send('Monthly report failed');
    res.redirect('/manager/attendence');
  });
});














router.get('/communication', isManagerLoggedIn, (req, res) => {
  const { keyword = '', from = '', to = '', start = '', end = '' } = req.query;

  const messageQuery = `
    SELECT m.*, s.name AS sender_name, r.name AS receiver_name
    FROM messages m
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.receiver_id = r.id
    WHERE (s.name LIKE ? OR r.name LIKE ? OR m.content LIKE ?)
    ${start && end ? 'AND m.timestamp BETWEEN ? AND ?' : ''}
    ORDER BY m.timestamp DESC
  `;

  const params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
  if (start && end) {
    params.push(start, end);
  }

  db.query(messageQuery, params, (err, messages) => {
    if (err) return res.status(500).send('Error loading messages');

    const interestQuery = `
      SELECT i.*, u1.name AS from_name, u2.name AS to_name
      FROM interests i
      JOIN users u1 ON i.fromUser = u1.id
      JOIN users u2 ON i.toUser = u2.id
      ORDER BY i.sent_at DESC
    `;

    db.query(interestQuery, (err2, interests) => {
      if (err2) return res.status(500).send('Error loading interests');

      res.render('manager/communication', {
        messages,
        interests,
        filters: { keyword, start, end }
      });
    });
  });
});











// 🔐 Security & Access
router.get('/security', isManagerLoggedIn, (req, res) => {
  const managerId = req.session.manager.id;

  const logsQuery = `
    SELECT ml.*, m.name AS manager_name
    FROM manager_logs ml
    JOIN managers m ON ml.manager_id = m.id
    ORDER BY ml.timestamp DESC
  `;

  const usersQuery = `SELECT id, name, email FROM users`;

  db.query(logsQuery, (err, logs) => {
    if (err) return res.status(500).send('Error loading logs');
    db.query(usersQuery, (err2, users) => {
      if (err2) return res.status(500).send('Error loading users');
      res.render('manager/security', { logs, users });
    });
  });
});

router.post('/security/suggest-deletion', isManagerLoggedIn, (req, res) => {
  const { user_id, reason } = req.body;
  const manager_id = req.session.manager.id;

  const query = `INSERT INTO user_deletion_requests (user_id, manager_id, reason) VALUES (?, ?, ?)`;
  db.query(query, [user_id, manager_id, reason], (err) => {
    if (err) return res.status(500).send('Could not suggest deletion');
    res.redirect('/manager/security');
  });
});






// router.get('/chat-logs', (req, res) => {
//   const query = `
//     SELECT m.*, u1.name AS sender_name, u2.name AS receiver_name
//     FROM messages m
//     JOIN users u1 ON m.sender_id = u1.id
//     JOIN users u2 ON m.receiver_id = u2.id
//     ORDER BY m.timestamp DESC
//   `;

//   db.query(query, (err, messages) => {
//     if (err) return res.status(500).send('Database error');
//     res.render('manager/chat-logs', { messages });
//   });
// });

const logManagerActivity = require('../utils/logManagerActivity');

// Inside your login route, after verifying credentials
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const sql = `SELECT * FROM managers WHERE email = ? AND password = ?`;

  db.query(sql, [email, password], (err, results) => {
    if (err) throw err;
    if (results.length === 1) {
      const manager = results[0];
      req.session.manager = manager;

      // ✅ Log login activity
      logManagerActivity(
        manager.id,
        'Login',
        `${manager.name} logged in successfully`,
        null,
        req.ip
      );

      res.redirect('/manager/dashboard');
    } else {
      res.send('Invalid credentials');
    }
  });
});





















router.get('/chat-logs', (req, res) => {
  const search = req.query.q || '';
  const sql = `
    SELECT m.*, 
      s.name AS sender_name, 
      r.name AS receiver_name 
    FROM messages m
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.receiver_id = r.id
    WHERE s.name LIKE ? OR r.name LIKE ?
    ORDER BY m.timestamp DESC
  `;
  const param = `%${search}%`;

  db.query(sql, [param, param], (err, results) => {
    if (err) return res.status(500).send('DB Error');
    res.render('manager/chat-logs', { messages: results, searchQuery: search });
  });
});



























module.exports = router;
