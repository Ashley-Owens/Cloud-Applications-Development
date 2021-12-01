const router = module.exports = require('express').Router();


/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'My Name Is My Passport' });
});