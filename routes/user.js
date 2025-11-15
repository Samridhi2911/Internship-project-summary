const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const db = require('../config/db');

// File uploads (profile photo, aadhaar)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Registration - Show form
router.get('/register', (req, res) => {
  res.render('user/register');
});




const bcrypt = require('bcrypt');

router.post('/register', upload.fields([
  { name: 'profile_photo' }, { name: 'aadhaar_photo' }
]), (req, res) => {
  const {
    name, father_name, mother_name, siblings, gender,about,
    job, education, native_place, state, country, salary, caste, email, password
  } = req.body;

  const profilePhoto = req.files.profile_photo ? req.files.profile_photo[0].filename : null;
  const aadhaarPhoto = req.files.aadhaar_photo ? req.files.aadhaar_photo[0].filename : null;

  // ✅ Hash the password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) throw err;

    const sql = `
      INSERT INTO users 
      (name, father_name, mother_name, siblings, gender,about, occupation, education, native_place, state, country, salary, caste, email, password, profile_photo, aadhaar_photo, is_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.query(sql, [name, father_name, mother_name, siblings,gender, about, job, education, native_place, state, country, salary, caste, email, hashedPassword, profilePhoto, aadhaarPhoto], (err) => {
      if (err) throw err;
      res.redirect('/user/login');
    });
  });
});





























// Login - Show form
router.get('/login', (req, res) => {
  res.render('user/login', { message: null });
});


router.post('/login', (req, res) => {
  const email = req.body.email.trim();
  const password = req.body.password.trim();

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.render('user/login', { message: 'Invalid credentials' });
    }

    const user = results[0];

    // ✅ Compare hashed password
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) throw err;
      if (!isMatch) {
        return res.render('user/login', { message: 'Invalid credentials' });
      }

      if (!user.is_confirmed) {
        return res.render('user/login', { message: 'Waiting for confirmation...' });
      }

      // ✅ Save user to session
      req.session.user = user;
      res.redirect('/member/dashboard');
    });
  });
});




















// Login - Handle
router.post('/login', (req, res) => {
  const email = req.body.email.trim();
  const password = req.body.password.trim();

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.render('user/login', { message: 'Invalid credentials' });
    }

    const user = results[0];

    if (user.password !== password) {
      return res.render('user/login', { message: 'Invalid credentials' });
    }

    if (!user.is_confirmed) {
      return res.render('user/login', { message: 'Waiting for confirmation...' });
    }

    // Save to session
    req.session.user = user;
    res.redirect('/member/dashboard');
  });
});


module.exports = router;
