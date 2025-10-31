# ntruth-hund

使用 Electron + Vue 3 构建的桌面工具，提供以下功能：

- 在指定目录中检索包含关键字的 SQL、XML 文件，支持右键打开文件或所在目录。
- 列出并按顺序执行目录下的 SQL、PCK 文件，可在前端配置 Oracle 数据库连接信息，并支持只执行选中的脚本。
- 新增文件比对与合并功能：支持拖拽文件、自动识别 UTF-8/GBK 编码，提供行/字符级语法高亮差异视图，可按需忽略空白、大小写或注释，并内置三方合并、冲突定位及左/右侧一键解决。 

## 开发环境

```bash
npm install
npm run dev
```

- `npm run dev` 将在 `http://127.0.0.1:5173` 启动 Vite 开发服务器，并在准备就绪后启动 Electron。
- 如果需要打包渲染进程资源，可运行 `npm run build` 生成 `dist` 目录。
- Windows 环境下 `npm run dev` 和 `npm run build` 会自动设置 `ROLLUP_SKIP_NODE_RESOLUTION=1`，避免 npm 在安装可选的 Rollup 原生包时出现 `@rollup/rollup-win32-x64-msvc` 缺失报错。
- 项目已升级到 Vite 5 与 `@vitejs/plugin-vue` 5.x，如遇旧依赖缓存导致的异常（例如开发页空白、`Maximum call stack size exceeded` 报错），请删除 `node_modules` 后重新执行 `npm install`。

> **注意**：执行脚本功能依赖 [`oracledb`](https://www.npmjs.com/package/oracledb) 模块以及对应的 Oracle 客户端库，请在目标运行环境中提前安装并配置。

### Oracle 11g 兼容说明

- 使用 Oracle 11g 或 Instant Client 11g 时，请在“Oracle 连接配置”中填写客户端库目录，以便应用通过 `oracledb.initOracleClient` 正确加载 DLL/so 文件。
- 如果先前已使用其他路径初始化客户端库，需重启应用后才能切换到新的目录。
- 建议确认 32/64 位架构一致，并确保将 `oracledb` 模块与匹配版本的客户端库一起部署。
