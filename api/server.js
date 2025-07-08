const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Rutas de la API
const agendaRoutes = require('./agendaRoutes');
app.use('/api/agenda', agendaRoutes);

app.get('/', (req, res) => {
    res.send('API de Beauty Club funcionando');
});

app.listen(PORT, () => {
    console.log(`Servidor API escuchando en puerto ${PORT}`);
});
