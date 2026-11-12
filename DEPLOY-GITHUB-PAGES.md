# 把 Parola 发布到 GitHub Pages（所有人可访问）

Parola 是纯静态网站，支持 A1–B2 词库、间隔复习、每日新词计划、打卡、朗读和备份。访问者无需 GitHub 或 ChatGPT 账号；只有发布者需要 GitHub 账号。学习记录保存在访问者自己的浏览器中，不会上传到 GitHub。

## 方法一：直接上传（最简单，使用 `parola-github-pages.zip`）

1. 登录 GitHub，点击 **New repository**，名称可用 `parola`，选择 **Public**，勾选创建 README，然后创建仓库。
2. 在电脑上**解压** `parola-github-pages.zip`。把解压出的文件上传到 GitHub 仓库根目录（**Add file → Upload files**）。上传的是文件，不是 ZIP，也不要再套一层文件夹。首页 `index.html` 应与 `app.js`、`style.css` 等文件处在同一层。能显示隐藏文件时，将 `.nojekyll` 一起上传；它用于关闭 Jekyll 处理。没有显示它也不影响这些普通静态文件的展示。
3. 提交文件到 `main` 分支。
4. 打开 **Settings → Pages**，在 **Build and deployment** 下选择：
   - **Source**：`Deploy from a branch`
   - **Branch**：`main`
   - 文件夹：`/ (root)`
   - 点击 **Save**。
5. 等部署成功后，Pages 设置页会给出正式网址，通常为 `https://你的用户名.github.io/parola/`。任何人都可以访问，无需登录。

如果仓库名称不是 `parola`，网址末尾使用实际仓库名。无需修改代码，网站资源路径支持任意仓库名。

## 方法二：GitHub Actions 自动部署（使用源码包）

使用 `parola-github-pages-source.zip`，解压后将其中的 `dist/`、`tests/`、`scripts/`、`.github/` 等文件放在仓库根目录。隐藏文件夹 `.github` 必须上传，工作流文件路径应为 `.github/workflows/pages.yml`。

1. 创建一个 **Public** 仓库并上传源码，主分支使用 `main`。
2. 打开 **Settings → Pages → Source**，选择 **GitHub Actions**。
3. 打开 **Actions → Deploy Parola to GitHub Pages → Run workflow**，选择 `main` 并运行。以后每次推送到 `main` 都会自动检查并发布 `dist/`。
4. 部署成功后，从 Actions 的 `github-pages` 环境链接或 Settings → Pages 查看网址。

无需安装 npm 依赖，也无需配置 PAT、API 密钥或 Secrets。工作流使用 GitHub 内置的短期 `GITHUB_TOKEN`，只授予读取源码、发布 Pages 和获取部署身份的权限。

如果使用其他主分支名称，请同时修改 `.github/workflows/pages.yml` 的 `branches: [main]`。如果第一次运行发生在启用 Pages 之前，先完成第 2 步，再重新运行工作流。

## 原网站的学习记录怎么带过来？

原来的 ChatGPT Site 与 GitHub Pages 是不同网址，浏览器不会自动搬迁学习记录：

1. 在原网站点击「导出学习备份」。
2. 在新的 GitHub Pages 网站进入「我的词库 → 导入词表 / 恢复备份」，选择刚导出的 JSON。

不要把个人学习备份上传到公开 GitHub 仓库。在网站页面中导入即可，数据只保存在当前浏览器。不同设备和浏览器需要分别导入；同一个浏览器内的不同 GitHub Pages 仓库使用独立进度。

## 词库与使用说明

- 当前共 2,956 条学习记录：Espresso Plus A1/A2 共 2,371 条；开放词典核实的 B1/B2 共 585 条。
- 中文为参考释义，可在卡片上修改；B1/B2 是建议学习分级，并非官方完整等级词表。
- 词典选集的署名与许可见 `dictionary-sources.html`，教材词表的来源见「我的词库」。词典选集的 CC BY-SA 许可不代表全部教材资料采用相同许可。
- 默认每日 20 个新词，可在「记忆计划」设置 5–200 个，完成计划后自动打卡。
- 朗读使用浏览器语音功能；没有意大利语声音的设备可能需要在系统中安装语音。
- 字体使用 Google Fonts，并有系统字体回退。网站核心功能和词库无需连接 ChatGPT 服务。

## 验证与官方说明

源码检查：`node tests/pages.cjs`、`node tests/plan.cjs`、`node tests/app.cjs`。这次已完成静态路径和功能逻辑检查，未在真实 GitHub 仓库中运行部署；GitHub Pages 的线上地址以部署成功后的返回值为准。

GitHub 官方说明：[选择 Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [使用 Actions 发布](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
