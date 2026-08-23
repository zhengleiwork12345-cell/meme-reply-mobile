# 斗图助手 Android App

个人微信的半自动斗图 App。它只从相册选择图片、本地匹配或请求 AI 回击图；通过 Android 系统分享面板由用户手动选择微信并确认发送。

## 安全边界

- 不登录、不读取或控制微信；不会自动发送消息。
- 本地表情库保存于 App 私有目录，标签索引保存在本机 AsyncStorage。
- 生成时当前 PNG/JPEG 来图会经 HTTPS 临时发送到你自托管的后端，再发送至火山引擎方舟的即梦同源图像服务；你的后端不保存图片、Base64、令牌或上游原始错误正文。
- App 使用你自己的账户系统；刷新令牌仅保存在 Android SecureStore，不使用 Firebase。
- 即梦 API 密钥仅放在 Docker 主机的密钥管理或受限环境文件中，绝不能写进 App `.env`、App 或仓库。

## 本地开发

```powershell
copy .env.example .env
npm ci
npm run typecheck
npm test
npx expo start
```

只需要将自托管后端的 HTTPS URL 填入 `.env`。首次使用 App 时，使用后端配置的注册邀请码创建账户；密码至少 10 位。不要将即梦 API、数据库或 JWT 密钥写入 App `.env`。AI 生成参考图仅支持 PNG 或 JPEG。

## Android APK（EAS）

1. `npm install --global eas-cli`，随后运行 `eas login` 与 `eas build:configure`。
2. 运行 `eas build --platform android --profile preview`。
3. 在构建详情页下载 APK，用 Android 13+ 真机打开链接安装。

`preview` 产出可直装 APK；`production` 是未来 Play Store 使用的 AAB 构建配置。首次 EAS 构建时由 Expo 管理 Android 签名密钥。

## 自建 Docker 服务器构建 APK

无需 Expo 账户。项目已包含 `android/` 原生工程、`Dockerfile.android` 和 Docker 构建脚本。构建服务器应为 Linux x86_64、至少 4 个 CPU、8 GB 内存和约 15 GB 可用磁盘；首次构建会下载 Android SDK、Gradle、npm 和 Maven 依赖。

将整个 `wechat-meme-mobile` 目录上传到服务器后，在该目录运行：

```bash
docker build -f Dockerfile.android -t meme-reply-android-builder:latest .
mkdir -p artifacts
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/artifacts:/output" \
  -v meme-reply-gradle-cache:/root/.gradle \
  -e EXPO_PUBLIC_MEME_API_URL='https://home.zhenglei.online:37353' \
  -e APK_OUTPUT_NAME='meme-reply-release.apk' \
  meme-reply-android-builder:latest
```

生成的可安装 APK 为 `artifacts/meme-reply-release.apk`。不提供签名变量时，它使用 Android 的测试签名，适合首次真机验证；后续正式更新前，应创建并永久保存自己的签名证书。将证书目录挂载到容器后，额外传入以下变量即可使用固定签名：

```bash
-v "$PWD/signing:/signing:ro" \
-e APK_KEYSTORE_PATH='/signing/meme-reply-release.jks' \
-e APK_KEYSTORE_PASSWORD='证书库密码' \
-e APK_KEY_ALIAS='证书别名' \
-e APK_KEY_PASSWORD='密钥密码'
```

不要把签名证书、任何密码、即梦 API Key、数据库地址或 JWT 密钥复制进移动端项目或镜像。若构建服务器为 ARM 架构，需要启用 Docker 的 amd64 仿真，构建会明显更慢。

## GitHub Actions + Docker Hub 构建 APK

推荐将本项目推送到独立的 GitHub 仓库。GitHub Actions 负责运行测试和生成 APK；Docker Hub 只保存不含应用源码和密钥的 Android 构建环境镜像。这样不需要在你的服务器上安装 Android SDK。

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置：

- Secrets：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`（Docker Hub 访问令牌，需有镜像推送权限）。
- Variables：`MEME_API_URL`，值为 `https://home.zhenglei.online:37353`。这只是 App 的公开后端地址，不能填即梦 API Key、数据库密码或 JWT 密钥。

首次推送后，在 **Actions** 页面依次运行：

1. **Publish Android builder**：将 `dockerhub用户名/meme-reply-android-builder:latest` 推送到 Docker Hub。
2. **Build Android APK**：通过该镜像构建 APK。完成后进入工作流运行详情，从 **Artifacts** 下载 `meme-reply-android-apk`。

每次提交 App 或 Android 代码后，**Build Android APK** 会自动运行；修改 `Dockerfile.android` 或 `scripts/build-apk.sh` 时，先重新运行 **Publish Android builder**，再构建 APK。

## 验证命令

```powershell
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform android --output-dir .expo-export-check
```

真机验收：导入至少三张本地图、切换情绪检查排序、保存并删除图片、测试生成失败与重试、保存生成图、取消分享、以及在安装微信的设备上手动完成一次系统分享。
