const router = module.exports = require('express').Router();

router.use('/slips', require('./slips'));
router.use('/boats', require('./boats'));