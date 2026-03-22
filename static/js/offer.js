document.addEventListener('DOMContentLoaded', () => {
  // Live offer price preview
  const offerInput = document.getElementById('offer_price');
  const offerPreview = document.getElementById('offerPreview');

  if (offerInput && offerPreview) {
    offerInput.addEventListener('input', () => {
      const val = parseFloat(offerInput.value);
      offerPreview.textContent = isNaN(val) ? '—' : val.toFixed(0) + '€';
    });
  }
});
