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
    const res = await fetch(`/api/horarios?fecha=${fecha}`);
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
