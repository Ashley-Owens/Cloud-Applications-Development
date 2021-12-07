const router = require('express').Router();
const passport = require('passport');
const dotenv = require('dotenv').config();
const querystring = require('querystring');


/*  Performs the login process. When successful, 
*   Auth0 redirects to callback URL.
*/
router.get('/login', passport.authenticate('auth0', {
  scope: 'openid email profile'}), function (req, res) {
      res.redirect('/');
});

/*  Performs final stage of authentication and redirects
*   to user requested URL.
*/
router.get('/callback', function (req, res, next) {
    passport.authenticate('auth0', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }

        req.logIn(user, async function (err) {
            if (err) { return next(err); }
            const returnTo = req.session.returnTo;
            delete req.session.returnTo;
            res.redirect(returnTo || `/users/${user.id}`);
        });
    }) (req, res, next);
});


/*  Performs session logout, redirecting to homepage */
router.get("/logout", (req, res) => {
    req.logOut();
    let returnTo = req.protocol + "://" + req.hostname;
    const port = req.socket.localPort;
  
    if (port !== undefined && port !== 80 && port !== 443) {
      returnTo =
        process.env.NODE_ENV === "production"
          ? `${returnTo}/`
          : `${returnTo}:${port}/`;
    }
    const logoutURL = new URL(
      `https://${process.env.AUTH0_DOMAIN}/v2/logout`
    );
    const searchString = querystring.stringify({
      client_id: process.env.AUTH0_CLIENT_ID,
      returnTo: returnTo
    });
    logoutURL.search = searchString;
    res.redirect(logoutURL);
});

module.exports = router;
