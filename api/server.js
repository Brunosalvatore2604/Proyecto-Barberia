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

// Endpoint para obtener horarios disponibles de un día y profesional
app.get('/api/horarios', async (req, res) => {
    const { fecha, profesional, modo } = req.query;
    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });
    if (!profesional) return res.status(400).json({ error: 'Profesional requerido' });
    let HORARIOS = [];
    // Franja horaria: 10:00 a 22:00
    const inicio = 10 * 60; // minutos desde 00:00
    const fin = 22 * 60; // minutos desde 00:00
    if (profesional && profesional.toLowerCase().includes('agustin')) {
        for (let min = inicio; min < fin; min += 45) {
            const h = Math.floor(min / 60).toString().padStart(2, '0');
            const m = (min % 60).toString().padStart(2, '0');
            HORARIOS.push(`${h}:${m}`);
        }
    } else if (profesional && profesional.toLowerCase().includes('gabriela')) {
        for (let min = inicio; min < fin; min += 60) {
            const h = Math.floor(min / 60).toString().padStart(2, '0');
            HORARIOS.push(`${h}:00`);
        }
    } else {
        for (let min = inicio; min < fin; min += 30) {
            const h = Math.floor(min / 60).toString().padStart(2, '0');
            const m = (min % 60).toString().padStart(2, '0');
            HORARIOS.push(`${h}:${m}`);
        }
    }
    try {
        const [rows] = await pool.query('SELECT hora FROM turnos WHERE fecha = ? AND profesional = ?', [fecha, profesional]);
        const ocupados = rows.map(r => r.hora.slice(0,5));
        let disponibles = HORARIOS.filter(h => !ocupados.includes(h));

        // Si la fecha es hoy, filtrar horarios pasados (tanto para usuario como para admin)
        // Usar GMT-3 (Uruguay) de forma robusta
        const ahora = new Date();
        // Convertir a GMT-3 manualmente
        const utc = ahora.getTime() + (ahora.getTimezoneOffset() * 60000);
        const gmt3 = new Date(utc - (3 * 60 * 60 * 1000));
        const yyyy = gmt3.getFullYear();
        const mm = String(gmt3.getMonth() + 1).padStart(2, '0');
        const dd = String(gmt3.getDate()).padStart(2, '0');
        const fechaHoy = `${yyyy}-${mm}-${dd}`;
        if (fecha === fechaHoy) {
            const horaAct = gmt3.getHours();
            const minAct = gmt3.getMinutes();
            const ahoraMin = horaAct * 60 + minAct;
            disponibles = disponibles.filter(horario => {
                const [h, m] = horario.split(':').map(Number);
                const turnoMin = h * 60 + m;
                return turnoMin >= ahoraMin;
            });
        }

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
        // Verificar si el mail está inscripto y validado
        const [personas] = await pool.query('SELECT validado FROM personas WHERE gmail = ?', [correo]);
        if (personas.length === 0 || !personas[0].validado) {
            return res.status(403).json({ error: 'No estás inscripto o validado. Por favor, inscríbete primero.' });
        }

        // Validar que no se pueda reservar para horas pasadas en el día actual (usar GMT-3)
        const ahora = new Date();
        const utc = ahora.getTime() + (ahora.getTimezoneOffset() * 60000);
        const gmt3 = new Date(utc - (3 * 60 * 60 * 1000));
        const yyyy = gmt3.getFullYear();
        const mm = String(gmt3.getMonth() + 1).padStart(2, '0');
        const dd = String(gmt3.getDate()).padStart(2, '0');
        const fechaHoy = `${yyyy}-${mm}-${dd}`;
        if (fecha === fechaHoy) {
            // hora viene como 'HH:MM'
            const [h, m] = hora.split(':').map(Number);
            const ahoraMin = gmt3.getHours() * 60 + gmt3.getMinutes();
            const turnoMin = h * 60 + m;
            if (turnoMin <= ahoraMin) {
                return res.status(400).json({ error: 'No se puede reservar para una hora que ya pasó.' });
            }
        }

        // Verifica si el mail ya tiene una reserva en los próximos 6 días
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
        // Enviar email de confirmación con link de cancelación (HTML fachero)
        const cancelUrl = `${process.env.BASE_URL || 'https://proyecto-barberia-production.up.railway.app'}/cancelar/${token}`;
        const cuerpoConfirm = `
          <p><b>¡Hola!</b></p>
          <p>Tu reserva fue agendada con éxito.</p>
          <ul style=\"margin:14px 0 18px 0;padding-left:18px;\">
            <li><b>Servicio:</b> ${servicio}</li>
            <li><b>Profesional:</b> ${profesional}</li>
            <li><b>Fecha:</b> ${fecha}</li>
            <li><b>Hora:</b> ${hora}</li>
            <li><b>Teléfono:</b> ${telefono}</li>
          </ul>
          <p>¿No puedes asistir? <a href=\"${cancelUrl}\" style=\"color:#BBA3D0;font-weight:bold;\">Cancela tu reserva aquí</a>.</p>
          <p><b>¡Te esperamos en Beauty Club!</b></p>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: correo,
            subject: 'Confirmación de tu reserva en Beauty Club',
            html: mailTemplate({
                titulo: 'Reserva confirmada',
                cuerpo: cuerpoConfirm
            })
        });

        // Enviar agenda de reservas pendientes al admin
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:1em;">
                <thead style="background:#BBA3D0;color:#ffffff;">
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
        let reserva = rows[0];
        // Formatear fecha a DD/MM/YYYY si es Date o string tipo '2025-07-14T00:00:00.000Z'
        let fecha = reserva.fecha;
        if (fecha instanceof Date) {
            fecha = fecha.toISOString().slice(0,10);
        }
        if (typeof fecha === 'string' && fecha.includes('-')) {
            const [y,m,d] = fecha.slice(0,10).split('-');
            fecha = `${d}/${m}/${y}`;
        }
        // Formatear hora a HH:MM
        let hora = reserva.hora;
        if (typeof hora === 'string' && hora.length >= 5) {
            hora = hora.slice(0,5);
        }
        res.json({ ok: true, reserva: { ...reserva, fecha, hora } });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al buscar la reserva.' });
    }
});

// Endpoint API para cancelar reserva por token (usado por cancelar.js)
// --- Utilidad para correos HTML con banner y título rosado ---
function mailTemplate({ titulo, cuerpo }) {
    return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#18141c;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px #0001;">
      <img src=\"https://drive.google.com/uc?export=view&id=1gFTykHd5N0-vNVWcoBM6jCidDSacFIP4\" alt=\"Beauty Club\" style=\"width:100%;display:block;max-height:180px;object-fit:cover;\">
      <div style=\"padding:24px 18px 18px 18px;\">
        <h2 style=\"color:#BBA3D0;font-weight:bold;text-align:center;margin-top:0;margin-bottom:18px;letter-spacing:0.5px;\">${titulo}</h2>
        <div style=\"font-size:1.08em;color:#fff;line-height:1.6;\">${cuerpo}</div>
      </div>
    </div>
    `;
}

