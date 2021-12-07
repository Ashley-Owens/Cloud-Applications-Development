const express = require('express');
const ds = require('../datastore.js');
const router = express.Router();
const datastore = ds.datastore;

// Handles POST requests
router.use(express.urlencoded({extended: true}));
router.use(express.json());

// Constant declarations
const BOAT = "Boat";
const SLIP = "Slip";

/* ------------- Begin Slip Model Functions ------------- */
// Given a slip id, returns the associated ds slip object
function get_slip_obj(sid) {
    const key = datastore.key([SLIP, parseInt(sid,10)]);
    return datastore.get(key);
}

// Given a boat id, returns the associated ds boat object
function get_boat_obj(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

// Returns all slips in ds collection with pagination
// Uses helper method to build JSON object in proper form
async function get_all_slips(req){
    var q = datastore.createQuery(SLIP).limit(5);
    const results = {};

    // Starts the request at the cursor if necessary
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }

    // Adds slip ID and self attributes to the collection
    const entities = await datastore.runQuery(q);
    results.slips = entities[0].map(item => build_slip_json(item[datastore.KEY].id, item, req));

    // Adds next attribute to the collections
    if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
        results.next = `${req.protocol}://${req.get("host")}/boats?cursor=${entities[1].endCursor}`;
    }
    return results;
}

// Counts the number of items in a datastore collection
async function get_collection_count() {
    const q = datastore.createQuery(SLIP);
	const entities = await datastore.runQuery(q);
    return entities[0].length;
}

// Creates a new slip object in datastore
function post_slip(number, fee, location) {
    var key = datastore.key(SLIP);
	const new_slip = {
        "number": number,
        "fee": fee,
        "location": location,
        "current_boat": null
    };
	return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

// Adds a boat to a slip, updating slip and boat objects
async function put_boat_in_slip(sid, bid){
    const s_key = datastore.key([SLIP, parseInt(sid,10)]);
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    const slip = await datastore.get(s_key);
    const boat = await datastore.get(b_key);
    slip[0].current_boat = {"id": bid};
    boat[0].slip = {"id": sid};
    await datastore.save({"key":s_key, "data":slip[0]});
    await datastore.save({"key":b_key, "data":boat[0]});
}

// Removes a boat from a slip, updating slip and boat objects
async function remove_boat_from_slip(sid, bid) {
    const s_key = datastore.key([SLIP, parseInt(sid, 10)]);
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    const slip = await datastore.get(s_key);
    const boat = await datastore.get(b_key);
    slip[0].current_boat = null;
    boat[0].slip = null;
    await datastore.save({"key":s_key, "data":slip[0]});
    await datastore.save({"key":b_key, "data":boat[0]});
}

// Deletes a slip from datastore
function delete_slip(sid){
    const key = datastore.key([SLIP, parseInt(sid,10)]);
    return datastore.delete(key);
}

// Builds a JSON object to return in the response
function build_slip_json(sid, slip, req) {
    slip.id = sid;
    slip.self = `${req.protocol}://${req.get("host")}/slips/${sid}`;
    if (slip.current_boat) {
        slip.current_boat["self"] = `${req.protocol}://${req.get("host")}/boats/${slip.current_boat.id}`;
    }
    return slip;
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

/*  Lists all slips with pagination.
*   Returns: status 200 and JSON object
*/
router.get('/', async function(req, res) {
    const slips = await get_all_slips(req);
    slips.count = await get_collection_count();
    res.status(200).json(slips);
    
});

/*  Lists data related to specified slip.
*   Returns: status 200 and JSON object or
*   status 404 for inaccurate slip id.
*/
router.get('/:slip_id', async function(req, res) {
    const slip = await get_slip_obj(req.params.slip_id);
    if (slip[0]) {
        let payload = build_slip_json(req.params.slip_id, slip[0], req);
        res.status(200).json(payload);
    } else {
        res.status(404).json({Error: "No slip with this slip_id exists"});
    }
})

/*  Creates a new slip object.
*   Returns: status 201 and JSON object, status 406 for 
*   incorrect content-type, or status 404 for missing attributes.
*/
router.post('/', async function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(406).send({ Error: 'Server only accepts application/json data' });
    } else {
        if (req.body.number && req.body.fee && req.body.location) {
            const key = await post_slip(req.body.number, req.body.fee, req.body.location);
            const slip = await get_slip_obj(key.id);
            let payload = build_slip_json(key.id, slip[0], req);
            res.status(201).json(payload);
        
        } else {
            res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
        }
    }
});

/*  Puts a boat in a slip, updating both datastore objects.
*   Returns: status 204 for success, status 403 for non-empty
*   slip, or 404 for inaccurate boat/slip ids.
*/
router.put('/:slip_id/:boat_id', async function(req, res){
    const boat = await get_boat_obj(req.params.boat_id);
    const slip = await get_slip_obj(req.params.slip_id);

    // Ids are invalid
    if (!boat[0] || !slip[0]) {
        res.status(404).json({ Error: "The specified boat and/or slip does not exist"});
    } 
    // Slip is not empty
    else if (slip[0].current_boat !== null) {
        res.status(403).json({ Error: "The slip is not empty"});

    // Add boat to slip
    } else {
        await put_boat_in_slip(req.params.slip_id, req.params.boat_id);
        res.status(204).end();
    }
});

/*  Removes a boat from a slip, updating both datastore objects.
*   Returns: status 204 for success, or status 404 for inaccurate boat/slip ids.
*/
router.delete('/:slip_id/:boat_id', async function (req, res) {
    const boat = await get_boat_obj(req.params.boat_id);
    const slip = await get_slip_obj(req.params.slip_id);

    // Checks for errors before removing boat from slip
    if (!boat[0] || !boat[0].slip || !slip[0]) {
        res.status(404).json({ Error: "No boat with this boat_id is at the slip with this slip_id" });
    } 
    else if (!slip[0].current_boat || slip[0].current_boat.id !== req.params.boat_id) {
        res.status(404).json({ Error: "No boat with this boat_id is at the slip with this slip_id" });
    
    // Everything checks out, remove boat from slip
    } else {
        await remove_boat_from_slip(req.params.slip_id, req.params.boat_id);
        res.status(204).end();
    }
});

/*  Deletes a slip, updating slip and associate boat datastore objects.
*   Returns: status 204 for success, or status 404 for inaccurate slip id.
*/
router.delete('/:slip_id', async function(req, res){
    const slip = await get_slip_obj(req.params.slip_id);

    // Check for existing slip
    if (slip[0]) {

        // If slip contains a boat, remove it
        if (slip[0].current_boat) {
            await remove_boat_from_slip(req.params.slip_id, slip[0].current_boat.id);
        }
        // Delete slip and return 204
        delete_slip(req.params.slip_id).then(res.status(204).end());

    // Slip doesn't exist
    } else {
        res.status(404).send({ Error: "No slip with this slip_id exists" });
    }
});

/*  Prevents attempt to delete all objects in slip collection.
*   Returns: status 405 to disallow method
*/
router.delete('/', function(req, res){
    res.status(405).send({ Error: "Method not allowed" });
});

/* ------------- End Controller Functions ------------- */

module.exports = router;
