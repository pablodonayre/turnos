const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const logs = require('./Routes/logs');
    const shift = require('./Routes/shift');
    const turnos = require('./Routes/turnos');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/logs', logs);
    app.use('/shift', shift);
    app.use('/turnos', turnos);

};