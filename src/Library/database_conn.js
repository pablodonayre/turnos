const mysql = require('mysql');
const util = require('util');

const debug_console = require('debug')('MySQL');

// https://www.quora.com/How-do-I-use-a-MySQL-pool-in-multiple-files-with-Node-js


// The following variables are being validated at the INDEX file
const HOST = process.env.MYSQL_HOST;
const PORT = process.env.MYSQL_PORT;
const USERNAME = process.env.MYSQL_USER_1;
const PASSWORD = process.env.MYSQL_PASSWORD;
const DATABASE = process.env.MYSQL_DATABASE;

async function mySqlSingleConnection(sql, bind) {

    /**
     * Single MySQL connection.
     * Creates the connection, makes the query and close it to avoid concurrency conflicts.
     */

    try {

        console.log('Opening connection...')
        var connection = mysql.createConnection({
            host: HOST,
            port: PORT,
            user: USERNAME,
            password: PASSWORD,
            database: DATABASE
        });

        const query = util.promisify(connection.query).bind(connection);
        
        const rows = await query(sql, bind);
        // console.log(rows)
        // console.log(JSON.stringify(rows));

        /* 
            Se transforma la data para eviar los objetos RowDataPacket
            [
                RowDataPacket { } 
            ]
        */
       return rows;
        // return JSON.parse(JSON.stringify(rows));

    } catch (error) {
        console.log(error);
        throw new Error(error);
    } finally {
        console.log('Closing connection...');
        connection.end();
    }


    /**
     * Example of use:
     * 
     *     
        router.get('/db', async (req, res) => {
            console.log('database single connection');

            try {
                
                let rows = await db('SELECT * from articulos');
                //console.log(rows);
                res.send(rows);

            } catch (error) {
                //console.log(error);
                res.send(error.message);
            }

        });

     */

};

var pool = mysql.createPool({
    connectionLimit: 100,
    host: HOST,
    port: PORT,
    user: USERNAME,
    password: PASSWORD,
    database: DATABASE
});

const connection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            console.log("MySQL pool connected: threadId " + connection.threadId);
            const query = (sql, binding) => {
                return new Promise((resolve, reject) => {
                    connection.query(sql, binding, (err, result) => {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            };
            const release = () => {
                return new Promise((resolve, reject) => {
                    if (err) reject(err);
                    console.log("MySQL pool released: threadId " + connection.threadId);
                    resolve(connection.release());
                });
            };
            const destroy = () => {
                return new Promise((resolve, reject) => {
                    if (err) reject(err);
                    console.log("MySQL pool destroyed: threadId " + connection.threadId);
                    resolve(connection.destroy());
                });
            };            
            resolve({ query, release, destroy });
        });
    });
};


function run (conn, query) {
    return new Promise((resolve, reject) => {
        try {
            conn(query)
            .then( ok => {
                resolve(ok);
            })
            .catch(e => {
                reject(e);
            })
            .finally(() => {
                console.log('ok')
            })
        } catch (error) {
            reject(error);
        }
    });
};


module.exports.db_single = mySqlSingleConnection; //db_single; db_pool
module.exports.db_pool = { connection };
module.exports.run = run;