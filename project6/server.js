const PORT = process.env.PORT || 8080;
const express = require("express");
const crypto = require("crypto");
const app = express();
const axios = require('axios').default;
const creds = require("./credentials.js");
const ds = require('./datastore');
const datastore = ds.datastore;

app.set("trust proxy", true);
app.use(express.static("views"));
app.use(express.urlencoded({ extended: true }));

const STATE = "State";

/* createAuthUrl()
*  Adds state parameter, building a query string
*  for googleapi url.
*
*  Parameter: state - a unique random string 
*  Returns: url - string 
*/
function createAuthUrl (state) {
    let url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.profile&access_type=offline&include_granted_scopes=true&response_type=code&state=${state}&redirect_uri=${creds.web.redirect_uris[0]}&client_id=${creds.web.client_id}`;
    return url;
}

/* createTokenUrl()
*  Adds code parameter, building a query string
*  to request a token from googleapi url.
*
*  Parameter: code - a unique random string from googleapi
*  Returns: url - string 
*/
function createTokenUrl (code) {
    let url = `https://oauth2.googleapis.com/token?code=${code}&client_id=${creds.web.client_id}&client_secret=${creds.web.client_secret}&redirect_uri=${creds.web.redirect_uris[0]}&grant_type=authorization_code`;
    return url;
}

/* createGoogleAPIUrl()
*  Adds the token received to the query string
*  to request user data from googleapi url.
*
*  Parameter: code - a unique random string from googleapi
*  Returns: url - string 
*/
function createGoogleAPIUrl (token) {
    let url = `https://people.googleapis.com/v1/people/me?personFields=names&access_token=${token}`;
    return url;
}

/* exchangeForToken()
*  Using axios, makes a POST request to given
*  url at oauth2.googleapis.com in order to 
*  exchange user code for an authorization token.
*
*  Parameter: url - query strings including code
*  Returns: google API response with user data 
*/
async function exchangeForToken(url) {
    try {
      return await axios.post(url);

    } catch (error) {
      console.error(error);
    }
}

/* getUserProfile()
*  Using axios, makes a GET request to given
*  url at people.googleapis.com with user token
*  included in query string for authentication.
*
*  Parameter: url - query strings including token
*  Returns: google API response with user data 
*/
async function getUserProfile(url) {
    try {
      return await axios.get(url);

    } catch (error) {
      console.error(error);
    }
}
  
/* postState()
*  Adds verified unique state param to datastore.
*
*  Parameter: state - a random unique string 
*  Returns: datastore key to new entry 
*/
async function postState(state) {
    const key = datastore.key(STATE);
    const data = {"state": state};
    return datastore.save({"key":key, "data": data}).then(() => {return key});
}

/* stateExistsInDS()
*  Checks to see if newly created state param already 
*  exists in datastore.
*
*  Parameter: state - a random string 
*  Returns: false if state is unique, else true 
*/
async function stateExistsInDS(state) {
    var q = datastore.createQuery(STATE);
	return datastore.runQuery(q).then( (entities) => {
        
        for (let i=0; i < entities[0].length; i++) {
            if (entities[0][i].state === state) {
                return true;
            }
        }
        return false;
    });
}

/* generateState()
*  Creates a new state string of 64 random hex values.
*  Calls helper method to check for state in datastore.
*  Continues looping, ensuring that each state created 
*  is a unique value.
*
*  Returns: state - a unique random string 
*/
async function generateState() {
    // Creates new state and checks for uniqueness in datastore 
    while (true) {
        let state = crypto.randomBytes(64).toString('hex');
        let exists = await stateExistsInDS(state);
        if (!exists) {
            return state;
        }
    }
}

app.get("/oauth", async function (req, res) {
    const state = req.query.state;
    const code = req.query.code;

    // Checks for matching state in datastore
    if (await stateExistsInDS(state)) {
        // Uses the received code to request a token
        const url = await createTokenUrl(code);
        const response = await exchangeForToken(url);

        // Uses the received token to request user data
        const apiURL = createGoogleAPIUrl(response.data.access_token);
        const user = await getUserProfile(apiURL);
        console.log(user.data.names);
    } else {
        res.status(500).send({ Error: "Unable to find user state in database" });
    }
})

app.post("/", async function (req, res) {
    const state = await generateState();
    const post_key = await postState(state);
    if (post_key) {
        const googleEndpoint = createAuthUrl(state);
        res.redirect(googleEndpoint);
    } else {
        res.status(500).send({ Error: "Unable to store state in database" });
    }
});


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
