/**
 * The purpose of this middleware is to have the `user`
 * object available for all views.
 *
 */
 module.exports = function () {
    return function (req, res, next) {
      res.locals.user = req.user;
      next();
    };
};
  