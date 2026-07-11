module.exports = function checkAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    return res.redirect('/auth');
};