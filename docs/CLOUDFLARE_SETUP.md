## Cloudflare Setup For Sage Domains

当前推荐的域名划分：

- `vllm-hust.sage.org.ai`：GitHub Pages 静态官网
- `ws.sage.org.ai`：A100 上的 `vllm-hust-workstation`
- `api.sage.org.ai`：A100 上的 `vllm-hust` OpenAI 兼容接口

## 已在仓库中准备好的内容

- 官网 embed 配置已预设为 `https://ws.sage.org.ai`
- 官网后端展示地址已预设为 `https://api.sage.org.ai`
- workstation 已预留 iframe 白名单：`https://sage.org.ai https://vllm-hust.sage.org.ai`

## 你需要在 Cloudflare 做的事

### 1. 保留官网域名

确认 GitHub Pages 继续使用：

```text
vllm-hust.sage.org.ai -> intellistream.github.io
```

这个记录继续保留给 website，不要改到 A100。

### 2. 给 workstation 建公网子域

进入 Cloudflare Zero Trust Dashboard：

`Networks` -> `Tunnels` -> 选择当前这条 A100 主机正在使用的 tunnel -> `Public Hostnames` ->
`Add a public hostname`

新增：

- Subdomain: `ws`
- Domain: `sage.org.ai`
- Path: 留空
- Service Type: `HTTP`
- URL: `http://127.0.0.1:3001`

### 3. 可选：给 API 建公网子域

同样在 `Public Hostnames` 中新增：

- Subdomain: `api`
- Domain: `sage.org.ai`
- Path: 留空
- Service Type: `HTTP`
- URL: `http://127.0.0.1:8080`

### 4. 检查 SSL 模式

在 Cloudflare Dashboard 中确认：

`SSL/TLS` -> `Overview` -> `Full` 或 `Full (Strict)`

不要使用 `Flexible`，否则可能出现重定向或协议异常。

### 5. 若开启了 Access，先放通自己测试

如果 `ws.sage.org.ai` 或 `api.sage.org.ai` 套了 Cloudflare Access，请先添加允许你自己访问的 policy；否则 website iframe
会被登录页拦住。

## 完成后的验证

完成上述操作后，应该满足：

```text
https://ws.sage.org.ai
https://ws.sage.org.ai/api/models
https://api.sage.org.ai/v1/models
```

其中：

- `ws.sage.org.ai` 返回 workstation 页面
- `ws.sage.org.ai/api/models` 返回 workstation 聚合后的模型列表
- `api.sage.org.ai/v1/models` 返回 `vllm-hust` 的 OpenAI 兼容模型列表

## 常见问题

### 页面能打开但 iframe 不显示

优先检查 workstation 的 `Content-Security-Policy` 是否包含：

```text
frame-ancestors 'self' https://sage.org.ai https://vllm-hust.sage.org.ai;
```

### 子域名打不开

优先检查 tunnel 的 `Public Hostnames` 是否已保存，并等待 1-2 分钟让边缘配置生效。

### 官网还是显示旧内容

可在 Cloudflare 控制台执行缓存清理，或等待缓存过期。
