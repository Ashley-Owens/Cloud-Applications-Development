const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
router.use(bodyParser.json());
const ds = require('./datastore');
const datastore = ds.datastore;

const LOAD = "Load";
const BOAT = "Boat";


/* ------------- Begin Boat Model Functions ------------- */
function get_boat_id(bid) {
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.get(key);
}

function post_boat(name, type, length){
    var key = datastore.key(BOAT);
	const new_boat = {"name": name, "type": type, "length": length};
	return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
}

function verify_boat_data(req){
    if (req.body.name && req.body.type && req.body.length) {
        return true;
    } return false;
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

function delete_boat(bid){
    const key = datastore.key([BOAT, parseInt(bid,10)]);
    return datastore.delete(key);
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

function delete_slip_boat(sid) {
    const s_key = datastore.key([LOAD, parseInt(sid, 10)]);
    return datastore.get(s_key)
    .then ( slip => {
        slip[0].current_boat = null;
        return datastore.save({"key":s_key, "data":slip[0]});
    })
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
    get_boat_id(req.params.boat_id)
    .then( (boat) => {
        if (boat[0]) {
            boat[0].id = req.params.boat_id;
            boat[0].self = `${req.protocol}://${req.get("host")}/boats/${req.params.boat_id}`;
            res.status(200).json(boat[0]);
        } else {
            res.status(404).send({ Error: "No boat with this boat_id exists" });
        }
    }); 
})

router.post('/', function(req, res) {
    if (verify_boat_data(req)) {
        post_boat(req.body.name, req.body.type, req.body.length)
        .then( key => {
            res.status(201).json({ id: key.id, name: req.body.name, type: req.body.type, length: req.body.length, self: `${req.protocol}://${req.get("host")}/boats/${key.id}`})
        });
    } else {
        res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
    }
});

router.patch('/:boat_id', function(req, res){
    get_boat_id(req.params.boat_id)
    .then( (boat) => {
        if (boat[0] === undefined) {
            res.status(404).send({ Error: "No boat with this boat_id exists" });
        } if (!verify_boat_data(req)) {
            res.status(400).send({ Error: 'The request object is missing at least one of the required attributes' });
        } else if (boat[0]) {
            patch_boat(req.params.boat_id, req)
            .then( 
                res.status(200).json({ id: req.params.boat_id, name: req.body.name, type: req.body.type, length: req.body.length, self: `${req.protocol}://${req.get("host")}/boats/${req.params.boat_id}`})
            )
        }
    });
});

router.delete('/:boat_id', function(req, res){
    get_boat_id(req.params.boat_id)
    .then( (boat) => {
        if (boat[0] === undefined) {
            res.status(404).send({ Error: "No boat with this boat_id exists" });
        } else {
            get_slip_with_boat(req.params.boat_id)
            .then ( key => {
                if (key) {
                    delete_slip_boat(key).then( () => {
                        delete_boat(req.params.boat_id).then(res.status(204).end());
                    })
                } else {
                    delete_boat(req.params.boat_id).then(res.status(204).end());
                }
            })
        }
    })
});

/* ------------- End Controller Functions ------------- */

module.exports = router;