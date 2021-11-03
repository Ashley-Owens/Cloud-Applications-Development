const PORT = process.env.PORT || 8080;
const express = require("express");
const crypto = require("crypto");
const app = express();
const creds = require("./credentials.js");
const ds = require('./datastore');
const datastore = ds.datastore;

app.set("trust proxy", true);
app.use(express.static("views"));
app.use(express.urlencoded({ extended: true }));

const STATE = "State";

// async function get_state(sid) {
//     const key = datastore.key([STATE, sid]);
//     return datastore.get(key);
// }

function createRequestURL (state) {
    let url = `https://accounts.google.com/o/oauth2/v2/auth?
        scope=https%3A//www.googleapis.com/auth/drive.metadata.readonly&
        access_type=offline&
        include_granted_scopes=true&
        response_type=code&
        state=${state}&
        redirect_uri=${creds.web.redirect_uris[0]}&
        client_id=${creds.web.client_id}`;
    return url;
}

async function postState(state) {
    const key = datastore.key(STATE);
    const data = {"state": state};
    return datastore.save({"key":key, "data": data}).then(() => {return key});
}

async function stateExistsInDS(state) {
    var q = datastore.createQuery(STATE);
	return datastore.runQuery(q).then( (entities) => {
        
        for (let i=0; i < entities[0].length; i++) {
            // console.log(entities[0][i].state);
            if (entities[0][i].state === state) {
                return true;
            }
        }
        return false;
    });
}

async function generateState() {
    let state = crypto.randomBytes(64).toString('hex');
    let exists = await stateExistsInDS(state);

    while (exists) {
        state = crypto.randomBytes(64).toString('hex');
        exists = await stateExistsInDS(state);
    }
    return state;
}


app.post("/oauth", async function (req, res) {
    const state = await generateState();
    const post_key = await postState(state);
    const googleEndpoint = createRequestURL(state);
    console.log(googleEndpoint);
    res.redirect(googleEndpoint);
});


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
