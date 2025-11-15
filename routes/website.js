const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('website/home', { title: 'Welcome to MatrimoniX' });
});

router.get('/about', (req, res) => {
    res.render('website/about', { title: 'About Us' });
});

router.get('/contact', (req, res) => {
    res.render('website/contact', { title: 'Contact Us' });
});


router.get('/stories', (req, res) => {
  res.render('website/stories');
});


module.exports = router;
