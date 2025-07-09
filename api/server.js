const express = require('express');
const path = require('path');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar la base y tabla al levantar el server.js usando la función de db.js.
let pool;

initDB().then((p) => {
    pool = p;
    console.log('Base de datos y tabla listas');
}).catch(err => {
    console.error('Error inicializando la base de datos:', err);
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
