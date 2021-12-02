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
const USER = "User";


function post_user(name, email, sub, boats) {
    var key = datastore.key(USER);
    const new_user = {"name": name, "email": email, "sub": sub, "boats": boats};
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
        // console.log(users[i]);
        if (users[i].sub === sub) {
            return users[i];
        }
    }
    return false;
}


/* GET user profile. */
router.get('/users/:user_id', secured(), async function (req, res, next) {
    // Parse user info from AuthO
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
    
    // Check is authorized user is already in the db
    const users = await get_all_users();
    const found = find_user(users, sub);

     // Add new user to the database
    if (!found) { 
        const key = await post_user(name, email, sub, boats);
    }
    
    let user = {
        'name': name,
        'email': email,
        'id': sub,
        'jwt': jwt
    }
    res.render('profile', { user });
});


module.exports = router;
