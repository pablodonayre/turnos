const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const usuarios = require('./Routes/usuarios');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/usuario', usuarios);

};