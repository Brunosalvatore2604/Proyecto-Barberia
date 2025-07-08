const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'agendaData.json');

function leerAgenda() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            fs.writeFileSync(DATA_PATH, JSON.stringify([]));
        }
        const data = fs.readFileSync(DATA_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function guardarAgenda(agendas) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(agendas, null, 2));
}

module.exports = { leerAgenda, guardarAgenda };
