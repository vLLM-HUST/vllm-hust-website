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

### 6. Present An A100 Workstation In The Website

`website` 本身是静态页，推荐把 `vllm-hust-workstation` 独立部署在 A100 机器上，再通过首页的 workstation 面板做 iframe 展示或外链跳转。

1. 在 A100 主机部署 `vllm-hust` OpenAI 兼容服务，例如：`https://a100.example.com:8080`
2. 在同一主机或同一内网部署 `vllm-hust-workstation`
3. 为 workstation 配置：

```dotenv
VLLM_HUST_BASE_URL=https://a100.example.com:8080
APP_BRAND_NAME=vLLM-HUST A100 Workstation
APP_FRAME_ANCESTORS=https://intellistream.github.io https://vllm-hust.sage.org.ai
```

4. 把公开可访问的 workstation 地址写入 `data/workstation_embed.json`

```json
{
  "enabled": true,
  "mode": "embed",
  "workstation_url": "https://a100.example.com/workstation/",
  "backend_url": "https://a100.example.com:8080",
  "docs_url": "./docs/DEPLOY.md",
  "label_zh": "A100 工作站",
  "label_en": "A100 Workstation"
}
```

如果你不想在首页直接嵌 iframe，可以把 `mode` 改成 `link`，首页会保留“打开 Workstation”入口，但不在站内渲染远端页面。

> 注意：GitHub Pages 页面如果是 HTTPS，而 workstation 还是 HTTP，浏览器会阻止混合内容，iframe 不会显示。

______________________________________________________________________

**Current Status**: ✅ Local files ready, waiting for GitHub push
