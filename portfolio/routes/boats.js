const express = require('express');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const ds = require('../datastore.js');
const dotenv = require('dotenv').config();
const router = express.Router();
const datastore = ds.datastore;

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json())


// Program constant declarations
const BOAT = "Boat";
const DOMAIN = process.env.AUTH0_DOMAIN;

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
async function get_boat_obj(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

// Adds a new boat to datastore, returns it's key
function post_boat(name, type, length, owner) {
    var key = datastore.key(BOAT);
    const new_boat = {"name": name, "type": type, "length": length, "owner": owner, "slip": null};
    return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

async function get_all_boats(owner, req) {
    var q = datastore.createQuery(BOAT).limit(5);
    const results = {};

    // Starts the request at the cursor if necessary
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }

    // Only includes boats that match the owner id
    const entities = await datastore.runQuery(q);
    await entities[0].filter( item => item.owner === owner );

    // Adds boat ID, self, and slip self attributes to the collection
    results.boats = entities[0].map(item => build_boat_json(item[datastore.KEY].id, item, req));

    // Adds next attribute to the collections
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
        results.next = `${req.protocol}://${req.get("host")}/boats?cursor=${entities[1].endCursor}`;
    }
    return results;
}

async function get_collection_count(owner) {
    const q = datastore.createQuery(BOAT);
	const entities = await datastore.runQuery(q);
    const items = await entities[0].filter( item => item.owner === owner );
    return items.length;
}

async function patch_boat(id, boat) {
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.save({"key":key, "data":boat});
}

async function delete_boat(bid){
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.delete(b_key);
}

async function delete_carrier_from_load(boat) {
    boat.loads.forEach( async function (item) {
        const load = await get_load_obj(item.id);
        if (load[0]) {
            let l_key = datastore.key([LOAD, parseInt(item.id,10)]);
            load[0].carrier = null;
            return datastore.save({"key": l_key, "data": load[0]});
        }
    })
}

function remove_load_from_boat(lid, load, bid, boat) {
    const l_key = datastore.key([LOAD, parseInt(lid,10)]);
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    const index = boat.loads.map(function (obj) { return obj.id; }).indexOf(lid);
    load.carrier = null;
    if (index >= 0) {
        boat.loads.splice(index, 1);
    }
    return datastore.save({"key": l_key, "data": load})
    .then( () => {
        return datastore.save({"key": b_key, "data": boat});
    })
}

function build_boat_json(bid, boat, req) {
    boat.id = bid;
    boat.self = `${req.protocol}://${req.get("host")}/boats/${bid}`;
    if (boat.slip) {
        boat.slip["self"] = `${req.protocol}://${req.get("host")}/slips/${boat.slip.id}`;
    }
    return boat;
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
// List all boats with pagination
router.get('/', useJwt(), async function(req, res) {
    try {
        if (req.user.sub) {
            const boats = await get_all_boats(req.user.sub, req);
            boats.count = await get_collection_count(req.user.sub);
            res.status(200).json(boats);
        }
    } catch (err) {
        res.status(401).send({ Error: "Invalid web token, please log in again" });
    }
});

// Get data for a specific boat for an authenticated user
router.get('/:boat_id', useJwt(), async function(req, res) {
    try {
        if (req.user.sub) {
            let boat = await get_boat_obj(req.params.boat_id);
            if (boat[0] && boat[0].owner === req.user.sub) {
                let payload = build_boat_json(req.params.boat_id, boat[0], req); 
                res.status(200).json(payload);
            } else {
                res.status(404).send({ Error: "No boat with this boat_id exists for this user" });
            }
        }
    } catch (err) {
        res.status(401).send({ Error: "Invalid web token, please log in again" });
    }
});

// Create a new boat object
router.post('/', useJwt(), async function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(406).send({ Error: 'Server only accepts application/json data' });
    } else {
        try {
            if (req.user.sub) {
                if (req.body.name && req.body.type && req.body.length && req.body.owner) {
                    const key = await post_boat(
                        req.body.name, 
                        req.body.type, 
                        req.body.length, 
                        req.body.owner
                    );
                    let boat = await datastore.get(key);
                    let payload = build_boat_json(key.id, boat[0], req);
                    res.status(201).json(payload).end();
                } else {
                    res.status(400).send({ Error: "The request object is missing at least one of the required attributes" });
                }
            }
        } catch (err) {
            res.status(401).send({ Error: "Invalid web token, please log in again" });
        }
    }
});

// Updates 0 or more boat attributes for an authenticated user
router.patch('/:boat_id', useJwt(), async function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(406).send({ Error: 'Server only accepts application/json data' });
    } else {
        try {
            if (req.user.sub) {
                let boat = await get_boat_obj(req.params.boat_id);
                if (boat[0] !== undefined && boat[0].owner === req.user.sub) {
                    let new_boat = {
                        "name": req.body.name || boat[0].name,
                        "type": req.body.type || boat[0].type,
                        "length": req.body.length || boat[0].length,
                        "owner": req.body.owner  || boat[0].owner,
                        "slip": req.body.slip || boat[0].slip
                    }
                    await patch_boat(req.params.boat_id, new_boat);
                    res.status(204).end();
                } else {
                    res.status(404).send({ Error: "No boat with this boat_id exists for this user" });
                }
            }
        } catch (err) {
            res.status(401).send({ Error: "Invalid web token, please log in again" });
        }
    }
});

// Delete a boat
// router.delete('/:boat_id', async function(req, res){
//     try {
//         if (req.user.sub) {
//             let boat = await get_boat_obj(req.params.boat_id);
//             if (boat[0] && boat[0].owner === req.user.sub) {
//                 await delete_carrier_from_load(boat[0]);
//                 await delete_boat(req.params.boat_id);
//                 res.status(204).end();
//             } else {
//                 res.status(404).send({ Error: "No boat with this boat_id exists for this user" });
//             }
//         }
//     } catch (err) {
//         res.status(401).send({ Error: "Invalid web token, please log in again" });
//     }
// });


/* ------------- End Controller Functions ------------- */
module.exports = router;
