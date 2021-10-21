const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
router.use(bodyParser.json());
const ds = require('./datastore');
const datastore = ds.datastore;

const LOAD = "Load";
const BOAT = "Boat";


/* ------------- Begin Boat Model Functions ------------- */
function get_boat_obj(bid) {
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

function get_boats(){
    var q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
		return entities[0].map(ds.fromDatastore);
	});
}

function patch_boat(id, req){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const boat = {"name": req.body.name, "type": req.body.type, "length": req.body.length};
    return datastore.save({"key":key, "data":boat});
}

function delete_boat(bid, boat){
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    boat.loads.forEach( item => {
        get_load_obj(item.id)
        .then (load => {
            if (load[0]) {
                const l_key = datastore.key([LOAD, parseInt(item.id,10)]);
                load[0].carrier = null;
                return datastore.save({"key": l_key, "data": load[0]});
            }
        })
    });
    return datastore.delete(b_key);
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

function delete_load_from_boat(lid, load, bid, boat) {
    const l_key = datastore.key([LOAD, parseInt(lid,10)]);
    const b_key = datastore.key([BOAT, parseInt(bid,10)]);
    const index = boat.loads.map(function (obj) { return obj.id; }).indexOf(lid);
    load.carrier = null;
    if (index >= 0) {
        boat.loads.splice(index, 1);
    }
    // console.log("boat load after is: ", boat);
    return datastore.save({"key": l_key, "data": load})
    .then( () => {
        return datastore.save({"key": b_key, "data": boat});
    })
}

function get_slip_with_boat(bid) {
    var q = datastore.createQuery(LOAD);
	return datastore.runQuery(q).then( (entities) => {
        
        for (let i=0; i < entities[0].length; i++) {
            if (entities[0][i].current_boat === bid) {
                let sid = entities[0][i][datastore.KEY].id;
                return sid;
            }
        }
        return null;
    });
}

function build_boat_json(bid, boat, req) {
    let res = boat[0];
    res.id = bid;
    res.self = `${req.protocol}://${req.get("host")}/boats/${bid}`;
    return res;
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
    const boats = get_boats()
	.then( (boats) => {
        res.status(200).json(boats);
    });
});

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
                delete_load_from_boat(req.params.load_id, load[0], req.params.boat_id, boat[0])
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
router.delete('/:boat_id', function(req, res){
    get_boat_obj(req.params.boat_id)
    .then( (boat) => {
        if (boat[0]) {
            delete_boat(req.params.boat_id, boat[0]).then(res.status(204).end());
        } else {
            res.status(404).send({ Error: "No boat with this boat_id exists" });
        }
    })
});

/* ------------- End Controller Functions ------------- */

module.exports = router;