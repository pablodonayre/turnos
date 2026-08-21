const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const logs = require('./Routes/logs');
    const shift = require('./Routes/shift');
    const turnos = require('./Routes/turnos');
    const rfid = require('./Routes/rfid');
    const ordenes = require('./Routes/ordenes');
    const estado = require('./Routes/estado');
    const dispositivos = require('./Routes/dispositivos');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/logs', logs);
    app.use('/shift', shift);
    app.use('/turnos', turnos);
    app.use('/rfid', rfid);
    app.use('/ordenes', ordenes);
    app.use('/estado', estado);
    app.use('/dispositivos', dispositivos);

};