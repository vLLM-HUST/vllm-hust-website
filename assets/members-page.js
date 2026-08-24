(() => {
  const root = document.querySelector('[data-member-directory]');
  if (!root) return;

  const grid = root.querySelector('[data-member-grid]');
  const search = root.querySelector('[data-member-search]');
  const status = root.querySelector('[data-member-status]');
  const empty = root.querySelector('[data-member-empty]');
  let members = [];

  const isChinese = () => document.documentElement.lang.toLowerCase().startsWith('zh');
  const copy = () => isChinese()
    ? { member: '组织成员', profile: 'GitHub 公开主页', noBio: '组织成员 · 公开 GitHub 资料', visible: '位成员', noResults: '没有匹配的成员。', failed: '成员数据暂时无法加载。' }
    : { member: 'Organization member', profile: 'Public GitHub profile', noBio: 'Organization member · public GitHub profile', visible: 'members', noResults: 'No members match this search.', failed: 'Member data is temporarily unavailable.' };

  const card = (member) => {
    const article = document.createElement('article');
    article.className = 'member-card';

    const avatar = document.createElement('img');
    avatar.className = 'member-avatar';
    avatar.src = member.avatar_url;
    avatar.alt = '';
    avatar.width = 96;
    avatar.height = 96;
    avatar.loading = 'lazy';
    avatar.decoding = 'async';

    const identity = document.createElement('div');
    identity.className = 'member-identity';
    const label = document.createElement('span');
    label.className = 'member-label';
    label.textContent = copy().member;
    const name = document.createElement('h2');
    name.textContent = member.name || member.login;
    const login = document.createElement('p');
    login.className = 'member-login';
    login.textContent = `@${member.login}`;
    identity.append(label, name, login);

    const bio = document.createElement('p');
    bio.className = 'member-bio';
    bio.textContent = member.bio || copy().noBio;

    const meta = document.createElement('div');
    meta.className = 'member-meta';
    const profile = document.createElement('a');
    profile.href = member.profile_url;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    profile.textContent = `${copy().profile} ↗`;
    profile.setAttribute('aria-label', `${member.name || member.login} · ${copy().profile}`);
    meta.append(profile);

    article.append(avatar, identity, bio, meta);
    return article;
  };

  const render = () => {
    const term = (search?.value || '').trim().toLowerCase();
    const filtered = members.filter((member) =>
      [member.login, member.name, member.bio].join(' ').toLowerCase().includes(term)
    );
    grid.replaceChildren(...filtered.map(card));
    status.textContent = `${filtered.length} / ${members.length} ${copy().visible}`;
    empty.hidden = filtered.length !== 0;
    empty.textContent = copy().noResults;
  };

  fetch(root.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      members = Array.isArray(payload.members) ? payload.members : [];
      root.dataset.ready = 'true';
      render();
    })
    .catch((error) => {
      console.error('[members]', error);
      status.textContent = copy().failed;
      empty.hidden = false;
      empty.textContent = copy().failed;
    });

  search?.addEventListener('input', render);
  window.addEventListener('vllm-hust:langchange', render);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
