const express = require('express');
const router = express.Router();
const passport = require('passport');
const dotenv = require('dotenv').config();
const querystring = require('querystring');
const ds = require('../datastore.js');
const datastore = ds.datastore;

// Constant declarations
const LOAD = "Load";
const BOAT = "Boat";
const USER = "User";


function post_user(name, email, sub) {
    var key = datastore.key(USER);
    const new_user = {"name": name, "email": email, "sub": sub, "boats": []};
    return datastore.save({"key":key, "data":new_user}).then(() => {return key});
}

async function get_user_obj(user_id) {
    const key = datastore.key([USER, parseInt(user_id,10)]);
    return datastore.get(key);
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

function find_user(users, sub) {
    for (let i=0; i < users.length; i++) {
        console.log(users[i]);
        if (users[i].sub === sub) {
            return true;
        }
    }
    return false;
}

// Perform the login, afterwards Auth0 will redirect to callback
router.get('/login', passport.authenticate('auth0', {
  scope: 'openid email profile'}), function (req, res) {
      res.redirect('/');
});

// Perform the final stage of authentication and redirect to previously requested URL or '/user'
router.get('/callback', function (req, res, next) {
    passport.authenticate('auth0', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }

        req.logIn(user, async function (err) {
            if (err) { return next(err); }

            // Parse user info from AuthO
            const name = `${user.name.givenName} ${user.name.familyName}`;
            const email = user.emails[0].value;
            const sub = user.id;
            const users = await get_all_users();
            const found = find_user(users, sub);

            // Add new user to the database
            if (!found) { 
                const key = await post_user(name, email, sub);
            }

            const returnTo = req.session.returnTo;
            delete req.session.returnTo;
            res.redirect(returnTo || '/user');
        });
    }) (req, res, next);
});

// Perform session logout and redirect to homepage
router.get("/logout", (req, res) => {
    req.logOut();
    let returnTo = req.protocol + "://" + req.hostname;
    const port = req.socket.localPort;
  
    if (port !== undefined && port !== 80 && port !== 443) {
      returnTo =
        process.env.NODE_ENV === "production"
          ? `${returnTo}/`
          : `${returnTo}:${port}/`;
    }
    const logoutURL = new URL(
      `https://${process.env.AUTH0_DOMAIN}/v2/logout`
    );
    const searchString = querystring.stringify({
      client_id: process.env.AUTH0_CLIENT_ID,
      returnTo: returnTo
    });
    logoutURL.search = searchString;
    res.redirect(logoutURL);
});

module.exports = router;