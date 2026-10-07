const jwt = require('jsonwebtoken');

module.exports = function (req, res, next){
    const token = req.header('x-device-token');

    if(!token){
        return res.status(400).send({
            msg: "No hay TOKEN"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        console.log('token')
        req.token_data = decoded;

        console.log(req.token_data)
        next();

    } catch (error) {
        // console.error('Nombre:', error.name);
        console.error('Mensaje:', error.message);
        // console.error('Código:', error.code);
        // console.error('Stack:', error.stack);
        return res.status(400).send({
            "detalleDelResultado": "NO_REGISTRADO",
            "message": error.message
        })
    }
}