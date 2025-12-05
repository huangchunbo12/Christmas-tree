# -
# 🎄 3D 互动圣诞树相册 (3D Interactive Christmas Tree Gallery)

这是一个基于 React Three Fiber 和 MediaPipe 的 3D 互动网页应用。它展示了一颗由照片组成的 3D 圣诞树，支持手势控制、倒计时、烟花特效以及背景音乐。
#喜欢的朋友可以点一个start，谢谢啦！

## 📁 目录结构说明

在修改之前，请确保你的文件结构如下（特别是 `public` 文件夹）：

```text
根目录/
├── public/              <-- 所有的静态资源必须放在这里！
│   ├── photos/          <-- 存放你的照片
│   ├── sounds/          <-- 存放背景音乐和音效
│   ├── fonts/           <-- 字体文件
│   ├── models/          <-- AI 模型文件
│   ├── textures/        <-- 纹理图片
│   └── wasm/            <-- AI 视觉识别核心文件
├── src/                 <-- 源代码
│   └── App.jsx          <-- 主要逻辑代码（修改参数在这里）
├── index.html
├── package.json
└── vite.config.ts       <-- 打包配置文件
🛠️ 自定义修改指南
1. 🖼️ 图片管理 (重点)
存放位置： public/photos/

你需要按照特定的命名规则替换里面的图片：

树顶照片（重要）： 必须命名为 top.jpg。这张照片会显示在手势触发的“C位”展示中。

普通照片： 必须命名为 1.jpg, 2.jpg, 3.jpg ... 以此类推。

关于图片数量的上限与下限：
下限： 1 张（如果是 1 张，它会重复填满整棵树）。

上限： 无严格技术上限，但建议不要超过 50-100 张，否则加载会变慢。

推荐数量： 30-50 张 效果最佳。

⚠️ 如何修改代码以匹配你的图片数量：
当你上传了新的照片后，必须去代码里告诉程序你有多少张照片。

打开 src/App.jsx。

找到大约第 25-30 行 的配置区域：
// --- 静态数据: 智能循环生成图片路径 ---
const TOTAL_REQUIRED_SLOTS = 44;     // 树上总共有多少个挂照片的位置（建议保持 44 不变，改大了树会变挤）
const EXISTING_PHOTOS_COUNT = 31;    // <--- 【在这里修改】 你实际上传了多少张编号图片 (比如你传到了 50.jpg，这里就写 50)
TOTAL_REQUIRED_SLOTS (44): 这是树的“容量”。如果你的照片少于 44 张，程序会自动循环使用你的照片填满树。

EXISTING_PHOTOS_COUNT: 这是你需要修改的数字。确保它和你 public/photos 里的最大编号一致。

2. 🎵 音乐与音效
存放位置： public/sounds/

你可以直接替换以下文件（文件名必须保持一致，否则需要改代码）：

bgm.mp3: 背景音乐。

ding.mp3: 倒计时或特定触发音效。

swoosh.mp3: 照片飞入飞出的音效。

3. ⏳ 修改倒计时目标
如果你想修改倒计时的目标日期（比如改为春节或明年的圣诞节）：

打开 src/App.jsx。

搜索 CountdownBoard 组件。

找到 const target = ... 这一行：

JavaScript

// 示例：修改为 2026 年 1 月 1 日
const target = new Date(new Date().getFullYear() + 1, 0, 1); 
// 注意：月份是从 0 开始的 (0 = 1月, 11 = 12月)
🚫 哪些不能修改 (或需谨慎修改)
public/wasm/ 和 public/models/ 文件夹：

这里面是 Google MediaPipe 的 AI 识别核心文件，严禁删除或改名，否则手势识别和摄像头将无法工作。

src/App.jsx 中的 Shader 代码：

也就是 const FoliageMaterial = shaderMaterial(...) 这一大段。这是控制树叶飘动和颜色渐变的核心算法，不懂 WebGL 的话请勿触碰。

文件名引用：

如果你在文件夹里把 top.jpg 改成了 profile.png，请务必记得在代码里同步修改引用路径，否则会报错。


🚀 部署到 Netlify 教程 (最简便方法)
Netlify 是一个非常适合部署此类静态网站的平台，且免费。

第一步：准备代码 (本地操作)
修改配置：

打开 vite.config.ts，确保 base 设置为根目录：

JavaScript

base: '/',
打开 src/App.jsx，确保资源前缀为空：

JavaScript

const BASE_PATH = ''; 
生成部署包：

在 VS Code 终端运行命令：

Bash

npm run build
等待运行完成，你的项目根目录下会出现一个 dist 文件夹。这个文件夹里包含了网站运行所需的所有内容。

或者可以开个分支，然后上传自己的照片过后，直接去 Netlify，上传这个GitHub项目，也可以直接部署成功。然后是本地则看下面操作

第二步：上传到 Netlify
注册/登录 Netlify。

登录后进入 "Sites" (站点) 页面。

找到页面底部或右侧的虚线框区域，写着 "Drag and drop your site output folder here" (拖拽你的站点输出文件夹到这里)。

关键操作： 鼠标左键按住你本地生成的 dist 文件夹，直接拖进网页的那个框里松手。

第三步：完成
等待几秒钟，进度条跑完后，Netlify 会给你一个随机的网址（例如 https://random-name-12345.netlify.app）。

点击那个链接，你的 3D 圣诞树相册就上线了！

(可选) 你可以在 "Site settings" -> "Domain management" 中修改这个随机域名的前缀，改成你自己喜欢的名字。

❓ 常见问题排查
问题：打开网站是白屏？

检查 vite.config.ts 里的 base 是不是 '/'。

按 F12 打开开发者工具，看 Console 是否有红字报错。

问题：图片加载不出来 (404)？

确保你的图片都在 public/photos/ 文件夹里。

确保文件名是 1.jpg 而不是 1.JPG 或 1.png (代码对大小写和后缀敏感)。

确保你修改了代码中的 EXISTING_PHOTOS_COUNT。

问题：摄像头打不开？

如果是部署后打不开，请检查浏览器地址栏右侧是否拦截了摄像头权限。

该功能必须在 https (加密) 环境下运行，Netlify 默认就是 HTTPS，所以部署后通常没问题。本地测试时 localhost 也可以。
