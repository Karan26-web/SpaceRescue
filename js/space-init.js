// Boots the space background on page load; the instance is exposed
// globally so the game loop can drive its parallax.
document.addEventListener('DOMContentLoaded', () => {
  window.spaceBg = SpaceBackground(document.getElementById('space-bg'), {
    starCount: 200,
    warmStarRatio: 0.28,
    twinkle: true,
    driftSpeed: 0.35,
    shootingStars: true,
    nebulaIntensity: 0.85
  });
});
