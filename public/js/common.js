(function () {
  fetch('/api/config').then(r => r.json()).then(c => {
    document.querySelectorAll('[data-contact]').forEach(a => { a.textContent = c.contactEmail; a.href = 'mailto:' + c.contactEmail; });
  }).catch(() => {});
  if (!/admin/.test(location.pathname)) {
    fetch('/api/me', { credentials: 'same-origin' }).then(r => {
      if (r.ok) {
        document.querySelectorAll('[data-guest]').forEach(e => e.classList.add('hidden'));
        document.querySelectorAll('[data-auth]').forEach(e => e.classList.remove('hidden'));
      }
    }).catch(() => {});
  }
})();
