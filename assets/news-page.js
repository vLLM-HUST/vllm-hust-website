(() => {
  const root = document.querySelector('[data-news-feed]');
  if (!root) return;

  const list = root.querySelector('[data-news-list]');
  const status = root.querySelector('[data-news-status]');
  let items = [];

  const lang = () => document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const local = (value) => value?.[lang()] || value?.en || value?.zh || '';
  const copy = () => lang() === 'zh'
    ? { featured: '重点新闻', community: '社区', stories: '条动态', failed: '新闻数据暂时无法加载。' }
    : { featured: 'Featured', community: 'Community', stories: 'stories', failed: 'News is temporarily unavailable.' };

  const formatDate = (value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return new Intl.DateTimeFormat(lang() === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    }).format(date);
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const renderItem = (item) => {
    const article = make('article', `news-card${item.featured ? ' is-featured' : ''}`);
    article.id = item.id;

    const meta = make('div', 'news-card-meta');
    meta.append(
      make('span', 'news-kind', item.featured ? copy().featured : copy().community),
      make('time', 'news-date', formatDate(item.date)),
    );

    const content = make('div', 'news-card-content');
    content.append(make('h2', '', local(item.title)), make('p', 'news-summary', local(item.summary)));

    if (Array.isArray(item.metrics) && item.metrics.length) {
      const metrics = make('div', 'news-metrics');
      item.metrics.forEach((metric) => {
        const box = make('div', 'news-metric');
        box.append(make('strong', '', metric.value), make('span', '', local(metric.label)));
        metrics.append(box);
      });
      content.append(metrics);
    }

    const actions = make('div', 'news-actions');
    (item.links || []).forEach((link, index) => {
      const anchor = make('a', `action-button${index === 0 ? ' primary' : ''}`, `${local(link.label)} ↗`);
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      actions.append(anchor);
    });
    content.append(actions);
    article.append(meta, content);
    return article;
  };

  const render = () => {
    list.replaceChildren(...items.map(renderItem));
    status.textContent = `${items.length} ${copy().stories}`;
    root.dataset.ready = 'true';
  };

  fetch(root.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      items = Array.isArray(payload.items) ? payload.items : [];
      items.sort((a, b) => b.date.localeCompare(a.date));
      render();
    })
    .catch((error) => {
      console.error('[news]', error);
      status.textContent = copy().failed;
    });

  window.addEventListener('vllm-hust:langchange', render);
})();
