// Program imports
const express = require('express');
const json2html = require('json-to-html');
const request = require('request');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const creds = require("./credentials.js");
const axios = require('axios').default;

// Initializes express middleware
const app = express();

// Handles POST requests
app.use(express.urlencoded({extended: true}));
app.use(express.json())

// Uses Datastore for database 
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

// Creates API routes
const boats = express.Router();
const owners = express.Router();
const login = express.Router();

// Program constant declarations
const BOAT = "Boat";
const CLIENT_ID = creds.auth0.client_id;
const CLIENT_SECRET = creds.auth0.client_secret;
const DOMAIN = creds.auth0.domain;

// Uses middleware to check Jwt token
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
    }),
  
    // Validate the audience and the issuer.
    issuer: `https://${DOMAIN}/`,
    algorithms: ['RS256']
  });

// Returns the jwt req or error if jwt is invalid
function useJwt() {
    return [
        checkJwt, 
        function(err, req, res, next){
            // res.status(err.status).json(err);
            next();
        }
    ];
}

/* ------------- Begin Boat Model Functions ------------- */
// Sets a ds object id to it's associated key.id
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

// Adds a boat to datastore, returns the id
function post_boat(name, type, length, public, owner){
    var key = datastore.key(BOAT);
	const new_boat = {
        "name": name, 
        "type": type, 
        "length": length, 
        "public": public, 
        "owner": owner
    };
	return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

// Parses a boats array to add DS key as an id and remove DS key data
// If public is true, only returns public boats, else returns all boats
function parse_boats(boats, public) {
    result = [];
    for (let i=0; i < boats.length; i++) {
        if (public && !boats[i].public) {
            continue;
        } else {
            boats[i] = fromDatastore(boats[i]);
            delete boats[i][Datastore.KEY];
            result.push(boats[i]);
        }
    }
    return result;
}

// Returns all boats associated with owner parameter, obtained 
// from auth token in the form of: "auth0|618c06f6a70765006a0d3b39"
async function get_boats(owner){
	const q = datastore.createQuery(BOAT);
	const entities = await datastore.runQuery(q);
    const items = await entities[0].filter( item => item.owner === owner );
    return items;
}

// Returns all boats in Datastore
function get_boats_unprotected(){
	const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore);
		});
}

// Returns the data associated with given boat id
async function get_boat(id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const data = await datastore.get(key);
    return data[0];
}

// Deletes the given boat id from Datastore
async function delete_boat(bid){
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.delete(b_key);
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
/*  Returns status 200 and all boats for the supplied JWT.
*   If no JWT is provided or an invalid JWT is provided, 
*   returns all public boats and 200 status code.
*/
boats.get('/', useJwt(), async function(req, res) {
    try {
        let boats = await get_boats(req.user.sub);
        let payload = parse_boats(boats, false);
        res.status(200).json(payload);
    } catch (err) {
        let boats = await get_boats_unprotected();
        let payload = parse_boats(boats, true);
        res.status(200).json(payload);
    }
});

boats.get('/:id', checkJwt, function(req, res) {
    console.log('jwt' + req.user);
    const boats = get_boat(req.params.id)
	.then( (boat) => {
        const accepts = req.accepts(['application/json', 'text/html']);
        if(boat.owner && boat.owner !== req.user.sub){
            res.status(403).send('Forbidden');
        } else if(!accepts){
            res.status(406).send('Not Acceptable');
        } else if(accepts === 'application/json'){
            res.status(200).json(boat);
        } else if(accepts === 'text/html'){
            res.status(200).send(json2html(boat).slice(1,-1));
        } else { res.status(500).send('Content type got messed up!'); }
    });
});

/*  Posts a new boat to ds, returns the id.
*   If request is not json, returns 415 + error message.
*/
boats.post('/', useJwt(), async function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    } else {
        try {
            if (req.user.sub) {
                const key = await post_boat(
                    req.body.name, 
                    req.body.type, 
                    req.body.length, 
                    req.body.public, 
                    req.user.sub
                );
                res.status(201).send('{ "id": ' + key.id + ' }');
            }
        } catch (err) {
            res.status(401).send({ Error: "missing or invalid JWT token" });
        }
    }
});

/*  Deletes owner's boat for valid JWT and specified boat_id.
*   Returns various error codes for invalid boat id, invalid JWT,
*   or non matching owner id to boat id.
*/
boats.delete('/:boat_id', useJwt(), async function(req, res) {
    // Valid JWT
    try {
        if (req.user.sub) {
            let boat = await get_boat(req.params.boat_id);
            // Boat doesn't exist
            if (!boat) {
                res.status(403).json({ Error: "no boat with this boat_id exists" });
            }
            // Deletes the boat
            else if (boat.owner === req.user.sub) {
                await delete_boat(req.params.boat_id);
                res.status(204).end();

            // Someone else owns the boat
            } else { res.status(403).end(); }
        }

    // Invalid JWT
    } catch (err) {
        res.status(401).end();
    }
})

/*  Returns all public boats for the specified owner_id.
*   If owner doesn't have any boats, returns empty array.
*   If owner not in db, returns 404 with error message.
*/
owners.get('/:owner_id/boats', async function (req, res) {
    const boats = await get_boats(req.params.owner_id);
    // Owner exists in the db
    if (boats.length > 0) {
        const payload = parse_boats(boats, true);
        res.status(200).send(payload);

    } else {
        res.status(404).send({ error: "No owner with this owner_id exists" });
    }
});

login.post('/', function(req, res){
    const username = req.body.username;
    const password = req.body.password;
    var options = { method: 'POST',
            url: `https://${DOMAIN}/oauth/token`,
            headers: { 'content-type': 'application/json' },
            body:
             { grant_type: 'password',
               username: username,
               password: password,
               client_id: CLIENT_ID,
               client_secret: CLIENT_SECRET },
            json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
        } else {
            res.send(body);
        }
    });

});

/* ------------- End Controller Functions ------------- */

app.use('/boats', boats);
app.use('/owners', owners);
app.use('/login', login);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
