const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'El email es obligatorio',
      'string.email': 'Email inválido'
    }),

  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[^\s]+$/)
    .required()
    .messages({
      'string.empty': 'La contraseña es obligatoria',
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.pattern.base':
        'La contraseña debe tener una mayúscula, una minúscula, un número, un carácter especial y no contener espacios'
    })
});

const validateTokenSchema = Joi.object({
    correo: Joi.string().email().required()
    //token: Joi.string().required()
});

module.exports = { loginSchema, validateTokenSchema };