const express = require('express');



module.exports = function(app){
        
    /**
     * ROUTES
     **/
    
    const auth = require('./Routes/auth');
    
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    /**
     * ROUTES
     * **/
    app.use('/', auth);
    app.use('/auth', auth);

};