const form = document.querySelector('.inscribirse-form');
const mensaje = document.querySelector('.mensaje-exito');

if (form && mensaje) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nombre = form.nombre.value.trim();
        const gmail = form.gmail.value.trim();
        if (!nombre || !gmail) return;
        mensaje.style.display = 'none';
        try {
            const res = await fetch('/api/inscribirse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, gmail })
            });
            const data = await res.json();
            if (res.ok) {
                mensaje.textContent = '¡Inscripción exitosa! Pronto serás validado por el administrador.';
                mensaje.style.display = 'block';
                form.reset();
            } else {
                mensaje.textContent = data.error || 'Error al inscribirse';
                mensaje.style.display = 'block';
            }
        } catch (err) {
            mensaje.textContent = 'Error de conexión con el servidor';
            mensaje.style.display = 'block';
        }
    });
}
