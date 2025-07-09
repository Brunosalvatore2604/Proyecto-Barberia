// Animación de éxito al enviar el formulario de agenda
const form = document.querySelector('.agenda-form');
const mensaje = document.querySelector('.mensaje-exito');
const fechaInput = document.getElementById('fecha');
const horaSelect = document.getElementById('hora');

async function cargarHorariosDisponibles() {
    const fecha = fechaInput.value;
    if (!fecha) return;
    horaSelect.innerHTML = '<option value="">Cargando...</option>';
    try {
        const res = await fetch(`/api/horarios?fecha=${fecha}`);
        const data = await res.json();
        horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
        if (data.disponibles) {
            data.disponibles.forEach(hora => {
                const opt = document.createElement('option');
                opt.value = hora;
                opt.textContent = hora;
                horaSelect.appendChild(opt);
            });
        }
    } catch (err) {
        horaSelect.innerHTML = '<option value="">Error al cargar horarios</option>';
    }
}

if (fechaInput && horaSelect) {
    // Limitar el input de fecha a hoy + 6 días
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;
    hoy.setDate(hoy.getDate() + 6);
    const maxyyyy = hoy.getFullYear();
    const maxmm = String(hoy.getMonth() + 1).padStart(2, '0');
    const maxdd = String(hoy.getDate()).padStart(2, '0');
    const maxDate = `${maxyyyy}-${maxmm}-${maxdd}`;
    fechaInput.setAttribute('min', minDate);
    fechaInput.setAttribute('max', maxDate);

    fechaInput.addEventListener('change', cargarHorariosDisponibles);
}

if (form && mensaje) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const datos = {
            correo: form.correo.value,
            telefono: form.telefono.value,
            servicio: form.servicio.value,
            fecha: form.fecha.value,
            hora: form.hora.value
        };
        try {
            const res = await fetch('/api/turnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            if (res.ok) {
                form.style.display = 'none';
                mensaje.textContent = '¡Tu turno fue agendado con éxito!';
                mensaje.style.display = 'block';
                setTimeout(() => {
                    mensaje.style.display = 'none';
                    form.reset();
                    form.style.display = 'flex';
                    horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
                }, 3500);
            } else {
                const error = await res.json();
                mensaje.textContent = error.error || 'Error al agendar turno';
                mensaje.style.display = 'block';
                setTimeout(() => {
                    mensaje.style.display = 'none';
                    form.style.display = 'flex';
                }, 3500);
            }
        } catch (err) {
            mensaje.textContent = 'Error de conexión con el servidor';
            mensaje.style.display = 'block';
            setTimeout(() => {
                mensaje.style.display = 'none';
                form.style.display = 'flex';
            }, 3500);
        }
    });
}
