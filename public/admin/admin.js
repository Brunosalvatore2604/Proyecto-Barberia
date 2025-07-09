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
    data.reservas.forEach(r => {
        const div = document.createElement('div');
        div.className = 'reserva-item';
        div.innerHTML = `
            <b>Servicio:</b> ${r.servicio}<br>
            <b>Fecha:</b> ${formatFecha(r.fecha)} <b>Hora:</b> ${formatHora(r.hora)}<br>
            <b>Profesional:</b> ${r.profesional}<br>
            <b>Correo:</b> ${r.nombre}<br>
            <b>Teléfono:</b> ${r.telefono}<br>
            <div class="reserva-actions">
                <button class="btn-editar" onclick="editarReserva('${r.id}')">Editar</button>
                <button class="btn-eliminar" onclick="eliminarReserva('${r.id}')">Eliminar</button>
            </div>
        `;
        reservasList.appendChild(div);
    });
}

window.editarReserva = function(id) {
    alert('Funcionalidad de edición próximamente.');
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
