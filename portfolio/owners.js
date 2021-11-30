const express = require('express');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const creds = require("./credentials.js");

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json())

// Constant declarations
const LOAD = "Load";
const BOAT = "Boat";
const OWNER = "Owner";





module.exports = router;