document.addEventListener('DOMContentLoaded', () => {
  const addControl = document.querySelector('.side-add');
  if (!addControl) {
    return;
  }

  const button = addControl.querySelector('.side-add-btn');
  const menu = addControl.querySelector('.side-add-menu');
  if (!button || !menu) {
    return;
  }

  const menuItems = Array.from(menu.querySelectorAll('a'));

  const openMenu = () => {
    addControl.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
  };

  const closeMenu = () => {
    addControl.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };

  const toggleMenu = () => {
    if (addControl.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    toggleMenu();
  });

  document.addEventListener('click', (event) => {
    if (!addControl.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      button.blur();
    }
  });

  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      closeMenu();
    });
  });
});

// Highlight active sidebar link
const currentPath = window.location.pathname;
const sideLinks = document.querySelectorAll('.side-link');

sideLinks.forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.classList.add('active');
  }
});
