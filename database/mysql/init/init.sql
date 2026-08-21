-- --------------------------------------------------------
-- Host:                         104.248.230.126
-- Server version:               5.7.44 - MySQL Community Server (GPL)
-- Server OS:                    Linux
-- HeidiSQL Version:             12.10.1.133
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for Shift
CREATE DATABASE IF NOT EXISTS `Shift` /*!40100 DEFAULT CHARACTER SET latin1 */;
USE `Shift`;

-- Dumping structure for table Shift.dispositivos
CREATE TABLE IF NOT EXISTS `dispositivos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `modo` varchar(50) NOT NULL,
  `test_interval_ms` int(11) NOT NULL,
  `creado_fecha` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;

-- Dumping data for table Shift.dispositivos: ~0 rows (approximately)
INSERT INTO `dispositivos` (`id`, `nombre`, `modo`, `test_interval_ms`, `creado_fecha`) VALUES
	(1, 'VORTEX-INHOUSE', 'TEST', 3000, 1787273854572);

-- Dumping structure for table Shift.log
CREATE TABLE IF NOT EXISTS `log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `tipo` tinyint(2) NOT NULL DEFAULT '1',
  `fecha_hora` bigint(20) NOT NULL,
  `creado_fecha` bigint(20) NOT NULL,
  `alerta` tinyint(4) NOT NULL,
  `alerta_msg` varchar(255) NOT NULL,
  `estatus` tinyint(2) NOT NULL DEFAULT '1',
  `comentario` varchar(200) NOT NULL,
  `archivo_server` varchar(255) NOT NULL,
  `archivo_usuario` varchar(255) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `dispositivo` varchar(50) NOT NULL,
  `accion` varchar(50) NOT NULL,
  `timestamp` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `log_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=114 DEFAULT CHARSET=latin1;

-- Dumping data for table Shift.log: ~28 rows (approximately)
INSERT INTO `log` (`id`, `usuario_id`, `tipo`, `fecha_hora`, `creado_fecha`, `alerta`, `alerta_msg`, `estatus`, `comentario`, `archivo_server`, `archivo_usuario`, `uid`, `dispositivo`, `accion`, `timestamp`) VALUES
	(53, 2, 1, 1783196555698, 1783196555698, 0, '', 1, 'SALI TARDE Y HUBO TRAFICO', '1783472451161_cat.jpeg', 'cat.jpeg', '', '', '', ''),
	(54, 2, 0, 1783196744920, 1783196744920, 0, '', 1, '', '', '', '', '', '', ''),
	(64, 2, 1, 1783281488530, 1783281488530, 1, 'Llegaste tarde por 277 min', 1, 'NI IDEA DE POR QUE ES QUE ME SALE ERROR', '', '', '', '', '', ''),
	(71, 1, 1, 1783283883072, 1783283883072, 1, 'Llegaste tarde por 38 min', 1, '', '', '', '', '', '', ''),
	(78, 1, 0, 1783287350532, 1783287350532, 0, 'Salida registrada', 1, '', '', '', '', '', '', ''),
	(81, 1, 0, 1783287410037, 1783287410037, 0, 'Saliste temprano por 23 min', 1, '', '', '', '', '', '', ''),
	(90, 1, 1, 1783459632689, 1783459632689, 1, 'Llegaste tarde por 387 min', 1, '', '', '', '', '', '', ''),
	(91, 1, 0, 1783460950292, 1783460950292, 0, 'Saliste tarde por 1129 min', 1, '', '', '', '', '', '', ''),
	(92, 1, 1, 1783460965511, 1783460965511, 1, 'Llegaste tarde por 169 min', 1, '', '', '', '', '', '', ''),
	(93, 1, 0, 1783460969543, 1783460969543, 0, 'Saliste tarde por 1129 min', 1, '', '', '', '', '', '', ''),
	(94, 1, 1, 1783461625815, 1783461625815, 1, 'Llegaste tarde por 180430250 min', 1, '', '', '', '', '', '', ''),
	(95, 1, 0, 1783461695036, 1783461695036, 0, 'Saliste tarde por 1141583933 min', 1, '', '', '', '', '', '', ''),
	(96, 1, 1, 1783461925603, 1783461925603, 1, 'Llegaste tarde por 185 min', 1, '', '', '', '', '', '', ''),
	(97, 1, 0, 1783462206934, 1783462206934, 0, 'Saliste tarde por 1150 min', 1, '', '', '', '', '', '', ''),
	(98, 1, 1, 1783462308650, 1783462308650, 1, 'Llegaste tarde por 192 min', 1, '', '', '', '', '', '', ''),
	(99, 1, 0, 1783462622331, 1783462622331, 0, 'Saliste temprano por 1157 min', 1, 'tgdrgdg', '1783474273313_slide1.jpg', 'slide1.jpg', '', '', '', ''),
	(100, 1, 1, 1783463696758, 1783463696758, 1, 'Llegaste tarde por 155 min', 1, '...', '1783472408630_pruebaFiltro.png', 'pruebaFiltro.png', '', '', '', ''),
	(101, 1, 0, 1783472472606, 1783472472606, 0, 'Saliste temprano por 119 min', 2, 'saasa', '1783472565192_p2.png', 'p2.png', '', '', '', ''),
	(102, 1, 1, 1783472666709, 1783472666709, 1, 'Llegaste tarde por 304 min', 1, '', '1783473640142_pagosregistro.png', 'pagosregistro.png', '', '', '', ''),
	(103, 1, 0, 1783472707482, 1783472707482, 0, 'Saliste temprano por 115 min', 1, 'gfgfg', '1783473062955_PRUEBA1.png', 'PRUEBA1.png', '', '', '', ''),
	(104, 1, 1, 1783472722989, 1783472722989, 1, 'Llegaste tarde por 305 min', 1, 'ni idea', '1783473007046_PRUEBA..png', 'PRUEBA..png', '', '', '', ''),
	(105, 1, 0, 1783474428195, 1783474428195, 0, 'Saliste temprano por 87 min', 1, '', '', '', '', '', '', ''),
	(106, 1, 1, 1783474441984, 1783474441984, 1, 'Llegaste tarde por 334 min', 1, '', '', '', '', '', '', ''),
	(107, 1, 0, 1783476885331, 1783476885331, 0, 'Saliste temprano por 46 min', 1, '', '', '', '', '', '', ''),
	(108, 1, 1, 1783476905524, 1783476905524, 1, 'Llegaste tarde por 375 min', 1, '1\n2\n3', '1783478467714_pago.jpeg', 'pago.jpeg', '', '', '', ''),
	(109, 1, 0, 1783479317971, 1783479317971, 0, 'Saliste temprano por 5 min', 1, '', '', '', '', '', '', ''),
	(110, 1, 1, 1783479379081, 1783479379081, 1, 'Llegaste tarde por 416 min', 1, '', '', '', '', '', '', ''),
	(111, 1, 0, 1783479696958, 1783479696958, 0, 'Saliste tarde por 1 min', 1, '', '', '', '', '', '', ''),
	(112, 1, 1, 1787090107701, 1787090107701, 1, 'Llegaste tarde por 115 min', 1, '', '', '', '21 0C 83 2F', 'VORTEX-INHOUSE', 'ENTRADA', '1787089795'),
	(113, 1, 0, 1787090217681, 1787090217681, 0, 'Saliste temprano por 304 min', 1, '', '', '', '21 0C 83 2F', 'VORTEX-INHOUSE', 'ENTRADA', '1787090168');

-- Dumping structure for table Shift.turnos
CREATE TABLE IF NOT EXISTS `turnos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inicio` bigint(20) NOT NULL,
  `fin` bigint(20) NOT NULL,
  `titulo` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1;

-- Dumping data for table Shift.turnos: ~2 rows (approximately)
INSERT INTO `turnos` (`id`, `inicio`, `fin`, `titulo`) VALUES
	(6, 1783436400000, 1783479600000, 'segundo turno 1'),
	(10, 1783425600000, 1783447200000, 'primer turno');

-- Dumping structure for table Shift.user_status
CREATE TABLE IF NOT EXISTS `user_status` (
  `usuario_id` int(11) NOT NULL,
  `estado` tinyint(2) NOT NULL DEFAULT '1',
  `actualizado_fecha` bigint(20) NOT NULL,
  PRIMARY KEY (`usuario_id`),
  CONSTRAINT `user_status_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Dumping data for table Shift.user_status: ~0 rows (approximately)
