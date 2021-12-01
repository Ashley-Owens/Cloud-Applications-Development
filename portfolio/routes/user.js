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
//   console.log(req.user);
  let user = {
    'title': 'Profile Page',
    'email': req.user.displayName,
    'id': req.user.id
  }
  console.log(user);
  res.render('profile', { user });
});


module.exports = router;