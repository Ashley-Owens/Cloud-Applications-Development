const PORT = process.env.PORT || 8080;
const express = require('express');
const exphbs = require('express-handlebars');
const creds = require("./credentials.js");
const ds = require('./datastore.js');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const dotenv = require('dotenv').config();
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const flash = require('connect-flash');
const userInViews = require('./lib/middleware/userInViews');
const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const app = express();
const datastore = ds.datastore;

// app.use('/', require('./routes/index'));
app.use(express.urlencoded({ extended: true }));

// View engine setup
app.engine('hbs', exphbs({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Passport to use Auth0
const strategy = new Auth0Strategy(
  {
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL:
      process.env.AUTH0_CALLBACK_URL || 'http://localhost:8080/callback'
  },
  function (accessToken, refreshToken, extraParams, profile, done) {
      // accessToken is the token to call Auth0 API (not needed in the most cases)
      // extraParams.id_token has the JSON Web Token
      // profile has all the information from the user
      profile.jwt = extraParams.id_token;
      return done(null, profile);
  }
);

passport.use(strategy);

// You can use this section to keep a smaller payload
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

app.use(logger('dev'));
app.use(cookieParser());

// config express-session
const sess = {
    secret: process.env.SESSION_SECRET,
    cookie: {},
    resave: false,
    saveUninitialized: true
};

if (app.get('env') === 'production') {
    app.set('trust proxy', true);
    sess.cookie.secure = true; // serve secure cookies, requires https
}

app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Handle auth failure error messages
app.use(function (req, res, next) {
  if (req && req.query && req.query.error) {
    req.flash('error', req.query.error);
  }
  if (req && req.query && req.query.error_description) {
    req.flash('error_description', req.query.error_description);
  }
  next();
});

app.use(userInViews());
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/', usersRouter);

// Catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   const err = new Error('Not Found');
//   err.status = 404;
//   next(err);
// });

// Error handlers

// Development error handler
// Will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// Production error handler
// No stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;


// // Program imports
// const express = require('express');
// const jwt = require('express-jwt');
// const jwksRsa = require('jwks-rsa');
// const creds = require("./credentials.js");

// // Initializes express middleware
// const app = express();

// // Handles POST requests
// app.use(express.urlencoded({extended: true}));
// app.use(express.json())

// Uses Datastore for database 
// const {Datastore} = require('@google-cloud/datastore');
// const datastore = new Datastore();

// // Creates API routes
// const boats = express.Router();
// const owners = express.Router();

// // Program constant declarations
// const BOAT = "Boat";
// const CLIENT_ID = creds.auth0.client_id;
// const CLIENT_SECRET = creds.auth0.client_secret;
// const DOMAIN = creds.auth0.domain;

// // Uses middleware to check Jwt token
// const checkJwt = jwt({
//     secret: jwksRsa.expressJwtSecret({
//       cache: true,
//       rateLimit: true,
//       jwksRequestsPerMinute: 5,
//       jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
//     }),
  
//     // Validate the audience and the issuer.
//     issuer: `https://${DOMAIN}/`,
//     algorithms: ['RS256']
//   });

// // Returns the jwt req or error if jwt is invalid
// function useJwt() {
//     return [
//         checkJwt, 
//         function(err, req, res, next){
//             // res.status(err.status).json(err);
//             next();
//         }
//     ];
// }

// /* ------------- Begin Boat Model Functions ------------- */
// // Sets a ds object id to it's associated key.id
// function fromDatastore(item){
//     item.id = item[Datastore.KEY].id;
//     return item;
// }

// // Adds a boat to datastore, returns the id
// function post_boat(name, type, length, public, owner){
//     let key = datastore.key(BOAT);
// 	const new_boat = {
//         "name": name, 
//         "type": type, 
//         "length": length, 
//         "public": public, 
//         "owner": owner
//     };
// 	return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
// }

// // Parses a boats array to add DS key as an id and remove DS key data
// // If public is true, only returns public boats, else returns all boats
// function parse_boats(boats, public) {
//     result = [];
//     for (let i=0; i < boats.length; i++) {
//         if (public && !boats[i].public) {
//             continue;
//         } else {
//             boats[i] = fromDatastore(boats[i]);
//             delete boats[i][Datastore.KEY];
//             result.push(boats[i]);
//         }
//     }
//     return result;
// }

// // Returns all boats associated with owner parameter, obtained 
// // from auth token in the form of: "auth0|618c06f6a70765006a0d3b39"
// async function get_boats(owner){
// 	const q = datastore.createQuery(BOAT);
// 	const entities = await datastore.runQuery(q);
//     const items = await entities[0].filter( item => item.owner === owner );
//     return items;
// }

// // Returns all boats in Datastore
// function get_boats_unprotected() {
// 	const q = datastore.createQuery(BOAT);
// 	return datastore.runQuery(q).then( (entities) => {
// 			return entities[0].map(fromDatastore);
// 		});
// }

// // Returns the data associated with given boat id
// async function get_boat(id){
//     const key = datastore.key([BOAT, parseInt(id,10)]);
//     const data = await datastore.get(key);
//     return data[0];
// }

// // Deletes the given boat id from Datastore
// async function delete_boat(bid){
//     const b_key = datastore.key([BOAT, parseInt(bid,10)]);
//     return datastore.delete(b_key);
// }

// /* ------------- End Model Functions ------------- */

// /* ------------- Begin Controller Functions ------------- */
// /*  Returns status 200 and all boats for the supplied JWT.
// *   If no JWT is provided or an invalid JWT is provided, 
// *   returns all public boats and 200 status code.
// */
// boats.get('/', useJwt(), async function(req, res) {
//     try {
//         let boats = await get_boats(req.user.sub);
//         let payload = parse_boats(boats, false);
//         res.status(200).json(payload);
//     } catch (err) {
//         let boats = await get_boats_unprotected();
//         let payload = parse_boats(boats, true);
//         res.status(200).json(payload);
//     }
// });

// /*  Posts a new boat to ds, returns the id.
// *   If request is not json, returns 415 + error message.
// */
// boats.post('/', useJwt(), async function(req, res) {
//     if (req.get('content-type') !== 'application/json') {
//         res.status(415).send('Server only accepts application/json data.');
//     } else {
//         try {
//             if (req.user.sub) {
//                 const key = await post_boat(
//                     req.body.name, 
//                     req.body.type, 
//                     req.body.length, 
//                     req.body.public, 
//                     req.user.sub
//                 );
//                 res.status(201).send('{ "id": ' + key.id + ' }');
//             }
//         } catch (err) {
//             res.status(401).send({ Error: "missing or invalid JWT token" });
//         }
//     }
// });

// /*  Deletes owner's boat for valid JWT and specified boat_id.
// *   Returns letious error codes for invalid boat id, invalid JWT,
// *   or non matching owner id to boat id.
// */
// boats.delete('/:boat_id', useJwt(), async function(req, res) {
//     // Valid JWT
//     try {
//         if (req.user.sub) {
//             let boat = await get_boat(req.params.boat_id);
//             // Boat doesn't exist
//             if (!boat) {
//                 res.status(403).json({ Error: "no boat with this boat_id exists" });
//             }
//             // Deletes the boat
//             else if (boat.owner === req.user.sub) {
//                 await delete_boat(req.params.boat_id);
//                 res.status(204).end();

//             // Someone else owns the boat
//             } else { res.status(403).end(); }
//         }

//     // Invalid JWT
//     } catch (err) {
//         res.status(401).end();
//     }
// })

// /*  Returns all public boats for the specified owner_id.
// *   If owner doesn't have any boats, returns empty array.
// *   If owner not in db, returns 404 with error message.
// */
// owners.get('/:owner_id/boats', async function (req, res) {
//     const boats = await get_boats(req.params.owner_id);
//     // Owner exists in the db
//     if (boats.length > 0) {
//         const payload = parse_boats(boats, true);
//         res.status(200).send(payload);

//     } else {
//         res.status(404).send({ error: "No owner with this owner_id exists" });
//     }
// });

// /* ------------- End Controller Functions ------------- */

// app.use('/boats', boats);
// app.use('/owners', owners);

// // Listen to the App Engine-specified port, or 8080 otherwise
// const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
