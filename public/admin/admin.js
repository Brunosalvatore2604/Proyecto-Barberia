const btnCalificaciones = document.getElementById('btn-calificaciones');
const calificacionesSection = document.getElementById('calificaciones-section');
const calificacionesList = document.getElementById('calificaciones-list');

btnCalificaciones.onclick = () => {
    document.getElementById('reservas-section').style.display = 'none';
    document.getElementById('solicitudes-section').style.display = 'none';
    calificacionesSection.style.display = 'block';
    btnCalificaciones.classList.add('active');
    document.getElementById('btn-reservas').classList.remove('active');
    document.getElementById('btn-solicitudes').classList.remove('active');
    // Limpiar las otras listas para evitar duplicados visuales
    document.getElementById('solicitudes-table').parentElement.querySelector('tbody').innerHTML = '';
    calificacionesList.innerHTML = '';
    cargarCalificaciones();
};

document.getElementById('btn-reservas').onclick = () => {
    document.getElementById('reservas-section').style.display = 'block';
    document.getElementById('solicitudes-section').style.display = 'none';
    calificacionesSection.style.display = 'none';
    document.getElementById('btn-reservas').classList.add('active');
    document.getElementById('btn-solicitudes').classList.remove('active');
    btnCalificaciones.classList.remove('active');
    // Limpiar las otras listas para evitar duplicados visuales
    calificacionesList.innerHTML = '';
    document.getElementById('solicitudes-table').parentElement.querySelector('tbody').innerHTML = '';
};
document.getElementById('btn-solicitudes').onclick = () => {
    document.getElementById('reservas-section').style.display = 'none';
    document.getElementById('solicitudes-section').style.display = 'block';
    calificacionesSection.style.display = 'none';
    document.getElementById('btn-solicitudes').classList.add('active');
    document.getElementById('btn-reservas').classList.remove('active');
    btnCalificaciones.classList.remove('active');
    // Limpiar las otras listas para evitar duplicados visuales
    calificacionesList.innerHTML = '';
    if (typeof cargarSolicitudes === 'function') cargarSolicitudes();
};

