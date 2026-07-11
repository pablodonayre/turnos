const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const home = require('./Routes/home');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/home', home);

};