# Effect Capture — 累积式景深粒子网

## 机制

原效果以线段和 billboard quad 生成几何样本，写入浮点离屏缓冲；每次绘制只累积少量随机样本，长时间逐渐显影。片元 shader 根据相机距离衰减亮度和光斑尺寸，再由后处理合成双光源色彩。

## 最小可复用接口

- 输入：场景回调、相机、焦距、景深强度、曝光、每帧样本数。
- 输出：全屏 WebGL canvas 与 `resetCanvas()`。
- 必要控制：启动/停止生命周期、可见性暂停、像素比上限、低档每帧样本数。

## 性能与降级

- 高档：像素比 1.5、32 samples/frame。
- 移动档：像素比 1.5、12 samples/frame。
- 不支持浮点 render target：显示明确的不兼容状态，不用普通粒子近似冒充。
- 页面隐藏：跳过渲染，恢复后继续累积。

## 许可证边界

机制与当前实现源自 Domenico Bruzzese 的 Blurry，固定 revision
`10652e8495b498dedd83b88ac8e93253de7603e2`，MIT。复用时必须分发完整
copyright / permission notice，并注明对性能、生命周期和交互的修改。

## 技能化结论

已在真实项目 Bokeh Web 中完成源码级复原，并通过 390×844 与 320×568。
可晋升为 `accumulated-bokeh-field` 技能；技能只封装累积缓冲、焦面参数、
性能分档和探针，不携带本项目 HUD、三次锁定玩法、标题或品牌。

