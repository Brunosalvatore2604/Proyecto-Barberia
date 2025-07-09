const mysql = require('mysql2/promise');

const credenciales = {
    host: 'mysql.railway.internal',
    port: 3306,
    user: 'root',
    password: 'KgGWesCIKySnrPUBqRsDnqknulAKlrGi',
    database: 'agenda'
};

const pool = mysql.createPool(credenciales);

module.exports = pool;