# ntruth-hund

使用 Electron + Vue 3 构建的桌面工具，提供以下功能：

- 在指定目录中检索包含关键字的 SQL、XML 文件，支持右键打开文件或所在目录。
- 列出并按顺序执行目录下的 SQL、PCK 文件，可在前端配置 Oracle 数据库连接信息，并支持只执行选中的脚本。

## 开发环境

```bash
npm install
npm run dev
```

- `npm run dev` 将在 `http://127.0.0.1:5173` 启动 Vite 开发服务器，并在准备就绪后启动 Electron。
- 如果需要打包渲染进程资源，可运行 `npm run build` 生成 `dist` 目录。

> **注意**：执行脚本功能依赖 [`oracledb`](https://www.npmjs.com/package/oracledb) 模块以及对应的 Oracle 客户端库，请在目标运行环境中提前安装并配置。
