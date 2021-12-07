const PORT = process.env.PORT || 8080;
const express = require('express');
const exphbs = require('express-handlebars');
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
const boatsRouter = require('./routes/boats');
const slipsRouter = require('./routes/slips');
const app = express();

// View engine setup
app.engine('hbs', exphbs({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


/* Login code modified from: 
*  https://auth0.com/docs/quickstart/webapp/nodejs/01-login 
*/

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

// Routers
app.use(userInViews());
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/boats', boatsRouter);
app.use('/slips', slipsRouter);


/* ------------- Error Handling ------------- */
// Handles auth failure error messages
app.use(function (req, res, next) {
    if (req && req.query && req.query.error) {
        console.log(req);
        req.flash('error', req.query.error);
    }
    if (req && req.query && req.query.error_description) {
  
      req.flash('error_description', req.query.error_description);
    }
    next();
});

// Error handlers: catches 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Development error handler: prints stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// Production error handler: stacktraces not leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});
/* ------------- End Error Handling ------------- */

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

module.exports = app;