app.post('/api/cancelar/:token', async (req, res) => {
    const { token } = req.params;
    try {
        // Obtener datos del turno antes de eliminarlo
        const [rows] = await pool.query('SELECT id, nombre, profesional, servicio, fecha, hora FROM turnos WHERE token = ?', [token]);
        if (rows.length === 0) {
            return res.json({ ok: false, mensaje: 'Reserva no encontrada o ya cancelada.' });
        }
        const turno = rows[0];
        await pool.query('DELETE FROM turnos WHERE token = ?', [token]);
        // Enviar agenda de reservas pendientes al admin tras cancelar
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border=\"1\" cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;font-family:sans-serif;font-size:1em;\">
                <thead style=\"background:#BBA3D0;color:#ffffff;\">
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
        // Enviar correo HTML al usuario notificando la cancelación
        const cuerpo = `
          <p><b>Hola,</b></p>
          <p>Te informamos que tu reserva ha sido <b>cancelada</b>.</p>
          <ul style=\"margin:14px 0 18px 0;padding-left:18px;\">
            <li><b>Servicio:</b> ${turno.servicio}</li>
            <li><b>Profesional:</b> ${turno.profesional}</li>
            <li><b>Fecha:</b> ${turno.fecha}</li>
            <li><b>Hora:</b> ${turno.hora}</li>
          </ul>
          <p>Si tienes dudas, contáctanos.<br><b>Beauty Club</b></p>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: turno.nombre,
            subject: 'Tu reserva en Beauty Club ha sido cancelada',
            html: mailTemplate({
                titulo: 'Reserva cancelada',
                cuerpo
            })
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
        const [rows] = await pool.query('SELECT id, nombre, profesional, telefono, servicio, fecha, hora, puntuacion, comentario FROM turnos ORDER BY fecha, hora');
        res.json({ ok: true, reservas: rows });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al consultar reservas' });
    }
});

// Endpoint API: eliminar reserva (admin)
app.delete('/api/admin/reservas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Obtener datos del turno antes de eliminarlo
        const [rows] = await pool.query('SELECT nombre, profesional, servicio, fecha, hora FROM turnos WHERE id = ?', [id]);
        let turno = null;
        if (rows.length > 0) {
            turno = rows[0];
        }
        await pool.query('DELETE FROM turnos WHERE id = ?', [id]);
        // Enviar agenda de reservas pendientes al admin tras eliminar
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:1em;">
                <thead style="background:#BBA3D0;color:#ffffff;">
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
            subject: 'Reserva eliminada - Agenda actualizada',
            html: agendaHtml
        });
        // Enviar correo al usuario notificando la cancelación (si existía el turno)
        if (turno) {
            await transporter.sendMail({
                from: 'beautyclub.automatic@gmail.com',
                to: turno.nombre,
                subject: 'Tu reserva en Beauty Club ha sido cancelada',
                text: `Hola,\n\nTe informamos que tu reserva ha sido cancelada.\n\nServicio: ${turno.servicio}\nProfesional: ${turno.profesional}\nFecha: ${turno.fecha}\nHora: ${turno.hora}\n\nSi tienes dudas, contáctanos.\n\nBeauty Club`
            });
        }
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
        // Obtener datos del turno antes de actualizar
        const [turnoRows] = await pool.query('SELECT nombre, profesional, servicio FROM turnos WHERE id = ?', [id]);
        let turno = null;
        if (turnoRows.length > 0) {
            turno = turnoRows[0];
        }
        await pool.query('UPDATE turnos SET fecha = ?, hora = ? WHERE id = ?', [fecha, hora, id]);
        // Enviar agenda de reservas pendientes al admin tras editar
        const [pendientes] = await pool.query("SELECT nombre, profesional, telefono, servicio, fecha, hora FROM turnos WHERE fecha >= CURDATE() ORDER BY fecha, hora");
        const agendaHtml = `
            <h2>Agenda de reservas pendientes</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:1em;">
                <thead style="background:#BBA3D0;color:#ffffff;">
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
            subject: 'Reserva editada - Agenda actualizada',
            html: agendaHtml
        });
        // Enviar correo HTML al usuario notificando el cambio de horario
        if (turno) {
            const cuerpoEdit = `
              <p><b>Hola,</b></p>
              <p>Te informamos que tu reserva ha sido <b>modificada</b> por el administrador.</p>
              <ul style=\"margin:14px 0 18px 0;padding-left:18px;\">
                <li><b>Servicio:</b> ${turno.servicio}</li>
                <li><b>Profesional:</b> ${turno.profesional}</li>
                <li><b>Nueva fecha:</b> ${fecha}</li>
                <li><b>Nueva hora:</b> ${hora}</li>
              </ul>
              <p>Si tienes dudas, contáctanos.<br><b>Beauty Club</b></p>
            `;
            await transporter.sendMail({
                from: 'beautyclub.automatic@gmail.com',
                to: turno.nombre,
                subject: 'Tu reserva en Beauty Club ha sido modificada',
                html: mailTemplate({
                    titulo: 'Reserva modificada',
                    cuerpo: cuerpoEdit
                })
            });
        }
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
        // Enviar correo al admin con los datos del aspirante y link al admin
        const adminUrl = `${process.env.BASE_URL || 'https://proyecto-barberia-production.up.railway.app'}/admin`;
        const cuerpoAdmin = `
          <p><b>Nombre:</b> ${nombre}</p>
          <p><b>Gmail:</b> ${gmail}</p>
          <p>Para validar o rechazar esta solicitud, ingresa al <a href="${adminUrl}" style="color:#BBA3D0;font-weight:bold;">panel de administración</a>.</p>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: 'beautyclub.automatic@gmail.com',
            subject: 'Nueva solicitud de inscripción - Beauty Club',
            html: mailTemplate({
                titulo: 'Nueva solicitud de inscripción',
                cuerpo: cuerpoAdmin
            })
        });
        res.status(201).json({ mensaje: 'Inscripción exitosa' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Ese correo ya está inscrito' });
        } else {
            res.status(500).json({ error: 'Error al inscribirse' });
        }
    }
});

// Endpoint para listar solicitudes de inscripción (solo no validadas)
app.get('/api/admin/solicitudes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, gmail, validado FROM personas WHERE validado = FALSE ORDER BY id DESC');
        res.json({ ok: true, solicitudes: rows });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al consultar solicitudes' });
    }
});

// Endpoint para aceptar solicitud (validar persona)
app.put('/api/admin/solicitudes/:id/aceptar', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE personas SET validado = TRUE WHERE id = ?', [id]);
        // Obtener datos del usuario validado
        const [rows] = await pool.query('SELECT nombre, gmail FROM personas WHERE id = ?', [id]);
        if (rows.length > 0) {
            const { nombre, gmail } = rows[0];
            // Enviar email de notificación al usuario (HTML fachero)
            const cuerpoVal = `
              <p><b>Hola ${nombre},</b></p>
              <p>Tu inscripción ha sido <b>validada</b>. Ya puedes reservar tu turno en Beauty Club.</p>
              <p>Ingresa a <a href=\"https://proyecto-barberia-production.up.railway.app/\" style=\"color:#BBA3D0;font-weight:bold;\">https://proyecto-barberia-production.up.railway.app/</a> para agendar tu cita.</p>
              <p><b>¡Te esperamos!</b></p>
            `;
            await transporter.sendMail({
                from: 'beautyclub.automatic@gmail.com',
                to: gmail,
                subject: '¡Ya puedes reservar en Beauty Club!',
                html: mailTemplate({
                    titulo: 'Inscripción validada',
                    cuerpo: cuerpoVal
                })
            });
        }
        // Enviar al admin la tabla de usuarios validados
        const [personas] = await pool.query('SELECT nombre, gmail FROM personas WHERE validado = TRUE ORDER BY nombre');
        const tablaHtml = `
            <h2>Usuarios validados (pueden reservar)</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:1em;">
                <thead style="background:#BBA3D0;color:#ffffff;">
                    <tr><th>Nombre</th><th>Gmail</th></tr>
                </thead>
                <tbody>
                    ${personas.map(p => `
                        <tr>
                            <td>${p.nombre}</td>
                            <td>${p.gmail}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        await transporter.sendMail({
            from: 'beautyclub.automatic@gmail.com',
            to: 'beautyclub.automatic@gmail.com',
            subject: 'Lista de usuarios validados actualizada',
            html: mailTemplate({
                titulo: 'Usuarios validados',
                cuerpo: tablaHtml
            })
        });
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al validar persona' });
    }
});

// Endpoint para rechazar solicitud (eliminar persona)
app.delete('/api/admin/solicitudes/:id/rechazar', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM personas WHERE id = ?', [id]);
        res.json({ ok: true });
    } catch (err) {
        res.json({ ok: false, mensaje: 'Error al eliminar solicitud' });
    }
});

// --- JOB: Recordatorio de turnos 24h antes ---
function enviarRecordatoriosTurnos() {
    const ahora = new Date();
    // Calcular la fecha de mañana (YYYY-MM-DD)
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    const yyyy = manana.getFullYear();
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    const dd = String(manana.getDate()).padStart(2, '0');
    const fechaManana = `${yyyy}-${mm}-${dd}`;
    pool.query('SELECT nombre, profesional, servicio, fecha, hora, telefono FROM turnos WHERE fecha = ?', [fechaManana])
        .then(async ([turnos]) => {
            for (const t of turnos) {
                const cuerpoRec = `
                  <p><b>Hola!</b></p>
                  <p>Te recordamos que tienes un turno reservado para <b>mañana</b> en Beauty Club.</p>
                  <ul style=\"margin:14px 0 18px 0;padding-left:18px;\">
                    <li><b>Servicio:</b> ${t.servicio}</li>
                    <li><b>Profesional:</b> ${t.profesional}</li>
                    <li><b>Fecha:</b> ${t.fecha}</li>
                    <li><b>Hora:</b> ${t.hora.slice(0,5)}</li>
                    <li><b>Teléfono:</b> ${t.telefono}</li>
                  </ul>
                  <p>Si no puedes asistir, por favor cancela tu turno desde el enlace de confirmación.</p>
                  <p><b>¡Te esperamos!</b></p>
                `;
                await transporter.sendMail({
                    from: 'beautyclub.automatic@gmail.com',
                    to: t.nombre, // nombre = correo
                    subject: 'Recordatorio de tu turno en Beauty Club',
                    html: mailTemplate({
                        titulo: 'Recordatorio de turno',
                        cuerpo: cuerpoRec
                    })
                });
            }
            if (turnos.length > 0) {
                console.log(`Recordatorios enviados para ${turnos.length} turnos del ${fechaManana}`);
            }
        })
        .catch(err => {
            console.error('Error enviando recordatorios de turnos:', err);
        });
}
// Ejecutar todos los días a las 8:00 AM (servidor)
function programarRecordatorios() {
    const ahora = new Date();
    const proxima = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 8, 0, 0, 0);
    if (ahora > proxima) proxima.setDate(proxima.getDate() + 1);
    const msHastaProxima = proxima - ahora;
    setTimeout(() => {
        enviarRecordatoriosTurnos();
        setInterval(enviarRecordatoriosTurnos, 24 * 60 * 60 * 1000); // Cada 24h
    }, msHastaProxima);
}
programarRecordatorios();

// --- JOB: Marcar turnos pasados y enviar mail de calificación ---
async function marcarTurnosPasadosYCalificar() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaHoy = `${yyyy}-${mm}-${dd}`;
    // Buscar turnos que pasan a pasado
    const [turnos] = await pool.query("SELECT id, nombre, servicio, profesional, fecha, hora, token, pasado FROM turnos WHERE fecha < ? AND pasado = FALSE", [fechaHoy]);
    if (turnos.length > 0) {
        for (const t of turnos) {
            // Enviar mail de calificación
            const calificarUrl = `${process.env.BASE_URL || 'https://proyecto-barberia-production.up.railway.app'}/calificar/${t.token}`;
            await transporter.sendMail({
                from: 'beautyclub.automatic@gmail.com',
                to: t.nombre,
                subject: '¿Cómo fue tu experiencia en Beauty Club?',
                html: `
                  <div style='font-family:sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px #0001;'>
                    <img src="https://drive.google.com/uc?export=view&id=1kgNsMdQUk5cIxzARKWZ0M-sP1Vy-M_ya" alt="Beauty Club" style="width:100%;display:block;max-height:180px;object-fit:cover;">
                    <div style='padding:24px 18px 18px 18px;'>
                      <h2 style='color:#BBA3D0;'>¡Gracias por tu visita!</h2>
                      <p>¿Cómo calificarías tu servicio de <b>${t.servicio}</b> con <b>${t.profesional}</b>?</p>
                      <p><a href='${calificarUrl}' style='background:#BBA3D0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;'>Calificar mi experiencia</a></p>
                      <p style='font-size:0.9em;color:#888;'>Tu opinión nos ayuda a mejorar.</p>
                    </div>
                  </div>
                `
            });
        }
        // Marcar como pasados
        await pool.query('UPDATE turnos SET pasado = TRUE WHERE fecha < ? AND pasado = FALSE', [fechaHoy]);
        console.log(`Turnos marcados como pasados y mails de calificación enviados: ${turnos.length}`);
    }
}
// Ejecutar todos los días a las 00:10 AM (servidor)
function programarMarcarPasados() {
    const ahora = new Date();
    const proxima = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 10, 0, 0);
    if (ahora > proxima) proxima.setDate(proxima.getDate() + 1);
    const msHastaProxima = proxima - ahora;
    setTimeout(() => {
        marcarTurnosPasadosYCalificar();
        setInterval(marcarTurnosPasadosYCalificar, 24 * 60 * 60 * 1000); // Cada 24h
    }, msHastaProxima);
}
programarMarcarPasados();

// Endpoint para servir la página de calificación
app.get('/calificar/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/calificar/calificar.html'));
});

// Endpoint para guardar la puntuación
app.post('/api/calificar/:token', async (req, res) => {
    const { token } = req.params;
    const { puntuacion, comentario } = req.body;
    if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
        return res.status(400).json({ ok: false, mensaje: 'Puntuación inválida' });
    }
    try {
        const [rows] = await pool.query('SELECT id, puntuacion FROM turnos WHERE token = ?', [token]);
        if (rows.length === 0) return res.status(404).json({ ok: false, mensaje: 'Turno no encontrado' });
        if (rows[0].puntuacion && rows[0].puntuacion > 0) {
            return res.status(409).json({ ok: false, mensaje: 'Este turno ya fue calificado.' });
        }
        await pool.query('UPDATE turnos SET puntuacion = ?, comentario = ? WHERE token = ?', [puntuacion, comentario || null, token]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al guardar la puntuación' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
