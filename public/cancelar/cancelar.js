// cancelar.js

// Obtener el token de la URL
function getToken() {
    const match = window.location.pathname.match(/cancelar\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

async function cargarReserva() {
    const token = getToken();
    const content = document.getElementById('cancelar-content');
    if (!token) {
        content.innerHTML = '<h2>Token inválido.</h2>';
        return;
    }
    // Consultar reserva al backend
    try {
        const res = await fetch(`/api/cancelar/${token}`);
        const data = await res.json();
        if (!data.ok) {
            content.innerHTML = `<h2>${data.mensaje}</h2>`;
            return;
        }
        // Mostrar datos y botón
        content.innerHTML = `
            <h2>¿Estás seguro que quieres cancelar tu reserva?</h2>
            <p><b>Servicio:</b> ${data.reserva.servicio}<br>
            <b>Fecha:</b> ${data.reserva.fecha}<br>
            <b>Hora:</b> ${data.reserva.hora}<br>
            <b>Profesional:</b> ${data.reserva.profesional}</p>
            <button class="btn-cancelar" id="btn-cancelar">Sí, cancelar</button>
        `;
        document.getElementById('btn-cancelar').onclick = async () => {
            const res2 = await fetch(`/api/cancelar/${token}`, { method: 'POST' });
            const data2 = await res2.json();
            content.innerHTML = `<div class="msg">${data2.mensaje}</div>`;
        };
    } catch (e) {
        content.innerHTML = '<h2>Error al consultar la reserva.</h2>';
    }
}

window.onload = cargarReserva;
