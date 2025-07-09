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
            <b>Fecha:</b> ${r.fecha} <b>Hora:</b> ${r.hora}<br>
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
