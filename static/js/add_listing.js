document.addEventListener('DOMContentLoaded', () => {
  const photoInput = document.getElementById('photo_file');
  const dropzone = document.getElementById('listingDropzone');
  const previewWrap = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');

  if (!photoInput || !dropzone || !previewWrap || !previewImg) return;

  // Update preview image, validate it's an image file
  const updatePreview = (file) => {
    const isValidImage = file && file.type.startsWith('image/');
    if (!isValidImage) {
      previewWrap.classList.remove('has-image');
      return;
    }
    previewImg.src = URL.createObjectURL(file);
    previewWrap.classList.add('has-image');
  };

  // File input change handler
  photoInput.addEventListener('change', () => {
    updatePreview(photoInput.files?.[0]);
  });

  // Drag state management
  const setDragState = (isDragging) => {
    dropzone.classList.toggle('is-dragover', isDragging);
  };

  // Drag event listeners
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    setDragState(true);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    setDragState(true);
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    setDragState(false);
  });

  // Drop handler
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    setDragState(false);
    const files = e.dataTransfer?.files;
    if (!files?.[0]) return;
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    photoInput.files = dt.files;
    updatePreview(files[0]);
  });
});
