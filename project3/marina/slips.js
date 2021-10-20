const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');

const datastore = ds.datastore;

const SLIP = "Slip";
const BOAT = "Boat";

router.use(bodyParser.json());



/* ------------- Begin Slip Model Functions ------------- */
function verify_slip_data(req) {
    if (req.body.number) {
        return true;
    } return false;
}

function get_slip_id(sid) {
    const key = datastore.key([SLIP, parseInt(sid,10)]);
    return datastore.get(key);
}

function get_boat_id(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

function post_slip(number, current_boat){
    var key = datastore.key(SLIP);
	const new_slip = {"number": number, "current_boat": current_boat};
	return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

function get_slips(req){
    var q = datastore.createQuery(SLIP);
	return datastore.runQuery(q).then( (entities) => {
        return entities[0].map(ds.fromDatastore);
    });
}

function get_slip_boats(req, id){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    return datastore.get(key)
    .then( (slips) => {
        const slip = slips[0];
        const boat_keys = slip.boats.map( (b_id) => {
            return datastore.key([BOAT, parseInt(b_id,10)]);
        });
        return datastore.get(boat_keys);
    })
    .then((boats) => {
        boats = boats[0].map(ds.fromDatastore);
        return boats;
    });
}

function delete_slip(sid){
    const key = datastore.key([SLIP, parseInt(sid,10)]);
    return datastore.delete(key);
}

function put_boat_in_slip(sid, bid){
    const s_key = datastore.key([SLIP, parseInt(sid,10)]);
    return datastore.get(s_key)
    .then( (slip) => {
        slip[0].current_boat = bid;
        return datastore.save({"key":s_key, "data":slip[0]});
    });
}

function delete_slip_boat(sid) {
    const s_key = datastore.key([SLIP, parseInt(sid, 10)]);
    return datastore.get(s_key)
    .then ( slip => {
        slip[0].current_boat = null;
        return datastore.save({"key":s_key, "data":slip[0]});
    })
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/', function(req, res){
    const slips = get_slips(req)
	.then( (slips) => {
        res.status(200).json(slips);
    });
});

router.get('/:slip_id', function(req, res) {
    get_slip_id(req.params.slip_id)
    .then( slip => {
        if (slip[0]) {
            slip[0].id = req.params.slip_id
            slip[0].self = `${req.protocol}://${req.get("host")}/slips/${req.params.slip_id}`;
            res.status(200).json(slip[0]);
        } else {
            res.status(404).json({Error: "No slip with this slip_id exists"});
        }
    })
})

router.get('/:id/boats', function(req, res){
    const slips = get_slip_boats(req, req.params.id)
	.then( (slips) => {
        res.status(200).json(slips);
    });
});

router.post('/', function(req, res) {
    if (verify_slip_data(req)) {
        let curr_boat = req.body.current_boat || null;
        post_slip(req.body.number, curr_boat)
        .then( key => {
            get_slip_id(key.id)
            .then( slip => {
                if (slip[0]) {
                    slip[0].id = key.id;
                    slip[0].self = `${req.protocol}://${req.get("host")}/slips/${key.id}`;
                    res.status(201).json(slip[0]);
                }
            })
        });
    } else {
        res.status(400).send({ Error: 'The request object is missing the required number' });
    }
});

// router.put('/:id', function(req, res){
//     put_slip(req.params.id, req.body.number, req.body.current_boat)
//     .then(res.status(200).end());
// });

router.put('/:slip_id/:boat_id', function(req, res){
    get_boat_id(req.params.boat_id)
    .then ( boat => {
        if (boat[0] === undefined) {
            res.status(404).json({ Error: "The specified boat and/or slip does not exist"});
        } else {
            get_slip_id(req.params.slip_id)
            .then( slip => {
                if (slip[0] === undefined) {
                    res.status(404).json({ Error: "The specified boat and/or slip does not exist"});
                } else if (slip[0].current_boat !== null) {
                    res.status(403).json({ Error: "The slip is not empty"});
                } else {
                    put_boat_in_slip(req.params.slip_id, req.params.boat_id)
                    .then( slip => {
                        res.status(204).end();
                    })
                }
            })
        }
    })
});

router.delete('/:slip_id/:boat_id', function (req, res) {
    get_boat_id(req.params.boat_id)
    .then ( boat => {
        if (boat[0] === undefined) {
            res.status(404).json({ Error: "No boat with this boat_id is at the slip with this slip_id" });
        } else {
            get_slip_id(req.params.slip_id)
            .then ( slip => {
                if (slip[0] === undefined || slip[0].current_boat !== req.params.boat_id) {
                    res.status(404).json({ Error: "No boat with this boat_id is at the slip with this slip_id" });
                } else {
                    delete_slip_boat(req.params.slip_id)
                    .then ( slip => {
                        res.status(204).end()
                    });
                }
            })
        }
    })
});

router.delete('/:slip_id', function(req, res){
    get_slip_id(req.params.slip_id)
    .then( slip => {
        if (slip[0]) {
            delete_slip(req.params.slip_id).then(res.status(204).end())
        } else {
            res.status(404).send({ Error: "No slip with this slip_id exists" });
        }
    })
});

/* ------------- End Controller Functions ------------- */

module.exports = router;