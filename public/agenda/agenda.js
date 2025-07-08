// Animación de éxito al enviar el formulario de agenda
const form = document.querySelector('.agenda-form');
const mensaje = document.querySelector('.mensaje-exito');

if (form && mensaje) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        form.style.display = 'none';
        mensaje.style.display = 'block';
        setTimeout(() => {
            mensaje.style.display = 'none';
            form.reset();
            form.style.display = 'flex';
        }, 3500);
    });
}
