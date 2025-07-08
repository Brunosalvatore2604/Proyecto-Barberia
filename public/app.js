// Animación de emollis flotando
const emollis = [
  '💈', '✂️', '💇‍♂️', '💇‍♀️', '🧔', '💜', '✨', '🪞', '🧴', '🪒'
];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

function createEmolli() {
  const emolli = document.createElement('span');
  emolli.className = 'emolli-float';
  emolli.textContent = emollis[Math.floor(Math.random() * emollis.length)];
  emolli.style.left = randomBetween(5, 95) + 'vw';
  emolli.style.fontSize = randomBetween(22, 38) + 'px';
  emolli.style.animationDuration = randomBetween(7, 14) + 's';
  emolli.style.opacity = randomBetween(0.5, 0.9);
  document.body.appendChild(emolli);
  setTimeout(() => emolli.remove(), 15000);
}

setInterval(createEmolli, 1800);