const express = require('express');
const ds = require('../datastore.js');
const secured = require('../lib/middleware/secured');
const router = express.Router();
const datastore = ds.datastore;

// Constant declarations
const USER = "User";

function post_user(name, email, sub, boats) {
    var key = datastore.key(USER);
    const new_user = {"name": name, "email": email, "sub": sub, "boats": boats};
    return datastore.save({"key":key, "data":new_user}).then(() => {return key});
}

// Sets a ds object id to it's associated key.id
function fromDatastore(item){
    item.id = item[datastore.KEY].id;
    return item;
}

// Returns all users in Datastore
async function get_all_users() {
	const q = datastore.createQuery(USER);
	return datastore.runQuery(q).then( (entities) => {
		return entities[0].map(fromDatastore);
	});
}

// Iterates through array of DS users, returning the user
// corresponding to the requested sub id
function find_user(users, sub) {
    for (let i=0; i < users.length; i++) {
        if (users[i].sub === sub) {
            return users[i];
        }
    }
    return false;
}


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
    const boats = req.user.boats || [];
    const sub = req.params.user_id;
    const jwt = req.user.jwt;
    
    // Check if authorized user is already in the db
    const users = await get_all_users();
    const found = find_user(users, sub);

    // Fill object with user data to display on front end
    let user = {
        'name': name,
        'email': email,
        'sub': sub,
        'self': `${req.protocol}://${req.get("host")}/users/${sub}`,
        'jwt': jwt
    }

     // Add new user to the database
    if (!found) { 
        await post_user(name, email, sub, boats);
        res.status(201).render('profile', { user });

    // Return cached user profile if already logged in
    } else {
        res.render('profile', { user });
    }
});

// Unprotected route, returns all users in the db
router.get('/', async function (req, res, next) {
    const users = await get_all_users();
    res.status(200).send(users);
})

module.exports = router;
