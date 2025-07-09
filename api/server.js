const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Probar conexión a la base de datos al iniciar
pool.getConnection()
    .then(conn => {
        console.log('Conexión a MySQL establecida correctamente');
        conn.release();
    })
    .catch(err => {
        console.error('Error al conectar a MySQL:', err);
    });

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal: servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