async function cargarCalificaciones() {
    calificacionesList.innerHTML = 'Cargando calificaciones...';
    const res = await fetch('/api/admin/calificaciones');
    const data = await res.json();
    if (!data.ok) {
        calificacionesList.innerHTML = '<div style="color:#c00">Error al cargar calificaciones</div>';
        return;
    }
    // Solo mostrar turnos calificados
    const calificados = data.calificaciones;
    if (calificados.length === 0) {
        calificacionesList.innerHTML = '<div>No hay turnos calificados aún.</div>';
        return;
    }
    calificacionesList.innerHTML = '';
    calificados.forEach(r => {
        const div = document.createElement('div');
        div.className = 'calificacion-item';
        div.style = `
            background: linear-gradient(120deg, #23232b 80%, #9B71B0 100%);
            border-radius: 18px;
            box-shadow: 0 4px 18px rgba(155,113,176,0.13);
            border: 2px solid #BBA3D0;
            margin: 1.2em 0;
            padding: 1.3em 1.5em 1.1em 1.5em;
            max-width: 480px;
            color: #eee;
        `;
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.7em;margin-bottom:0.7em;">
                <span style="font-size:1.7em;color:#BBA3D0;">${'★'.repeat(r.puntuacion)}</span>
                <span style="font-size:1.1em;">${r.puntuacion}/5</span>
            </div>
            <div style="margin-bottom:0.5em;"><b>Comentario:</b> <span style="color:#BBA3D0;">${r.comentario ? r.comentario.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '<span style=\'color:#888\'>Sin comentario</span>'}</span></div>
            <div style="font-size:0.98em;color:#bba3d0b0;">${r.servicio} | ${r.profesional} | ${r.nombre} | ${formatFecha(r.fecha)} ${formatHora(r.hora)}</div>
        `;
        calificacionesList.appendChild(div);
    });
}
// admin.js
const PASS = 'admin';

const loginSection = document.getElementById('login-section');
const panelSection = document.getElementById('panel-section');
const loginMsg = document.getElementById('login-msg');
const btnLogin = document.getElementById('btn-login');
const passInput = document.getElementById('admin-pass');
const reservasList = document.getElementById('reservas-list');

btnLogin.onclick = () => {
    if (passInput.value === PASS) {
        loginSection.style.display = 'none';
        panelSection.style.display = 'block';
        cargarReservas();
    } else {
        loginMsg.textContent = 'Contraseña incorrecta';
    }
};

function formatFecha(fecha) {
    // Recibe '2025-07-10T00:00:00.000Z' o '2025-07-10' y devuelve '10/07/2025'
    if (!fecha) return '';
    const d = new Date(fecha);
    const dia = d.getUTCDate().toString().padStart(2, '0');
    const mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const anio = d.getUTCFullYear();
    return `${dia}/${mes}/${anio}`;
}
function formatHora(hora) {
    // Recibe '12:00:00' o '12:00' y devuelve '12:00'
    if (!hora) return '';
    return hora.slice(0,5);
}

async function getHorasDisponibles(fecha, profesional, idReserva) {
    // Trae los horarios disponibles para la fecha y profesional, pero incluye la hora actual de la reserva
    const res = await fetch(`/api/horarios?fecha=${fecha}&profesional=${encodeURIComponent(profesional)}`);
    const data = await res.json();
    let horas = data.disponibles || [];
    // Si estamos editando, incluir la hora actual aunque esté ocupada
    if (idReserva) {
        const reserva = window._reservasCache.find(r => r.id == idReserva);
        if (reserva && reserva.fecha === fecha && !horas.includes(formatHora(reserva.hora))) {
            horas.push(formatHora(reserva.hora));
            horas = horas.sort();
        }
    }
    return horas;
}

async function cargarReservas() {
    reservasList.innerHTML = 'Cargando reservas...';
    const res = await fetch('/api/admin/reservas');
    const data = await res.json();
    if (!data.ok) {
        reservasList.innerHTML = '<div style="color:#c00">Error al cargar reservas</div>';
        return;
    }
    if (data.reservas.length === 0) {
        reservasList.innerHTML = '<div>No hay reservas registradas.</div>';
        return;
    }
    reservasList.innerHTML = '';
    window._reservasCache = data.reservas;
    data.reservas.forEach(r => {
        const div = document.createElement('div');
        div.className = 'reserva-item';
        div.id = `reserva-${r.id}`;
        
        div.innerHTML = `
            <b>Servicio:</b> ${r.servicio}<br>
            <b>Fecha:</b> <span class="fecha-label">${formatFecha(r.fecha)}</span> <b>Hora:</b> <span class="hora-label">${formatHora(r.hora)}</span><br>
            <b>Profesional:</b> ${r.profesional}<br>
            <b>Correo:</b> ${r.nombre}<br>
            <b>Teléfono:</b> ${r.telefono}<br>
            
            <div class="reserva-actions">
                <button class="btn-editar" onclick="editarReserva('${r.id}')">Editar</button>
                <button class="btn-eliminar" onclick="eliminarReserva('${r.id}')">Eliminar</button>
            </div>
            <div class="editar-form" style="display:none;margin-top:1em;"></div>
        `;
        reservasList.appendChild(div);
    });
}

window.editarReserva = async function(id) {
    const div = document.getElementById(`reserva-${id}`);
    const reserva = window._reservasCache.find(r => r.id == id);
    if (!div || !reserva) return;
    const formDiv = div.querySelector('.editar-form');
    // Mostrar formulario de edición
    formDiv.style.display = 'block';
    formDiv.innerHTML = `
        <form onsubmit="return false;" style="display:flex;flex-wrap:wrap;gap:0.5em;align-items:center;justify-content:center;">
            <input type="date" id="edit-fecha-${id}" value="${reserva.fecha.slice(0,10)}" min="${new Date().toISOString().slice(0,10)}" style="padding:0.3em 0.7em;border-radius:8px;border:1px solid #BBA3D0;">
            <select id="edit-hora-${id}" style="padding:0.3em 0.7em;border-radius:8px;border:1px solid #BBA3D0;"></select>
            <button type="button" class="btn-editar" onclick="guardarEdicionReserva('${id}')">Guardar</button>
            <button type="button" class="btn-eliminar" onclick="cancelarEdicionReserva('${id}')">Cancelar</button>
        </form>
        <div class="editar-msg" style="margin-top:0.5em;color:#BBA3D0;"></div>
    `;
    // Cargar horas disponibles para la fecha actual
    const horaSelect = formDiv.querySelector(`#edit-hora-${id}`);
    const cargarHoras = async () => {
        const fecha = formDiv.querySelector(`#edit-fecha-${id}`).value;
        const horas = await getHorasDisponibles(fecha, reserva.profesional, id);
        horaSelect.innerHTML = horas.map(h => `<option value="${h}" ${h===formatHora(reserva.hora)?'selected':''}>${h}</option>`).join('');
    };
    await cargarHoras();
    formDiv.querySelector(`#edit-fecha-${id}`).addEventListener('change', cargarHoras);
};

window.cancelarEdicionReserva = function(id) {
    const div = document.getElementById(`reserva-${id}`);
    if (!div) return;
    const formDiv = div.querySelector('.editar-form');
    formDiv.style.display = 'none';
    formDiv.innerHTML = '';
};

window.guardarEdicionReserva = async function(id) {
    const div = document.getElementById(`reserva-${id}`);
    const formDiv = div.querySelector('.editar-form');
    const fecha = formDiv.querySelector(`#edit-fecha-${id}`).value;
    const hora = formDiv.querySelector(`#edit-hora-${id}`).value;
    const msgDiv = formDiv.querySelector('.editar-msg');
    msgDiv.textContent = 'Guardando...';
    const res = await fetch(`/api/admin/reservas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, hora })
    });
    const data = await res.json();
    if (data.ok) {
        msgDiv.textContent = 'Reserva actualizada';
        setTimeout(() => { cargarReservas(); }, 800);
    } else {
        msgDiv.textContent = data.mensaje || 'Error al actualizar';
    }
};

window.eliminarReserva = async function(id) {
    if (!confirm('¿Seguro que deseas eliminar esta reserva?')) return;
    const res = await fetch(`/api/admin/reservas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
        cargarReservas();
    } else {
        alert('Error al eliminar la reserva');
    }
};
