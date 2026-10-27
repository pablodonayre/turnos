
module.exports = function (req, res, next) {

    if(req.session.user != undefined) {
        if(req.session.user.username != "") {
            console.log('Middleware-2: Autenticado');
            return res.redirect('/home');

        }
    }
    console.log('Middleware-2: [401] No autenticado');
    
    next();


};