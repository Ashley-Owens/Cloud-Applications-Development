const router = module.exports = require('express').Router();

/* GET home page */
router.get('/', function (req, res, next) {
    res.render('index');
});
