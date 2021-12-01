const express = require('express');
const ds = require('../datastore.js');
const secured = require('../lib/middleware/secured');

const router = express.Router();
const datastore = ds.datastore;

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json())

// Constant declarations
const LOAD = "Load";
const BOAT = "Boat";
const OWNER = "Owner";






/* GET user profile. */
router.get('/user', secured(), function (req, res, next) {
    let user = {
        'name': `${req.user.name.givenName} ${req.user.name.familyName}`,
        'email': req.user.emails[0].value,
        'id': req.user.id
    }
    res.render('profile', { user });
});


module.exports = router;