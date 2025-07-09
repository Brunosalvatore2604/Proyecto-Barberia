const express = require('express');
const path = require('path');
const pool = require('./db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configuración de nodemailer para Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'beautyclub.automatic@gmail.com',
        pass: 'woqz dinq lltc jgly'
    }
});

// Probar conexión de nodemailer al iniciar
transporter.verify(function(error, success) {
    if (error) {
        console.error('Error al conectar con nodemailer:', error);
    } else {
        console.log('Nodemailer listo para enviar correos');
    }
});

// Endpoint para obtener horarios disponibles de un día
app.get('/api/horarios', async (req, res) => {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
    const HORARIOS = [
        '09:00', '09:30', '10:00', '10:30', '11:00',
        '11:30', '12:00', '12:30', '13:00', '13:30'
    ];
    try {
        const [rows] = await pool.query('SELECT hora FROM turnos WHERE fecha = ?', [fecha]);
        const ocupados = rows.map(r => r.hora.slice(0,5));
        const disponibles = HORARIOS.filter(h => !ocupados.includes(h));
        res.json({ fecha, disponibles });
    } catch (err) {
        res.status(500).json({ error: 'Error consultando horarios' });
    }
});

// Endpoint para agendar un turno
app.post('/api/turnos', async (req, res) => {
    const { correo, telefono, servicio, fecha, hora, profesional } = req.body;
    if (!correo || !telefono || !servicio || !fecha || !hora) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }
    try {
        // Verificar si el mail ya tiene una reserva en los próximos 6 días
        const [reservas] = await pool.query(
            `SELECT id FROM turnos WHERE nombre = ? AND fecha BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)`,
            [correo]
        );
        if (reservas.length > 0) {
            return res.status(409).json({ error: 'Ya tienes una reserva en los próximos 6 días.' });
        }
        // Verificar si el horario ya está ocupado
        const [rows] = await pool.query('SELECT id FROM turnos WHERE fecha = ? AND hora = ?', [fecha, hora]);
        if (rows.length > 0) {
            return res.status(409).json({ error: 'Ese horario ya está ocupado' });
        }
        // Generar token único para cancelar
        const token = crypto.randomBytes(24).toString('hex');
        await pool.query(
            'INSERT INTO turnos (nombre, profesional, telefono, servicio, fecha, hora, token) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [correo, profesional, telefono, servicio, fecha, hora, token]
        );
        // Enviar email de confirmación con link de cancelación
        const cancelUrl = `${process.env.BASE_URL || 'https://proyecto-barberia-production.up.railway.app'}/cancelar/${token}`;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: correo,
            subject: 'Confirmación de tu reserva en Beauty Club',
            text: `¡Hola! Tu reserva fue agendada con éxito.\n\nServicio: ${servicio}\nFecha: ${fecha}\nHora: ${hora}\nTeléfono: ${telefono}\n\n¿No puedes asistir? Cancela tu reserva aquí: ${cancelUrl}\n\n¡Te esperamos en Beauty Club!`
        });
        res.status(201).json({ mensaje: 'Turno agendado con éxito y correo enviado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al agendar turno o enviar correo' });
    }
});

// Endpoint API para consultar reserva por token (usado por cancelar.js)
app.get('/api/cancelar/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const [rows] = await pool.query('SELECT servicio, fecha, hora, profesional FROM turnos WHERE token = ?', [token]);
        if (rows.length === 0) {
            return res.json({ ok: false, mensaje: 'Reserva no encontrada o ya cancelada.' });
        }
        res.json({ ok: true, reserva: rows[0] });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al buscar la reserva.' });
    }
});

// Endpoint API para cancelar reserva por token (usado por cancelar.js)
app.post('/api/cancelar/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const [rows] = await pool.query('SELECT id FROM turnos WHERE token = ?', [token]);
        if (rows.length === 0) {
            return res.json({ ok: false, mensaje: 'Reserva no encontrada o ya cancelada.' });
        }
        await pool.query('DELETE FROM turnos WHERE token = ?', [token]);
        res.json({ ok: true, mensaje: 'Tu reserva ha sido cancelada exitosamente.' });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al cancelar la reserva.' });
    }
});

// Servir la página de cancelación amigable
app.get('/cancelar/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/cancelar/cancelar.html'));
});

// Ruta principal: servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Servir el panel de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/admin.html'));
});

// Endpoint API: listar reservas (admin)
app.get('/api/admin/reservas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, profesional, telefono, servicio, fecha, hora FROM turnos ORDER BY fecha, hora');
        res.json({ ok: true, reservas: rows });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al consultar reservas' });
    }
});

// Endpoint API: eliminar reserva (admin)
app.delete('/api/admin/reservas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM turnos WHERE id = ?', [id]);
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al eliminar reserva' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
