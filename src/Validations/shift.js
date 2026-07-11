const Joi = require('joi');

const marcarSchema = Joi.object({
    correo: Joi.string().email().required()
});

module.exports = { marcarSchema };