INSERT INTO `user_status` (`usuario_id`, `estado`, `actualizado_fecha`) VALUES
	(1, 0, 1787090217681),
	(2, 0, 1783290603599);

-- Dumping structure for table Shift.usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) CHARACTER SET utf8 NOT NULL,
  `apellido` varchar(100) CHARACTER SET utf8 NOT NULL,
  `rol` varchar(30) CHARACTER SET utf8 NOT NULL,
  `correo` varchar(150) CHARACTER SET utf8 NOT NULL,
  `password` varchar(255) CHARACTER SET utf8 NOT NULL,
  `estatus` tinyint(2) NOT NULL DEFAULT '1',
  `fecha_nacimiento` bigint(20) NOT NULL,
  `celular` varchar(20) CHARACTER SET utf8 NOT NULL,
  `sueldo` float(12,2) NOT NULL,
  `fecha_ingreso` bigint(20) NOT NULL,
  `creado_fecha` bigint(20) NOT NULL,
  `creado_por` int(11) NOT NULL,
  `token` varchar(255) CHARACTER SET utf8 NOT NULL,
  `id_calendario` varchar(255) NOT NULL,
  `uid` varchar(255) NOT NULL,
  `ingreso` bigint(20) NOT NULL,
  `salida` bigint(20) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `correo` (`correo`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1;

-- Dumping data for table Shift.usuarios: ~4 rows (approximately)
INSERT INTO `usuarios` (`id`, `nombre`, `apellido`, `rol`, `correo`, `password`, `estatus`, `fecha_nacimiento`, `celular`, `sueldo`, `fecha_ingreso`, `creado_fecha`, `creado_por`, `token`, `id_calendario`, `uid`, `ingreso`, `salida`) VALUES
	(1, 'Kimberly', 'Ruiz', 'ADMIN', 'kim.ruiz.g@gmail.com', '$2b$10$vmhvhnyCB33ePE/DgtWKxOnkI.RCyCAy6KPlKe3zV3RaXFnfKGRYO', 1, 0, '', 11.00, 0, 1773523517406, 16, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJpYXQiOjE3ODI4NTk4MjMsImV4cCI6MTc4NTQ1MTgyM30.krAy4z_DZVZarx3LSdT3Ss1FHyDut84CnVK96trDDkY', 'c_66a9dd4329e5a51d96ab34a7dd5294555983e26b423884361a6ffb7557e7c7d2@group.calendar.google.com', '21 0C 83 2F', 1786996800000, 1787022000000),
	(2, 'matias', 'bascope', 'USER', 'matias@gmail.com', '$2b$10$Ip/fgIFYFvkTxAR2pgArq.yAFwt9NmmDGi1bNa7SFounDZbsYKGjq', 1, 0, '958965898', 10.00, 0, 1783132553779, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJpYXQiOjE3ODMxOTUwNzEsImV4cCI6MTc4NTc4NzA3MX0.s6SlG1B_Clv2n4iRSuCAkedmN5aGsaAOEHJLzASn3nE', '64832c19a87c0abf39041ea6293f0a785b788d097427483e958de90b916a719c@group.calendar.google.com', '', 50400000, 79200000),
	(3, 'Maria', 'Fernandez', 'USER', 'maria@gmail.com', '$2b$10$qJP.95b42UZXD/obpLQvo.XUULcoNyzcVIcsOfT0MywpJyQQ6EDwi', 0, 962686800000, '', 0.01, 0, 1783201858314, 1, '', 'efrfdg', '', 39600000, 50400000),
	(5, 'Marco', 'Nakasone', 'USER', 'marco@gmail.com', '$2b$10$h5Lns1iG1eLBiaAk4Uy8Y.mCo0TSjXeY4S5e5h/PxhpGDe11x3vdq', 1, 0, '', 1200.00, 0, 1783283496963, 1, '', '', '', 8100000, 3600000);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;