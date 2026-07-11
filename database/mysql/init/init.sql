CREATE DATABASE IF NOT EXISTS `shift`;
USE `shift`;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `rol` varchar(30) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `estatus` tinyint(2) NOT NULL DEFAULT '1',
  `fecha_nacimiento` bigint(20) NOT NULL,
  `celular` varchar(20) NOT NULL,
  `sueldo` float(12,2) NOT NULL,
  `fecha_ingreso` bigint(20) NOT NULL,
  `creado_fecha` bigint(20) NOT NULL,
  `creado_por` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`)
);
