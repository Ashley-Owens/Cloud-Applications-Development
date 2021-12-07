const express = require('express');
const ds = require('../datastore.js');
const secured = require('../lib/middleware/secured');
const router = express.Router();
const datastore = ds.datastore;

// Constant declarations
const USER = "User";

/* ------------- Begin User Model Functions ------------- */

// Creates a new user object in datastore
function post_user(name, email, sub) {
    var key = datastore.key(USER);
    const new_user = {"name": name, "email": email, "sub": sub, "boats": []};
    return datastore.save({"key":key, "data":new_user}).then(() => {return key});
}

// Returns all users in ds collection
// Uses helper method to build JSON object in proper form
async function get_all_users(req) {
    var q = datastore.createQuery(USER);
    const entities = await datastore.runQuery(q);
    
    // Adds user ID and self attributes to the collection
    const results = entities[0].map(item => build_user_json(item[datastore.KEY].id, item, req));
    return results;
}

// Iterates through array of DS users, returning the user
// corresponding to the requested sub id parameter
function find_user(users, sub) {
    for (let i=0; i < users.length; i++) {
        if (users[i].sub === sub) {
            return users[i];
        }
    }
    return false;
}

// Builds a JSON object to return in the response
function build_user_json(uid, user, req) {
    user.id = uid;
    user.self = `${req.protocol}://${req.get("host")}/users/${uid}`;
    if (user.boats.length > 0) {
        user.boats.map(boat => boat.self = `${req.protocol}://${req.get("host")}/boats/${boat.id}`);
    }
    return user;
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

/* GET user profile from Auth0 or google-oauth2 */
router.get('/:user_id', secured(), async function (req, res, next) {
    // Parse user info from 3rd party auth service
    let name;
    if ((req.user.name.givenName !== undefined) && (req.user.name.familyName !== undefined)) {
        name = `${req.user.name.givenName} ${req.user.name.familyName}`;
    } else {
        name = req.user.nickname;
    }
    const email = req.user.emails[0].value;
    const sub = req.params.user_id;
    const jwt = req.user.jwt;
    
    // Check if authorized user is already in the db
    const users = await get_all_users(req);
    const found = find_user(users, sub);

    // Fill object with user data to display on front end
    let user = {
        'name': name,
        'email': email,
        'sub': sub,
        'self': `${req.protocol}://${req.get("host")}/users/${sub}`,
        'jwt': jwt
    };

    // Add new user to the database
    if (!found) { 
        await post_user(name, email, sub);
        res.status(201).render('profile', { user });

    // Return cached user profile if already logged in
    } else {
        res.render('profile', { user });
    }
});

/* Unprotected route, returns all users in the db */
router.get('/', async function (req, res, next) {
    const users = await get_all_users(req);
    res.status(200).send(users);
})

module.exports = router;
