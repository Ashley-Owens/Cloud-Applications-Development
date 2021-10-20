const router = module.exports = require('express').Router();

router.use('/loads', require('./loads'));
router.use('/boats', require('./boats'));
