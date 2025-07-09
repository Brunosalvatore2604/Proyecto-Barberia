const mysql = require('mysql2/promise');

const credenciales = {
    host: 'mysql.railway.internal',
    port: 3306,
    user: 'root',
    password: 'KgGWesCIKySnrPUBqRsDnqknulAKlrGi',
    database: 'agenda'
};

// Conexión para crear la base si no existe
async function initDB() {
    // Conexión sin base para crearla si no existe
    const conn = await mysql.createConnection({
        host: credenciales.host,
        port: credenciales.port,
        user: credenciales.user,
        password: credenciales.password
    });
    await conn.query('CREATE DATABASE IF NOT EXISTS agenda');
    await conn.end();

    // Conexión a la base agenda
    const pool = mysql.createPool(credenciales);
    // Crear tabla si no existe
    await pool.query(`
        CREATE TABLE IF NOT EXISTS turnos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            telefono VARCHAR(30) NOT NULL,
            servicio VARCHAR(50) NOT NULL,
            fecha DATE NOT NULL,
            hora TIME NOT NULL,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    return pool;
}

module.exports = { initDB };