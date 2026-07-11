const jwt = require('jsonwebtoken');

module.exports = function (req, res, next){
    const token = req.header('x-auth-token');

    if(!token){
        return res.status(400).send({
            msg: "No hay TOKEN"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        req.token_data = decoded;

        console.log(req.token_data)
        next();

    } catch (error) {
        return res.status(400).send({
            msg: "El TOKEN no es valido"
        })
    }
}