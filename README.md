# LX Music Mobile (移动增强版)

基于 React Native 与 TypeScript 开发的 Android 音乐播放器客户端。本项目为原作者 **lyswhut (落雪无痕)** 开源项目 [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) 的增强分支 (Fork)，在完整保留官方移动端丝滑动画、纯粹无广告交互与强大播放内核的基础上，新增了跨设备听歌统计、按设备分桶的 CRDT 实时同步以及免登录私有云音乐分享单页等核心功能。

---

## 🌟 致敬原作者与开源致谢

本项目首先向原作者 **[lyswhut](https://github.com/lyswhut)** 致以崇高的敬意与感谢！原作者独立设计并开发了落雪音乐桌面端与移动端体系，以卓越的代码工程质量和纯粹的用户体验树立了开源典范。

- **原作者 GitHub**：[lyswhut](https://github.com/lyswhut)
- **上游官方仓库**：[lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)
- **自定义音源推荐**：[lx-music-source (六音自定义音源)](https://github.com/pdone/lx-music-source)
- **官方使用文档**：[LX Music Document](https://lyswhut.github.io/lx-music-doc/)
- **常见问题解答**：[移动端 FAQ](https://lyswhut.github.io/lx-music-doc/mobile/faq)

本项目严格遵循开源社区规范与 Apache-2.0 开源协议，所有二次开发改动均公开透明，仅供技术研究、学习与个人交流使用。

---

## 🎧 落雪全家桶 (LX Music Suite) 生态架构

本项目是“落雪全家桶”生态的移动端主力。全家桶由“双端客户端 + 双端服务端”构成完整的跨平台协同闭环：

```text
               ┌───────────────────────────────┐
               │    落雪全家桶 (LX Music Suite)   │
               └───────────────┬───────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌──────────────┐                               ┌──────────────┐
│  客户端集群   │                               │  服务端中枢   │
└──────┬───────┘                               └──────┬───────┘
       │                                               │
       ├─► LX Music Mobile (移动端，本仓库)              ├─► LX Music Sync Server (多端数据同步服务)
       │   - 平台：Android (React Native)              │   - 协议：WebSocket 双向实时同步
       │   - 特性：后台长效保活、设备分桶、一键私有分享    │   - 功能：歌单/黑名单同步 + CRDT 听歌统计
       │                                               │
       └─► LX Music Desktop (桌面端客户端)               └─► LX Music Share Server (私有云音乐分享服务)
           - 平台：Windows / macOS / Linux             │   - 架构：FastAPI + APlayer + Nginx 206
           - 特性：大屏听歌统计、沉浸歌词、多端聚合       │   - 功能：单曲转存、沉浸单页、留言板、TTL 自动清理
```

1. **LX Music Mobile (移动端客户端，本仓库)**：
   - 基于 React Native 深度优化，针对 Android 提供优秀的锁屏控制、通知栏媒体控制与后台播放保活。
   - 深度集成状态型 CRDT 听歌统计，即使手机离线听歌，联网后也能与桌面端无冲突自动合并播放次数。
   - 歌曲菜单提供“分享歌曲”专属浮窗（`ShareModal`），支持自主选择过期时间，一键生成专属试听单页短链。
2. **LX Music Desktop (桌面端客户端)**：
   - 基于 Electron + Vue 3 开发，跨平台覆盖 Windows、macOS 与 Linux。
   - 与移动端无缝互通，支持同款听歌统计看板、跨端 CRDT 聚合求和与私有云分享交互。
3. **LX Music Sync Server (多端数据同步服务)**：
   - 基于 Node.js 与 WebSocket 开发的高性能同步中枢。
   - 负责实时双向同步用户的歌单、收藏、歌曲列表与 Dislike 黑名单。
   - 本套生态深度扩展了按设备分桶的状态型 CRDT 听歌统计数据结构，多端并发写入永不丢失。
4. **LX Music Share Server (私有云音乐分享服务)**：
   - 基于 Python FastAPI + APlayer 打造的轻量级分享后端（**本仓库 `server/` 目录下已内置完整开箱即用源码**）。
   - 手机端或电脑端发起分享时，服务端自动异步转存音频流、专辑封面与 LRC 歌词，生成适配移动端与微信浏览器的高颜值 Web 详情页。
   - Web 单页包含 220px 沉浸式多行歌词滚动、微信浮窗指引与免登录听友即时留言板。
   - 提供 1天、3天、7天、30天与永久（TTL）自动物理清理机制，守护云服务器存储空间。

---

## 🛠️ 落雪服务端保姆级部署教程

推荐在自建云服务器（VPS）或 NAS 上部署 `Sync Server`（同步中枢）与 `Share Server`（分享服务），以获取全家桶的完整功能。

### 一、部署 LX Music Sync Server (数据同步服务)

Sync Server 负责将手机端与电脑端的歌单、黑名单和 CRDT 听歌统计保持实时一致。

#### 方式 1：Docker 一键部署 (推荐)

创建 `docker-compose.yml` 文件：

```yaml
version: "3.8"

services:
  lx-music-sync:
    image: lyswhut/lx-music-sync-server:latest
    container_name: lx-music-sync
    restart: unless-stopped
    ports:
      - "9527:9527"
    environment:
      - PORT=9527
      - BIND_IP=0.0.0.0
      - LX_USER_user1=YourStrongSyncPassword123
    volumes:
      - ./data:/server/data
      - ./logs:/server/logs
```

启动服务：

```bash
docker compose up -d
```

> **参数说明**：
> - `LX_USER_<用户名>`：指定用户的连接密钥（例如 `LX_USER_user1=YourStrongSyncPassword123`），客户端配置时输入该密钥即可。
> - `PORT`：服务监听端口，默认 `9527`。

#### 方式 2：Node.js 源码直接运行

```bash
git clone https://github.com/lyswhut/lx-music-sync-server.git
cd lx-music-sync-server
npm install
npm run build

# 启动服务
npm start
```

若需常驻后台，可使用 PM2 守护：

```bash
npm install -g pm2
pm2 start dist/index.js --name "lx-sync"
```

#### 配置 Nginx 反向代理与 SSL (必看)

公网环境下建议配置域名与 HTTPS 证书，并务必开启 WebSocket 支持：

```nginx
server {
    listen 80;
    server_name sync.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sync.example.com;

    ssl_certificate     /etc/letsencrypt/live/sync.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sync.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:9527;
        proxy_http_version 1.1;
        
        # 核心：必须配置 WebSocket 升级，否则多端实时数据无法握手
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

#### 手机端连接配置步骤

1. 打开手机 App，从左侧侧边栏进入“设置” -> “同步”；
2. 勾选“启用同步功能”；
3. 服务器地址填写：`https://sync.example.com`（局域网测试填 `http://局域网IP:9527`）；
4. 填入连接码（如 `YourStrongSyncPassword123`）；
5. 点击“连接”，提示已连接后即可享受手机与电脑的实时无缝互通。

---

### 二、部署 LX Music Share Server (私有云音乐分享服务)

Share Server 接收 App 推送的单曲元数据，转存流媒体并生成专属 Web 播放单页。**本仓库已在 `server/` 目录内置了完整服务端代码与配置文件！**

#### 1. 环境准备与服务安装

```bash
# 1. 进入本仓库的 server 目录 (或将 server 目录拷贝至服务器 /opt/lx-music-share)
cd server

# 2. 创建 Python 虚拟环境 (建议 Python 3.10+)
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖 (已提供 requirements.txt)
pip install -r requirements.txt
```

#### 2. Systemd 守护进程运行

使用仓库内置的 `server/lx-music-share.service` 模板（根据实际路径和域名微调后放入系统）：

```ini
[Unit]
Description=LX Music Share Web Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lx-music-share
ExecStart=/opt/lx-music-share/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8920 --workers 2
Restart=always
RestartSec=5

# 环境变量 (按实际配置修改)
Environment="BASE_URL=https://music.example.com"
Environment="DATA_DIR=/opt/lx-music-share/data"
Environment="DEFAULT_TTL_DAYS=7"
# Environment="SHARE_TOKEN=YourCustomSecurityToken"  # 可选安全鉴权 Token

[Install]
WantedBy=multi-user.target
```

启动并守护：

```bash
sudo cp server/lx-music-share.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lx-music-share
```

#### 3. Nginx 反向代理配置 (关键：Range 206 静态直出)

> **避坑提醒**：iOS Safari 与微信网页环境对音频播放有严苛的规范，必须支持 HTTP 206 Partial Content 分片传输。
> 直接使用仓库内提供的 `server/nginx-music-share.conf`，将静态媒体请求委托给 Nginx 原生模块处理，不仅性能极佳，而且能完美支持音频进度条精准 Seek 和断点续传。

```nginx
server {
    listen 80;
    server_name music.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name music.example.com;

    ssl_certificate     /etc/letsencrypt/live/music.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/music.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    # 1. 媒体资源直出 (Nginx 原生 Range 206 分片响应，适配 iOS Safari、微信与移动端)
    location /media/ {
        alias /opt/lx-music-share/data/media/;
        expires 7d;
        add_header Accept-Ranges bytes;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=604800";
        access_log off;
        error_page 404 = @fastapi;
    }

    location @fastapi {
        proxy_pass http://127.0.0.1:8920;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. 动态 API 与 Web 单页反代到 FastAPI
    location / {
        proxy_pass http://127.0.0.1:8920;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

重载 Nginx 配置：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### 手机端配置与使用

1. 打开手机 App，从侧边栏进入“设置” -> “基本设置”；
2. 找到“分享方式”，选中“推送到私有云”；
3. “服务器地址”填入自建服务的公网域名，如：`https://music.example.com`；
4. 若服务端配置了 `SHARE_TOKEN`，在 Token 框内填写，否则留空；
5. 在歌曲列表点击歌曲右侧更多菜单 -> “分享歌曲”，即刻弹出“分享音乐至私有云”浮窗，选择有效期（1天、3天、7天、30天或永久），点击生成链接，随后即可选择“复制链接”、“微信/系统分享”或“浏览器试听”。

---

## 📱 移动端本地开发与构建

### 运行环境
- Node.js 18+
- npm 9+
- JDK 17
- Android SDK (API 33 / 34，配置好 `ANDROID_HOME` 与平台工具)

### 本地调试与启动

```bash
# 安装依赖
npm ci

# 启动 Metro 打包服务
npm start

# 在另一个终端中启动 Android 调试编译 (连接真机或启动模拟器)
npm run dev
```

### 代码质量门禁检查

```bash
# 代码风格校验
npm run lint

# TypeScript 编译校验
npx tsc --noEmit

# 验证 Android JS Bundle 打包无语法报错
npm run bundle-android
```

### 构建 APK 安装包

```bash
# 打包调试版本 Debug APK
npm run pack:android:debug

# 打包正式发布版本 Release APK
npm run pack:android:release
```
编译生成的 APK 位于 `android/app/build/outputs/apk/` 目录下。

---

## 📂 用户数据与隐私边界

- 本地歌单、配置选项、听歌统计、Cookie、自定义音源接口和同步连接码均保存在 Android 应用私有沙箱中（AsyncStorage）。
- 不搜集任何用户设备隐私信息，不包含任何第三方跟踪或广告统计 SDK。
- 测试或排查问题时，请勿将私有同步连接码或私有分享服务器凭据提交至公共 Git 仓库中。

---

## 📄 许可协议与免责声明

1. 本项目基于 [Apache License 2.0](LICENSE) 协议开源。
2. 本项目不提供、不储存任何受版权保护的音频或媒体资源。播放与分享功能所用音频直链均由用户本地配置的自定义规则或接口解析生成，内容的合法性与版权归属由相应原始来源及使用者自行承担，请自觉尊重版权并支持正版音乐。
3. 本项目为开源爱好者技术研究、架构演进与个人学习产物，严禁用于任何商业牟利、广告推广或违法违规场景。使用本项目即表示您已阅读并完全同意上述声明与上游软件条款。
