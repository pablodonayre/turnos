module.exports = (req, res, next) => {
    if (req.session.user.rol !== 'ADMIN') {
        req.flash('danger', 'No tienes permiso para acceder a esta sección.');
        return res.redirect('/auth');
    }
    next();
}