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

// Crear tabla personas si no existe y asegurar columna 'validado'
pool.query(`CREATE TABLE IF NOT EXISTS personas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    gmail VARCHAR(100) NOT NULL UNIQUE
)`)
.then(() => {
    // Intentar agregar la columna 'validado' si no existe
    return pool.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS validado BOOLEAN DEFAULT FALSE`);
})
.then(() => {
    console.log('Tabla personas verificada/columna validado asegurada');
})
.catch(err => {
    console.error('Error creando/verificando tabla personas:', err);
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

// Endpoint para obtener horarios disponibles de un día y profesional
app.get('/api/horarios', async (req, res) => {
    const { fecha, profesional } = req.query;
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
    if (!profesional) return res.status(400).json({ error: 'Profesional requerido' });
    const HORARIOS = [
        '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
        '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
    ];
    try {
        // Solo filtrar los turnos ocupados por ese profesional
        const [rows] = await pool.query('SELECT hora FROM turnos WHERE fecha = ? AND profesional = ?', [fecha, profesional]);
        const ocupados = rows.map(r => r.hora.slice(0,5));
        const disponibles = HORARIOS.filter(h => !ocupados.includes(h));
        res.json({ fecha, profesional, disponibles });
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
        // Verificar si el horario ya está ocupado para ese profesional
        const [rows] = await pool.query('SELECT id FROM turnos WHERE fecha = ? AND hora = ? AND profesional = ?', [fecha, hora, profesional]);
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

        // Enviar agenda de reservas pendientes al admin
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:1em;">
                <thead style="background:#BBA3D0;color:#23232b;">
                    <tr>
                        <th>Fecha</th><th>Hora</th><th>Profesional</th><th>Servicio</th><th>Cliente (correo)</th><th>Teléfono</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendientes.map(r => `
                        <tr>
                            <td>${r.fecha instanceof Date ? r.fecha.toISOString().slice(0,10) : r.fecha}</td>
                            <td>${r.hora.slice(0,5)}</td>
                            <td>${r.profesional}</td>
                            <td>${r.servicio}</td>
                            <td>${r.nombre}</td>
                            <td>${r.telefono}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: 'beautyclub.automatic@gmail.com', // Cambia aquí por el correo real del admin si lo deseas
            subject: 'Nueva reserva - Agenda actualizada',
            html: agendaHtml
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
        // Enviar agenda de reservas pendientes al admin tras cancelar
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border=\"1\" cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;font-family:sans-serif;font-size:1em;\">
                <thead style=\"background:#BBA3D0;color:#23232b;\">
                    <tr>
                        <th>Fecha</th><th>Hora</th><th>Profesional</th><th>Servicio</th><th>Cliente (correo)</th><th>Teléfono</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendientes.map(r => `
                        <tr>
                            <td>${r.fecha instanceof Date ? r.fecha.toISOString().slice(0,10) : r.fecha}</td>
                            <td>${r.hora.slice(0,5)}</td>
                            <td>${r.profesional}</td>
                            <td>${r.servicio}</td>
                            <td>${r.nombre}</td>
                            <td>${r.telefono}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: 'beautyclub.automatic@gmail.com',
            subject: 'Reserva cancelada - Agenda actualizada',
            html: agendaHtml
        });
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

// Endpoint API: editar reserva (admin)
app.put('/api/admin/reservas/:id', async (req, res) => {
    const { id } = req.params;
    const { fecha, hora } = req.body;
    if (!fecha || !hora) {
        return res.json({ ok: false, mensaje: 'Fecha y hora requeridas' });
    }
    try {
        // Verificar si el horario ya está ocupado por otra reserva
        const [rows] = await pool.query('SELECT id FROM turnos WHERE fecha = ? AND hora = ? AND id != ?', [fecha, hora, id]);
        if (rows.length > 0) {
            return res.json({ ok: false, mensaje: 'Ese horario ya está ocupado' });
        }
        await pool.query('UPDATE turnos SET fecha = ?, hora = ? WHERE id = ?', [fecha, hora, id]);
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al actualizar reserva' });
    }
});

// Endpoint para inscribirse
app.post('/api/inscribirse', async (req, res) => {
    const { nombre, gmail } = req.body;
    if (!nombre || !gmail) {
        return res.status(400).json({ error: 'Nombre y correo Gmail son obligatorios' });
    }
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(gmail)) {
        return res.status(400).json({ error: 'El correo debe ser de Gmail' });
    }
    try {
        await pool.query('INSERT INTO personas (nombre, gmail) VALUES (?, ?)', [nombre, gmail]);
        res.status(201).json({ mensaje: 'Inscripción exitosa' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Ese correo ya está inscrito' });
        } else {
            res.status(500).json({ error: 'Error al inscribirse' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
