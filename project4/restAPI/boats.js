const express = require('express');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json());

// Constant declarations
const LOAD = "Load";
const BOAT = "Boat";


/* ------------- Begin Boat Model Functions ------------- */
async function get_boat_obj(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

function get_load_obj(lid) {
    const key = datastore.key([LOAD, parseInt(lid,10)]);
    return datastore.get(key);
}

function post_boat(name, type, length) {
    var key = datastore.key(BOAT);
    const new_boat = {"name": name, "type": type, "length": length, "loads": []};
    return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

function get_all_boats(req){
    var q = datastore.createQuery(BOAT).limit(3);
    const results = {};

    // Starts the request at the cursor if necessary
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
        results.boats = entities[0].map(ds.fromDatastore);

        // Creates pagination when there are more results to show
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results.next = `${req.protocol}://${req.get("host")}/boats?cursor=${entities[1].endCursor}`;
        }
        return results;
    });
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

function put_load_in_boat(lid, load, bid, boat, req) {
    const l_key = datastore.key([LOAD, parseInt(lid,10)]);
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    let load_url = `${req.protocol}://${req.get("host")}/loads/${lid}`; 
    let boat_url = `${req.protocol}://${req.get("host")}/boats/${bid}`;
    let carrier = {"id": bid, "name": boat.name, "self": boat_url};
    let loads = {"id": lid, "self": load_url};
    
    load.carrier = carrier;
    boat.loads.push(loads);

    return datastore.save({"key": l_key, "data": load})
    .then( () => {
        return datastore.save({"key": b_key, "data": boat});
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
    let res = boat[0];
    res.id = bid;
    res.self = `${req.protocol}://${req.get("host")}/boats/${bid}`;
    return res;
}

function build_boat_load(bid, boat, req) {
    let results = {};
    results.loads = boat.loads;
    results.self = `${req.protocol}://${req.get("host")}/boats/${bid}/loads`;
    return results;
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
// List all boats with pagination
router.get('/', function(req, res){
    const boats = get_all_boats(req)
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

// List all loads for a given boat
router.get('/:boat_id/loads', function (req, res) {
    get_boat_obj(req.params.boat_id)
    .then ( boat => {
        if (boat[0]) {
            let loads = build_boat_load(req.params.boat_id, boat[0], req);
            res.status(200).json(loads);
        } else {
            res.status(404).json( { Error: "No boat with this boat_id exists" });
        }
    })
});

// Get data for a specific boat
router.get('/:boat_id', function(req, res) {
    get_boat_obj(req.params.boat_id)
    .then( (boat) => {
        if (boat[0]) {
            let payload = build_boat_json(req.params.boat_id, boat, req); 
            res.status(200).json(payload);
        } else {
            res.status(404).send({ Error: "No boat with this boat_id exists" });
        }
    }); 
})

// Create a new boat object
router.post('/', function(req, res) {
    if (req.body.name && req.body.type && req.body.length) {
        post_boat(req.body.name, req.body.type, req.body.length)
        .then( key => {
            get_boat_obj(key.id)
            .then( boat => {
                let payload = build_boat_json(key.id, boat, req);
                res.status(201).json(payload);
            })
        });
    } else {
        res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
    }
});

// Assign a load to a boat
router.put('/:boat_id/loads/:load_id', function(req, res){
    get_load_obj(req.params.load_id)
    .then ( load => {

        get_boat_obj(req.params.boat_id)
        .then( (boat) => { 
            if (boat[0] === undefined || load[0] === undefined) {
                res.status(404).json({ Error: "The specified boat and/or load does not exist"});
            }
            else if (load[0].carrier) {
                res.status(403).json({ Error: "This load is already assigned to a boat"});

            // Everything checks out, add load to boat
            } else {
                put_load_in_boat(req.params.load_id, load[0], req.params.boat_id, boat[0], req)
                .then ( () => {
                    res.status(204).end();
                })
            }
        });
    });
});

// Remove a load from a boat
router.delete('/:boat_id/loads/:load_id', function(req, res) {
    get_load_obj(req.params.load_id)
    .then ( load => {
        get_boat_obj(req.params.boat_id)
        .then ( boat => {
            if (load[0] && boat[0] && load[0].carrier !== null && load[0].carrier.id === req.params.boat_id) {
                remove_load_from_boat(req.params.load_id, load[0], req.params.boat_id, boat[0])
                .then( () => {
                    res.status(204).end();
                })
            }
            else {
                res.status(404).json({ Error: "No load with this load_id is at the boat with this boat_id"});
            }
        })
    })
})

// Delete a boat
router.delete('/:boat_id', async function(req, res){
    const boat = await get_boat_obj(req.params.boat_id);
    if (boat[0]) {
        await delete_carrier_from_load(boat[0]);
        await delete_boat(req.params.boat_id);
        res.status(204).end();
    } else {
        res.status(404).send({ Error: "No boat with this boat_id exists" });
    }
});

/* ------------- End Controller Functions ------------- */

module.exports = router;