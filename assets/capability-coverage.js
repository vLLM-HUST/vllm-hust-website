(() => {
    const root = document.getElementById('coverage-content') || document;
    const cells = [...root.querySelectorAll('.coverage-cell')];
    root.querySelectorAll('[data-expand]').forEach((button) => {
        button.addEventListener('click', () => {
            const mode = button.dataset.expand;
            cells.forEach((cell) => {
                const symbol = cell.querySelector('.coverage-symbol').textContent.trim();
                cell.open = mode === 'all' || (mode === 'covered' && (symbol === '●' || symbol === '◐'));
            });
        });
    });
})();
