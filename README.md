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

当前仓库暂时为受控测试设备允许 `http://home.zhenglei.online:37353`，且仅对该域名生效。它会以明文传输密码、令牌和图片，绝不能用于正式发布；配置好 HTTPS 后必须删除 `android/app/src/main/res/xml/network_security_config.xml`、移除 Manifest 中的 `networkSecurityConfig`，并将工作流地址恢复为 HTTPS。

### 当前临时测试的网络协议

| 通信链路 | 当前协议 | 说明 |
| --- | --- | --- |
| Android App → `home.zhenglei.online:37353` | **HTTP（明文，仅临时测试）** | 注册、登录、刷新令牌、上传来图、获取生成结果都会经过此链路。请勿在公共 Wi-Fi、移动网络或正式账号上使用。 |
| 自托管后端 → 火山引擎方舟/即梦 API | **HTTPS** | 即梦 API Key 仅在后端环境中使用，不会进入 App。 |
| GitHub → GitHub Actions / APK Artifact | **HTTPS** | 源码、工作流和 APK Artifact 的 GitHub 链路。 |
| GitHub Actions → Docker Hub | **HTTPS** | 拉取 Android 构建镜像的链路。 |
| Android 系统分享面板 → 微信 | 由微信处理 | App 不读取微信内容，也不自动发送。 |

恢复正式 HTTPS 前，必须完成以下操作：

1. 确认 `https://home.zhenglei.online/health` 返回 `{ "ok": true }`。
2. 删除 `android/app/src/main/res/xml/network_security_config.xml`，并移除 `AndroidManifest.xml` 中的 `android:networkSecurityConfig` 属性。
3. 将 `.env` 和 GitHub Actions 中的 `MEME_API_URL` 恢复为 `https://home.zhenglei.online`。
4. 重新构建并安装 APK；不要继续使用临时 HTTP 版本。

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

## NAS 自动 Android 端到端测试

仓库提供了 [scripts/nas-e2e.sh](scripts/nas-e2e.sh) 和 [maestro/e2e-generation.yaml](maestro/e2e-generation.yaml)。它会自动安装 APK、清除 App 状态、将仓库内的图标注册为 Android 测试图片、登录、打开系统选择器、选择图片、调用生成服务，并等待“生成完成”结果卡片出现；过程中不需要 noVNC 操作。

首次在 NAS 安装 Maestro CLI 时会下载一次官方 CLI。准备一个仅用于自动化测试的既有 App 账户，并只在 NAS 的终端会话或密钥管理中设置变量：

```bash
cd /volume1/docker/meme-reply-mobile
chmod +x scripts/nas-e2e.sh
export E2E_EMAIL='测试账户邮箱'
export E2E_PASSWORD='测试账户密码'
export APK_PATH='/volume1/docker/meme-reply-test-upload/meme-reply-release.apk'
export ANDROID_CONTAINER='meme-reply-android-compose-latest-android-1'
./scripts/nas-e2e.sh
```

脚本不会打印密码、令牌、Base64 图片或即梦密钥。若容器名不同，只修改 `ANDROID_CONTAINER`；若设备 ID 不同，额外设置 `ANDROID_DEVICE_ID`。测试图片通过 MediaStore 注册，因此不会再遇到 noVNC 手动选择时“Recent 无图片”的问题。测试会等待最长 4 分钟，以覆盖即梦的正常生成时间；超时、登录失败、选图失败或没有出现结果卡片都会使脚本以非零状态退出。

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

