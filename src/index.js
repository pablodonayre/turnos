const express = require('express');
const app = express();
const path = require('path');
const { DateTime } = require("luxon");
const session = require('express-session');

require('dotenv').config({ path: __dirname + '/../.env' });

const flash = require('connect-flash');
const hbs = require('hbs');
hbs.registerPartials(__dirname + '/Views/partials', function (err) { });

hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('formatFecha', (ms) => {
    return DateTime.fromMillis(Number(ms), { zone: 'America/Lima' }).toFormat('dd/MM/yyyy HH:mm');
});

app.set('view engine', 'hbs');
app.set("views", __dirname + "/Views");

app.use(flash());

app.use(express.static(__dirname + "/public"));

const { db_single, db_pool } = require('./Library/database_conn');
app.set('db_single', db_single);
app.set('db_pool', db_pool)

/**
 * CORS
 */

const cors = require('cors');

const whitelist = ['http://localhost:3000', 'http://example2.com']

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};


//app.use(cors(corsOptions));
app.use(cors());    


var sessionMiddleware = session({
    secret: 'this_could_be_in_the_env_file',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 86400000 } // 24h
});

app.use(sessionMiddleware);
app.use(flash());

require('./Modules/Auth/routes')(app);
require('./Modules/Core/routes')(app);
require('./Modules/Usuarios/routes')(app);
require('./Modules/Shift/routes')(app);

/*app.get('/server/test-route',async (req, res) => {
    //SELECT * FROM* usuarios
    // let query =  "SELECT *  FROM usuarios";
    // let data = await db_single(query);
    // console.log(data);
    // // DELETE*
    // res.send('que ondaaa wachin');

    // await listEvents();


});*/

function listenServer(port = process.env.SYSTEM_PORT) {

    app.listen(
            port, () => console.log(`Listening on port ${port}...`)
        );
}

listenServer();

