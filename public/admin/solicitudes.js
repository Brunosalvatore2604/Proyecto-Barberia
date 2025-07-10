const solicitudesBtn = document.getElementById('btn-solicitudes');
const reservasBtn = document.getElementById('btn-reservas');
const solicitudesSection = document.getElementById('solicitudes-section');
const reservasSection = document.getElementById('reservas-section');

// Mostrar solicitudes o reservas
if (solicitudesBtn && reservasBtn && solicitudesSection && reservasSection) {
    solicitudesBtn.addEventListener('click', () => {
        solicitudesSection.style.display = 'block';
        reservasSection.style.display = 'none';
        solicitudesBtn.classList.add('active');
        reservasBtn.classList.remove('active');
    });
    reservasBtn.addEventListener('click', () => {
        solicitudesSection.style.display = 'none';
        reservasSection.style.display = 'block';
        reservasBtn.classList.add('active');
        solicitudesBtn.classList.remove('active');
    });
}

// Cargar solicitudes pendientes
async function cargarSolicitudes() {
    const tbody = document.querySelector('#solicitudes-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/solicitudes');
        const data = await res.json();
        if (!data.ok || !data.solicitudes.length) {
            tbody.innerHTML = '<tr><td colspan="4">No hay solicitudes pendientes</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        data.solicitudes.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.nombre}</td>
                <td>${s.gmail}</td>
                <td>${s.validado ? 'Sí' : 'No'}</td>
                <td>
                    <button class="btn-aceptar" data-id="${s.id}">Aceptar</button>
                    <button class="btn-rechazar" data-id="${s.id}">Rechazar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar solicitudes</td></tr>';
    }
}

// Acciones aceptar/rechazar
if (document.getElementById('solicitudes-table')) {
    document.getElementById('solicitudes-table').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-aceptar')) {
            const id = e.target.dataset.id;
            await fetch(`/api/admin/solicitudes/${id}/aceptar`, { method: 'PUT' });
            cargarSolicitudes();
        }
        if (e.target.classList.contains('btn-rechazar')) {
            const id = e.target.dataset.id;
            await fetch(`/api/admin/solicitudes/${id}/rechazar`, { method: 'DELETE' });
            cargarSolicitudes();
        }
    });
}

// Inicial
cargarSolicitudes();
