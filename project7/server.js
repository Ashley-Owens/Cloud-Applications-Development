const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));

const json2html = require('json-to-html');
const request = require('request');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const creds = require("./credentials.js");
const axios = require('axios').default;

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

const BOAT = "Boat";

const router = express.Router();
const login = express.Router();

const CLIENT_ID = creds.auth0.client_id;
const CLIENT_SECRET = creds.auth0.client_secret;
const DOMAIN = creds.auth0.domain;


function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

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

// function useJwt(checkJwt, function (err, req, res, next)) {
//     return [
//         checkJwt, 
//         function(err, req, res, next){
//             res.status(err.status).json(err);
//         }
//     ];
// }

/* ------------- Begin Boat Model Functions ------------- */
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

function get_boats(owner){
	const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore).filter( item => item.owner === owner );
		});
}

function get_boats_unprotected(){
	const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore);
		});
}

function get_boat(id, owner){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.get(key).then( (data) => {
            return fromDatastore(data[0]);
        }
    );
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.use(checkJwt);
router.use(function(err, req, res, next) {
    if(err.name === 'UnauthorizedError') {
      res.status(err.status).send({message:err.message});
      return;
    }
    next();
});

router.get('/', checkJwt, function(req, res){
    console.log('jwt' + req.user);
    console.log(JSON.stringify(req.user));
    const boats = get_boats(req.user.sub)
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

router.get('/unsecure', function(req, res){
    const boats = get_boats_unprotected()
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

router.get('/:id', checkJwt, function(req, res) {
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

router.post('/', async function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    } else {
        const key = await post_boat(req.body.name, req.body.type, req.body.length, req.body.public, req.user.sub);
        res.status(201).send('{ "id": ' + key.id + ' }');
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

app.use('/boats', router);
app.use('/login', login);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
