const express = require('express');
const router = express.Router();
const { leerAgenda, guardarAgenda } = require('./agendaData');

// Horarios disponibles por día (ejemplo: 10 horarios fijos)
const HORARIOS = [
    '09:00', '09:30', '10:00', '10:30', '11:00',
    '11:30', '12:00', '12:30', '13:00', '13:30'
];

// Obtener todos los turnos de un día
router.get('/', (req, res) => {
    const { fecha } = req.query;
    const agendas = leerAgenda();
    if (fecha) {
        const turnosDia = agendas.filter(t => t.fecha === fecha);
        // Devolver todos los horarios posibles y los ocupados
        const horarios = HORARIOS.map(hora => {
            const turno = turnosDia.find(t => t.hora === hora);
            return {
                hora,
                ocupado: !!turno,
                nombre: turno ? turno.nombre : null,
                servicio: turno ? turno.servicio : null
            };
        });
        return res.json({ fecha, horarios });
    }
    res.json(agendas);
});

// Crear un nuevo turno
router.post('/', (req, res) => {
    const { nombre, telefono, servicio, fecha, hora } = req.body;
    if (!nombre || !telefono || !servicio || !fecha || !hora) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    const agendas = leerAgenda();
    // Verificar si el horario ya está ocupado
    if (agendas.find(t => t.fecha === fecha && t.hora === hora)) {
        return res.status(409).json({ error: 'Ese horario ya está ocupado' });
    }
    const nuevoTurno = {
        id: Date.now(),
        nombre,
        telefono,
        servicio,
        fecha,
        hora
    };
    agendas.push(nuevoTurno);
    guardarAgenda(agendas);
    res.status(201).json(nuevoTurno);
});

// Eliminar un turno por id
router.delete('/:id', (req, res) => {
    let agendas = leerAgenda();
    const id = parseInt(req.params.id);
    const inicial = agendas.length;
    agendas = agendas.filter(turno => turno.id !== id);
    if (agendas.length === inicial) {
        return res.status(404).json({ error: 'Turno no encontrado' });
    }
    guardarAgenda(agendas);
    res.json({ mensaje: 'Turno eliminado' });
});

module.exports = router;
