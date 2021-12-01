const express = require('express');
const router = express.Router();
const ds = require('../datastore.js');
const datastore = ds.datastore;
const creds = require("../credentials.js");

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json())

// Constant declarations
const LOAD = "Load";
const BOAT = "Boat";
const OWNER = "Owner";

// const bodyParser = require('body-parser');
// router.use(bodyParser.json());

/* ------------- Begin Load Model Functions ------------- */
async function get_load_obj(lid) {
    const key = datastore.key([LOAD, parseInt(lid,10)]);
    return datastore.get(key);
}

async function get_boat_obj(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

function post_load(volume, content, creation_date) {
    var key = datastore.key(LOAD);
	const new_load = {
        "volume": volume,
        "content": content,
        "creation_date": creation_date,
        "carrier": null
    };
	return datastore.save({"key":key, "data":new_load}).then(() => {return key});
}

function get_all_loads(req){
    var q = datastore.createQuery(LOAD).limit(3);
    const results = {};

    // Starts the request at the cursor if necessary
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then( (entities) => {
        results.loads = entities[0].map(ds.fromDatastore);

        // Creates pagination when there are more results to show
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results.next = `${req.protocol}://${req.get("host")}/loads?cursor=${entities[1].endCursor}`;
        }
        return results;
    });
}

async function remove_load_from_boat(lid, load) {
    const b_key = datastore.key([BOAT, parseInt(load.carrier.id,10)]);
    const boat = await get_boat_obj(load.carrier.id);
    if (boat[0]) {
        let index = await boat[0].loads.map(function (obj) { return obj.id; }).indexOf(lid);
        if (index >= 0) {
            boat[0].loads.splice(index, 1);
            return datastore.save({"key": b_key, "data": boat[0]});
        }
    }
    return;
}

async function delete_load(lid, load){
    const l_key = datastore.key([LOAD, parseInt(lid,10)]);
    if (load.carrier) {
        await remove_load_from_boat(lid, load);
    }
    return datastore.delete(l_key);
}

function build_load_json(lid, load, req) {
    load.id = lid;
    load.self = `${req.protocol}://${req.get("host")}/loads/${lid}`;
    return load;
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// List all loads with pagination
router.get('/', function(req, res){
    const loads = get_all_loads(req)
	.then( (loads) => {
        res.status(200).json(loads);
    });
});

// Get data for a specific load
router.get('/:load_id', async function(req, res) {
    const load = await get_load_obj(req.params.load_id);
    if (load[0]) {
        let payload = build_load_json(req.params.load_id, load[0], req); 
        res.status(200).json(payload);
    } else {
        res.status(404).json({Error: "No load with this load_id exists"});
    }
})

// Create a new load object
router.post('/', function(req, res) {
    if (req.body.volume && req.body.content && req.body.creation_date) {
        post_load(req.body.volume, req.body.content, req.body.creation_date)
        .then( key => {
            get_load_obj(key.id)
            .then( load => {
                let payload = build_load_json(key.id, load[0], req);
                res.status(201).json(payload);
            })
        });
    } else {
        res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
    }
});

// Delete a load
router.delete('/:load_id', async function(req, res){
    const load = await get_load_obj(req.params.load_id);
    if (load[0]) {
        await delete_load(req.params.load_id, load[0]);
        res.status(204).end();
    } else {
        res.status(404).send({ Error: "No load with this load_id exists" });
    }

});

/* ------------- End Controller Functions ------------- */

module.exports = router;