const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const home = require('./Routes/home');
    const sesion = require('./Routes/sesion');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/home', home);
    app.use('/sesion', sesion);

};