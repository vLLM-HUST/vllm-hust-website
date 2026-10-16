(() => {
    const cells = [...document.querySelectorAll('.coverage-cell')];
    document.querySelectorAll('[data-expand]').forEach((button) => {
        button.addEventListener('click', () => {
            const mode = button.dataset.expand;
            cells.forEach((cell) => {
                const symbol = cell.querySelector('.coverage-symbol').textContent.trim();
                cell.open = mode === 'all' || (mode === 'covered' && (symbol === '●' || symbol === '◐'));
            });
        });
    });
})();
