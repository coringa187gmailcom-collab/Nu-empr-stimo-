(function () {
  const v = document.getElementById('simValor'), p = document.getElementById('simParcelas');
  const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function calc() {
    const val = +v.value, n = +p.value, t = 0.0249;
    const parc = val * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
    document.getElementById('simValorLabel').textContent = brl(val).replace(',00', '');
    document.getElementById('simParcela').textContent = n + 'x de ' + brl(parc);
    document.getElementById('simTotal').textContent = brl(parc * n);
  }
  v.addEventListener('input', calc); p.addEventListener('change', calc); calc();
})();
