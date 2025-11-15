const express = require('express');
const router = express.Router();
const db = require('../config/db'); // ✅ MySQL connection

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/user/login');
}












// });
router.get('/dashboard', isLoggedIn, (req, res) => {
  const userId = req.session.user.id;

  const query = `
    SELECT i.id, u.id AS userId, u.name, u.religion, u.caste
    FROM interests i
    JOIN users u ON u.id = i.fromUser
    WHERE i.toUser = ? AND i.status = 'sent'
  `;

  db.query(query, [userId], (err, pendingUsers) => {
    if (err) return res.status(500).send('DB error');
    res.render('members/dashboard', { user: req.session.user, pendingUsers });
  });
});


















// Profile View
router.get('/profile', isLoggedIn, (req, res) => {
  res.render('members/view-profile', { user: req.session.user });
});

// Edit Profile
router.get('/edit-profile', isLoggedIn, (req, res) => {
  res.render('members/edit-profile', { user: req.session.user });
});



router.get('/matches', isLoggedIn, (req, res) => {
  const user = req.session.user;

  const query = `
    SELECT * FROM users
    WHERE id != ? AND status = 'approved'
  `;

  db.query(query, [user.id], (err, results) => {
    if (err) {
      console.error('❌ Match Query Error:', err.message);
      return res.status(500).send('Error fetching matches');
    }

    res.render('members/matches', {
      user,
      results // ✅ send this!
    });
  });
});



















router.get('/membership', isLoggedIn, (req, res) => {
  const userId = req.session.user.id;

  const query = `SELECT package, package_expiry, contacts_left, interests_used, images_uploaded 
                 FROM users WHERE id = ?`;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).send('DB error');
    if (results.length === 0) return res.status(404).send('User not found');

    const user = results[0];

    // Calculate days left
    let daysLeft = 'Unlimited';
    if (user.package_expiry) {
      const expiryDate = new Date(user.package_expiry);
      const today = new Date();
      const diff = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      daysLeft = diff > 0 ? diff : 0;
    }

    res.render('members/membership', {
      user: {
        package: user.package,
        daysLeft,
        contactsLeft: user.contacts_left,
        interestsUsed: user.interests_used,
        imagesUploaded: user.images_uploaded
      }
    });
  });
});




























router.get('/chatbox/:id', isLoggedIn, (req, res) => {
  const chatPartnerId = parseInt(req.params.id);
  const currentUser = req.session.user;

  if (!currentUser || !currentUser.id) {
    return res.redirect('/user/login');
  }

  // // Prevent chatting with yourself
  // if (chatPartnerId === currentUser.id) {
  //   return res.send('❌ You cannot chat with yourself.');
  // }

  // Try to get the chat partner's name (even if not approved)
  const query = `SELECT name FROM users WHERE id = ?`;

  db.query(query, [chatPartnerId], (err, results) => {
    let chatPartnerName = 'Unknown User';
    if (!err && results.length > 0) {
      chatPartnerName = results[0].name;
    }

    res.render('members/chatbox', {
      user: currentUser,
      chatPartnerId,
      chatPartnerName
    });
  });
});


























// Settings
router.get('/settings', isLoggedIn, (req, res) => {
  res.render('members/account-settings', { user: req.session.user });
});

const bcrypt = require('bcrypt');

// Change Password
router.post('/settings/change-password', isLoggedIn, async (req, res) => {
  const { newPassword } = req.body;
  const hashed = await bcrypt.hash(newPassword, 10);
  const userId = req.session.user.id;

  const query = `UPDATE users SET password = ? WHERE id = ?`;
  db.query(query, [hashed, userId], (err) => {
    if (err) return res.status(500).send('Password update failed');
    res.redirect('/member/settings');
  });
});

// Privacy Settings
router.post('/settings/privacy', isLoggedIn, (req, res) => {
  const { visibility } = req.body;
  const userId = req.session.user.id;

  const query = `UPDATE users SET visibility = ? WHERE id = ?`;
  db.query(query, [visibility, userId], (err) => {
    if (err) return res.status(500).send('Privacy update failed');
    res.redirect('/member/settings');
  });
});

// Deactivate Profile
router.post('/settings/deactivate', isLoggedIn, (req, res) => {
  const userId = req.session.user.id;

  const query = `UPDATE users SET status = 'closed' WHERE id = ?`;
  db.query(query, [userId], (err) => {
    if (err) return res.status(500).send('Deactivation failed');
    req.session.destroy(); // logout user
    res.redirect('/');
  });
});











































