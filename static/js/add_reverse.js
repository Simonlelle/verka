document.addEventListener('DOMContentLoaded', () => {
  // Prefill form when clicking example cards
  document.querySelectorAll('.ra-example').forEach((card) => {
    card.addEventListener('click', () => {
      const data = {
        title: card.getAttribute('data-title') || '',
        category: card.getAttribute('data-category') || '',
        budget: card.getAttribute('data-budget') || '',
        details: card.getAttribute('data-details') || '',
      };

      // Fill all form fields
      const itemInput = document.getElementById('item_name');
      const catSelect = document.getElementById('category');
      const budgetInput = document.getElementById('budget');
      const detailsArea = document.getElementById('details');

      if (itemInput) itemInput.value = data.title;
      if (budgetInput) budgetInput.value = data.budget;
      if (detailsArea) detailsArea.value = data.details;

      // Select category using Array.find() instead of loop
      if (catSelect) {
        const option = Array.from(catSelect.options).find((o) => o.value === data.category);
        if (option) option.selected = true;
      }

      // Scroll to form
      document.getElementById('reverseForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});
