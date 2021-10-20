const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
router.use(bodyParser.json());
const ds = require('./datastore');
const datastore = ds.datastore;

const LOAD = "Load";
const BOAT = "Boat";


/* ------------- Begin Load Model Functions ------------- */
function verify_slip_data(req) {
    if (req.body.number) {
        return true;
    } return false;
}

function get_load_id(lid) {
    const key = datastore.key([LOAD, parseInt(lid,10)]);
    return datastore.get(key);
}

function get_boat_id(bid) {
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

function get_all_loads(req) {
    var q = datastore.createQuery(LOAD);
	return datastore.runQuery(q).then( (entities) => {
        return entities[0].map(ds.fromDatastore);
    });
}

function get_slip_boats(req, id) {
    const key = datastore.key([LOAD, parseInt(id,10)]);
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

function delete_load(lid){
    const key = datastore.key([LOAD, parseInt(lid,10)]);
    return datastore.delete(key);
}

function put_load_in_boat(lid, bid){
    const l_key = datastore.key([LOAD, parseInt(lid,10)]);
    return datastore.get(l_key)
    .then( (slip) => {
        slip[0].current_boat = bid;
        return datastore.save({"key":l_key, "data":slip[0]});
    });
}

function delete_slip_boat(sid) {
    const s_key = datastore.key([LOAD, parseInt(sid, 10)]);
    return datastore.get(s_key)
    .then ( slip => {
        slip[0].current_boat = null;
        return datastore.save({"key":s_key, "data":slip[0]});
    })
}

function build_load_json(lid, load, req) {
    let res = load[0];
    res.id = lid;
    res.self = `${req.protocol}://${req.get("host")}/loads/${lid}`;
    return res;
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/', function(req, res){
    const slips = get_all_loads(req)
	.then( (slips) => {
        res.status(200).json(slips);
    });
});

router.get('/:load_id', function(req, res) {
    get_load_id(req.params.load_id)
    .then( load => {
        if (load[0]) {
            let payload = build_load_json(req.params.load_id, load, req); 
            res.status(200).json(payload);
        } else {
            res.status(404).json({Error: "No load with this load_id exists"});
        }
    })
})

router.post('/', function(req, res) {
    if (req.body.volume && req.body.content && req.body.creation_date) {
        post_load(req.body.volume, req.body.content, req.body.creation_date)
        .then( key => {
            get_load_id(key.id)
            .then( load => {
                let payload = build_load_json(key.id, load, req);
                res.status(201).json(payload);
            })
        });
    } else {
        res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
    }
});

router.get('/:id/boats', function(req, res){
    const slips = get_slip_boats(req, req.params.id)
	.then( (slips) => {
        res.status(200).json(slips);
    });
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
            get_load_id(req.params.slip_id)
            .then( slip => {
                if (slip[0] === undefined) {
                    res.status(404).json({ Error: "The specified boat and/or slip does not exist"});
                } else if (slip[0].current_boat !== null) {
                    res.status(403).json({ Error: "The slip is not empty"});
                } else {
                    put_load_in_boat(req.params.slip_id, req.params.boat_id)
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
            get_load_id(req.params.slip_id)
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

router.delete('/:load_id', function(req, res){
    get_load_id(req.params.load_id)
    .then( load => {
        if (load[0]) {
            delete_load(req.params.load_id).then(res.status(204).end())
        } else {
            res.status(404).send({ Error: "No load with this load_id exists" });
        }
    })
});

/* ------------- End Controller Functions ------------- */

module.exports = router;