## 📋 Quick Deploy Checklist

### 1. Create GitHub Repository

```bash
# On GitHub.com:
# 1. Create new repository: intellistream/vllm-hust-website
# 2. Make it PUBLIC ✅
# 3. Add description: "vllm-hust website - benchmark-driven serving showcase for domestic hardware"
```

### 2. Push to GitHub

```bash
cd /home/shuhao/vllm-hust-website
git remote add origin git@github.com:intellistream/vllm-hust-website.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

```
Settings → Pages → Source:
  - Branch: main
  - Folder: / (root)

Save and wait 1-2 minutes.
```

### 4. Access Website

```
https://intellistream.github.io/vllm-hust-website/
```

### 5. Optional: Custom Domain

If you have a domain (e.g., vllm-hust.sage.org.ai):

```
Settings → Pages → Custom domain:
  - Enter: vllm-hust.sage.org.ai
  - Add CNAME record in DNS:
    vllm-hust.sage.org.ai → intellistream.github.io
```

### 6. Product Entrances

官网只提供正式产品介绍和一键跳转，不嵌入 Workstation、Sage Mate 或推理后端页面，也不读取任何推理凭据或运行状态。

产品 URL、外链策略、可访问名称和站点版本集中维护在 `assets/product-catalog.js`。更新产品域名时只修改该目录模块，并运行：

```bash
pytest tests/test_product_entrances.py -v
```

______________________________________________________________________

**Current Status**: GitHub Pages publishes the repository root from `main`; verify
`https://vllm-hust.sage.org.ai/` after each production push.
