const Joi = require('joi');

const turnoSchema = Joi.object({
  titulo: Joi.string().trim().min(1).max(200).required()
    .messages({
      'string.empty': 'El título es obligatorio',
      'any.required': 'El título es obligatorio'
    }),
  inicio: Joi.number().integer().required()
    .messages({
      'any.required': 'La fecha de inicio es obligatoria',
      'number.base': 'La fecha de inicio es obligatoria'
    }),
  fin: Joi.number().integer().required()
    .greater(Joi.ref('inicio'))
    .messages({
      'any.required': 'La fecha de fin es obligatoria',
      'number.base': 'La fecha de fin es obligatoria',
      'number.greater': 'La fecha de fin debe ser posterior a la de inicio'
    })
});

module.exports = { turnoSchema };