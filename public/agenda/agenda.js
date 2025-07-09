// Animación de éxito al enviar el formulario de agenda
const form = document.querySelector('.agenda-form');
const mensaje = document.querySelector('.mensaje-exito');
const fechaInput = document.getElementById('fecha');
const horaSelect = document.getElementById('hora');

async function cargarHorariosDisponibles() {
    // Esta función ya no hace fetch, solo muestra horarios fijos
    const horarios = [
        '09:00', '09:30', '10:00', '10:30', '11:00',
        '11:30', '12:00', '12:30', '13:00', '13:30'
    ];
    horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
    horarios.forEach(hora => {
        const opt = document.createElement('option');
        opt.value = hora;
        opt.textContent = hora;
        horaSelect.appendChild(opt);
    });
}

if (fechaInput && horaSelect) {
    fechaInput.addEventListener('change', cargarHorariosDisponibles);
}

if (form && mensaje) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        form.style.display = 'none';
        mensaje.textContent = '¡Tu turno fue agendado con éxito!';
        mensaje.style.display = 'block';
        setTimeout(() => {
            mensaje.style.display = 'none';
            form.reset();
            form.style.display = 'flex';
            horaSelect.innerHTML = '<option value="">Selecciona una hora</option>';
        }, 3500);
    });
}
