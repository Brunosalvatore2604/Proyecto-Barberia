const express = require('express');
const path = require('path');
const pool = require('./db');
const nodemailer = require('nodemailer');

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

// Al iniciar el server, asegurarse de que la columna profesional existe
(async () => {
    try {
        // Intentar agregar la columna, si ya existe MySQL lanzará un error que ignoramos
        await pool.query("ALTER TABLE turnos ADD COLUMN profesional VARCHAR(30) NOT NULL DEFAULT 'Agustin' AFTER nombre");
        console.log('Columna profesional agregada');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || (err.sqlMessage && err.sqlMessage.includes('Duplicate column name'))) {
            console.log('La columna profesional ya existe');
        } else {
            console.error('Error al verificar/crear columna profesional:', err);
        }
    }
})();

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
        await pool.query(
            'INSERT INTO turnos (nombre, profesional, telefono, servicio, fecha, hora) VALUES (?, ?, ?, ?, ?, ?)',
            [correo, profesional, telefono, servicio, fecha, hora]
        );
        // Enviar email de confirmación
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: correo,
            subject: 'Confirmación de tu reserva en Beauty Club',
            text: `¡Hola! Tu reserva fue agendada con éxito.\n\nServicio: ${servicio}\nFecha: ${fecha}\nHora: ${hora}\nTeléfono: ${telefono}\n\n¡Te esperamos en Beauty Club!`
        });
        res.status(201).json({ mensaje: 'Turno agendado con éxito y correo enviado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al agendar turno o enviar correo' });
    }
});

// Ruta principal: servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
