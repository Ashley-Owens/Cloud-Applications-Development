const express = require('express');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json())

const BOAT = "Boat";


/* ------------- Begin Boat Model Functions ------------- */
async function get_boat_obj(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
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

function build_boat_json(bid, boat, req) {
    let res = boat[0];
    res.id = bid;
    res.self = `${req.protocol}://${req.get("host")}/boats/${bid}`;
    return res;
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
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }
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