// Search Form
router.get('/search', isLoggedIn, (req, res) => {
  res.render('members/search', {
    user: req.session.user,
    results: null
  });
});

// Search Handler (filters by gender, religion, caste, state)
router.post('/search', isLoggedIn, (req, res) => {
  const { gender, religion, caste, state } = req.body;

  let query = 'SELECT * FROM users WHERE status = "approved"';
  const params = [];

  if (gender) {
    query += ' AND gender = ?';
    params.push(gender);
  }
  if (religion) {
    query += ' AND religion LIKE ?';
    params.push(`%${religion}%`);
  }
  if (caste) {
    query += ' AND caste LIKE ?';
    params.push(`%${caste}%`);
  }
  if (state) {
    query += ' AND state LIKE ?';
    params.push(`%${state}%`);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Search Query Error:', err.message);
      return res.status(500).send('Database error');
    }

    res.render('members/search', {
      user: req.session.user,
      results
    });
  });
});

router.get('/contact-view', isLoggedIn, (req, res) => {
  const user = req.session.user;

  const query = `
    SELECT id, name, gender, caste, religion, email
    FROM users
    WHERE id != ? AND status = 'approved'
  `;

  db.query(query, [user.id], (err, results) => {
    if (err) return res.status(500).send('DB error');

    res.render('members/contact-view', {
      user,
      contacts: results,
      viewsLeft: user.contactViews || 3 // Example limit: 3
    });
  });
});








































































router.get('/upgrade', isLoggedIn, (req, res) => {
  res.render('members/upgrade', { user: req.session.user });
});

router.post('/upgrade', isLoggedIn, (req, res) => {
  const userId = req.session.user.id;
  const { selectedPackage } = req.body;

  let expiryDate = null;
  if (selectedPackage === 'One Day') {
    expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);
  } else if (selectedPackage === 'Gold') {
    expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  } else if (selectedPackage === 'Diamond') {
    expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);
  }

  const updateQuery = `
    UPDATE users 
    SET package = ?, package_expiry = ?, contacts_left = ?, interests_used = 0, images_uploaded = 0
    WHERE id = ?
  `;

  const contacts = selectedPackage === 'Diamond' ? 100 : selectedPackage === 'Gold' ? 30 : 5;

  db.query(updateQuery, [selectedPackage, expiryDate, contacts, userId], (err) => {
    if (err) return res.status(500).send('Upgrade failed');
    res.redirect('/member/membership');
  });
});






















router.post('/send-interest', isLoggedIn, (req, res) => {
  const fromUser = req.session.user.id;
  const { toUser } = req.body;

  const query = `
    INSERT INTO interests (fromUser, toUser, status)
    VALUES (?, ?, 'sent')
    ON DUPLICATE KEY UPDATE status = 'sent'
  `;

  db.query(query, [fromUser, toUser], (err) => {
    if (err) return res.status(500).send('Error sending interest');
    res.redirect('/member/matches');
  });
});




router.post('/respond-interest', isLoggedIn, (req, res) => {
  const { interestId, status } = req.body;
  const userId = req.session.user.id;

  // Step 1: Get the fromUser of this interest
  const getQuery = `SELECT fromUser FROM interests WHERE id = ?`;

  db.query(getQuery, [interestId], (err, result) => {
    if (err || result.length === 0) {
      return res.status(500).send('Interest lookup failed');
    }

    const fromUser = result[0].fromUser;

    // Step 2: Update original interest status
    const updateQuery = `UPDATE interests SET status = ? WHERE id = ?`;

    db.query(updateQuery, [status, interestId], (err) => {
      if (err) return res.status(500).send('Error updating interest');

      // Step 3: If approved, insert reverse interest as accepted
      if (status === 'accepted') {
        const reverseInsert = `
          INSERT INTO interests (fromUser, toUser, status)
          VALUES (?, ?, 'accepted')
          ON DUPLICATE KEY UPDATE status = 'accepted'
        `;
        db.query(reverseInsert, [userId, fromUser], () => {
          return res.redirect('/member/dashboard');
        });
      } else {
        res.redirect('/member/dashboard');
      }
    });
  });
});












module.exports = router;
