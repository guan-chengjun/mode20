# 外部 GLB 模型放置目录

将下载好的帆船模型重命名为 **`sailboat.glb`** 放到本目录：

```
public/models/sailboat.glb
```

加载逻辑（见 `src/three/glbLoader.js`）：
- 应用启动时自动尝试加载该文件；
- 加载成功：按网格名称关键字（hull / mast / sail / rudder / keel / centerboard / sheet / boom）
  自动归入 10 个教学部件组；
- 文件不存在或加载失败：自动回退到内置程序化帆船模型，**项目不依赖任何外部下载即可完整运行**。

> 注意：只有 `.glb`（二进制 glTF，单文件含贴图）可直接使用；若下载的是 `.gltf + .bin + 贴图`
> 多文件格式，请用 Blender 等工具重新导出为单个 `.glb`。
