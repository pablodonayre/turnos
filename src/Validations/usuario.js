const Joi = require('joi');


const usuarioSchema = Joi.object({
    nombre: Joi.string()
        .min(3)
        .max(25)
        .required()
        .messages({
            "string.empty": "El Nombre es obligatorio",
            "string.min": "El Nombre debe tener mínimo 3 caracteres.",
            "string.max": "El Nombre debe tener máximo 25 caracteres."
        }),
    apellido: Joi.string()
        .min(2)
        .max(25)
        .required()
        .messages({
            "string.empty": "El Apellido es obligatorio",
            "string.min": "El Apellido debe tener mínimo 2 caracteres.",
            "string.max": "El Apellido debe tener máximo 25 caracteres."
        }),
    correo: Joi.string()
        .email()
        .required()
        .messages({
            "string.empty": "El Correo es obligatorio",
            "string.email": "El Correo no tiene un formato válido"
        }),
    password: Joi.string()
        .min(8)
        .max(20)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[^\s]+$/)
        .required()
        .messages({
            "string.pattern.base": "La contraseña debe tener una mayúscula, una minúscula, un número, un carácter especial y no contener espacios",
            "string.min": "La contraseña debe tener mínimo 8 caracteres.",
            "string.max": "La contraseña debe tener máximo 20 caracteres.",
            "any.required": "La contraseña es obligatoria.",
            "string.empty": "La contraseña no puede estar vacía."
        }),
    celular: Joi.number().allow(''),
    rol: Joi.string().required(),
    estatus: Joi.string().valid('Activo', 'Inactivo'),
    fecha_nacimiento: Joi.number().empty('').default(0),
    sueldo: Joi.number().required()
        .messages({
            "string.empty": "El Sueldo es obligatorio."
        }),
    fecha_ingreso: Joi.number().empty('').default(0),
    id_calendario: Joi.string().allow('').default(''),
    ingreso: Joi.number().empty('').default(0),
    salida: Joi.number().empty('').default(0),
    uid: Joi.string()
        .min(2)
        .max(25)
        .required()
        .messages({
            "string.empty": "El UID es obligatorio",
            "string.min": "El UID debe tener mínimo 2 caracteres.",
            "string.max": "El UID debe tener máximo 25 caracteres."
        }),
});

module.exports = { usuarioSchema };
//dfj