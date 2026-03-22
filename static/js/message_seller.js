document.addEventListener('DOMContentLoaded', () => {
  const msgInput = document.getElementById('msgInput');
  const sendBtn = document.getElementById('sendBtn');
  const modal = document.getElementById('senderModal');
  const modalName = document.getElementById('modalName');
  const modalEmail = document.getElementById('modalEmail');
  const modalConfirm = document.getElementById('modalConfirm');
  const modalCancel = document.getElementById('modalCancel');
  const modalErr = document.getElementById('modalErr');

  // Auto-grow textarea
  if (msgInput) {
    msgInput.addEventListener('input', () => {
      msgInput.style.height = 'auto';
      msgInput.style.height = `${Math.min(msgInput.scrollHeight, 110)}px`;
    });
  }

  // Quick reply chips
  document.querySelectorAll('.msg-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!msgInput) return;
      msgInput.value = chip.getAttribute('data-text') || '';
      msgInput.focus();
      msgInput.dispatchEvent(new Event('input'));
    });
  });

  // Open modal on send click
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = (msgInput?.value || '').trim();
      if (!text) {
        msgInput?.focus();
        return;
      }
      modal?.showModal();
    });
  }

  // Ctrl/Cmd + Enter shortcut
  if (msgInput) {
    msgInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendBtn?.click();
      }
    });
  }

  if (modalCancel) {
    modalCancel.addEventListener('click', () => modal?.close());
  }

  if (modalConfirm) {
    modalConfirm.addEventListener('click', () => {
      const name = (modalName?.value || '').trim();
      const email = (modalEmail?.value || '').trim();
      if (!name || !email) {
        if (modalErr) modalErr.style.display = 'block';
        if (!name) modalName?.focus();
        else modalEmail?.focus();
        return;
      }

      const hiddenName = document.getElementById('hiddenName');
      const hiddenEmail = document.getElementById('hiddenEmail');
      const hiddenMessage = document.getElementById('hiddenMessage');
      const msgForm = document.getElementById('msgForm');

      if (!hiddenName || !hiddenEmail || !hiddenMessage || !msgForm) return;

      hiddenName.value = name;
      hiddenEmail.value = email;
      hiddenMessage.value = (msgInput?.value || '').trim();
      msgForm.submit();
    });
  }

  // Scroll to bottom
  const chatBody = document.getElementById('chatBody');
  if (chatBody) {
    chatBody.scrollTop = chatBody.scrollHeight;
  }
});
