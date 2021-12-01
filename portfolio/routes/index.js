const router = module.exports = require('express').Router();

router.use('/boats', require('./boats'));
router.use('/loads', require('./loads'));
router.use('/user', require('./user'));
router.use('/login', require('./auth'));

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'My Name Is My Passport' });
});