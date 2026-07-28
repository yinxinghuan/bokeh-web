# 技术文档

## 1. 技术栈

- Vite 6 + TypeScript：工程化入口、相对路径构建与发布。
- 原版 Three.js/WebGL 脚本：保留 Blurry 自带的 Three.js、OrbitControls、几何生成器、浮点累积缓冲与后处理 shader。
- 原生 DOM / Pointer Events：休眠入口、焦面进度、重置与双语文案。

## 2. 目录结构

- `src/main.ts`：三焦面玩法状态、触屏点按/拖动区分和中英文文案。
- `src/style.css`：安全区 HUD、44px 控件、移动端布局和休眠画面。
- `public/libs/`：固定上游版本的原版渲染器、场景、几何与 shader；`createScene.js` 选用 Codrops v5 场景。
- `public/assets/`：上游景深光斑及纹理。
- `public/THIRD_PARTY_NOTICES.txt`：上游作品、固定 revision、修改项和完整 MIT notice。
- `_qa/capture.mjs`：390×844 与 320×568 的三状态自动视觉验证。

## 3. 核心模块

`window.startBlurry()` 在首次明确触碰时才创建原版 WebGL renderer，避免页面加载即占用 GPU。初始化会创建 2×2 float framebuffer 并检查 `FRAMEBUFFER_COMPLETE`，不能只相信扩展名称。完整时保留上游浮点累积；移动端、Mini App UA、`?renderer=direct` 调试入口或 framebuffer 不完整时，改为每帧直接绘制同一场景 4 次，并用程序化五边形纹理顶住图片解码延迟。上游循环在页面隐藏时暂停绘制，移动端像素比上限为 1.5；完整路径在宽度不超过 390px 时每帧累积 12 个样本，否则为 32 个。相机仍由原版 OrbitControls 驱动。累积路径只有在默认 framebuffer 的实读像素非黑后才报告首帧就绪；连续黑帧会切入直接渲染，WebGL 上下文丢失则保留休眠面并提供一次点按即可重载、自动启动的兼容模式。

`?baseline=1` 自动启动固定 v5 场景并隐藏产品 HUD，用于与上游机械对照；默认入口才启用三焦面闭环。

产品层以 `progress` 维护三次焦面锁定。短于 10px 的 pointer 手势修改 `cameraFocalDistance` 和 `bokehStrength` 后清空累积缓冲；更大位移只交给相机旋转。完成后保留可交互结果，不使用倒计时、网络、存档或音频。

## 4. 扩展点

- 改焦面数量或参数：编辑 `src/main.ts` 的 `focalPlanes`。
- 改原始构图：编辑 `public/libs/createScene.js`；必须重新做基线对照。
- 调性能：编辑 `public/libs/createScene.js` 的累积采样数，以及 `public/libs/main.js` 的直接渲染 4 次采样与像素比上限。
- 换 UI、文案或安全区：编辑 `src/style.css` 与 `src/main.ts`。
- 加存档或平台事件：在 `applyFocus()` 完成分支接入，不阻塞即时焦面反馈。

## 5. 启动交接

原版依赖脚本从 `<head>` 移到主体末尾，让内联启动桥可以先绘制；未随上游分发且产品未使用的 `gif.js` 引用已移除，避免 Mini App 资源链因 404 卡住。进入旧脚本链前，内联交接先展示禁用态休眠按钮与“光学组件载入中”，因此 Three.js 慢载时仍有完整主题画面；模块执行后才启用“触碰唤醒”，不再依赖可能被预加载 WebView 暂停的双 `requestAnimationFrame`。用户点醒后休眠面保持不动并显示聚焦反馈；`public/libs/main.js` 只在获得有限时间戳并完成第一次累积或直接 WebGL 输出后调用 `onBlurryFirstFrame()`，事件顺序仍为 `frame-ready → cover-release`。
