// Animación de éxito al enviar el formulario de agenda
const form = document.querySelector('.agenda-form');
const mensaje = document.querySelector('.mensaje-exito');
const fechaInput = document.getElementById('fecha');
const horaSelect = document.getElementById('hora');
const profesionalSelect = document.getElementById('profesional');
const servicioSelect = document.getElementById('servicio');

const serviciosPorProfesional = {
    Agustin: [
        'Corte de cabello',
        'Afeitado/Barba',
        'Platinado'
    ],
    Gabriela: [
        'Peinado',
        'Recorte',
        'Brashing',
        'Coloracion',
        'Otro'
    ]
};

const HORARIOS_FALLBACK = [
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

async function cargarHorariosDisponibles() {
    const fecha = fechaInput.value;
    const profesional = profesionalSelect ? profesionalSelect.value : '';
    if (!fecha || !profesional) return;
    horaSelect.innerHTML = '<option value="Cargando...">Cargando...</option>';
    try {
        const res = await fetch(`/api/horarios?fecha=${fecha}&profesional=${encodeURIComponent(profesional)}`);
        const data = await res.json();
        horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
        let horarios = data.disponibles;
        if (!horarios || horarios.length === 0) {
            horarios = HORARIOS_FALLBACK;
        }
        horarios.forEach(hora => {
            const opt = document.createElement('option');
            opt.value = hora;
            opt.textContent = hora;
            horaSelect.appendChild(opt);
        });
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

if (profesionalSelect && servicioSelect) {
    profesionalSelect.addEventListener('change', function() {
        const profesional = profesionalSelect.value;
        servicioSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
        if (serviciosPorProfesional[profesional]) {
            serviciosPorProfesional[profesional].forEach(servicio => {
                const opt = document.createElement('option');
                opt.value = servicio;
                opt.textContent = servicio;
                servicioSelect.appendChild(opt);
            });
        }
        // Al cambiar el profesional, recargar horarios disponibles si ya hay fecha seleccionada
        if (fechaInput.value) cargarHorariosDisponibles();
    });
}

if (form && mensaje) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const datos = {
            correo: form.correo.value,
            profesional: form.profesional.value,
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
