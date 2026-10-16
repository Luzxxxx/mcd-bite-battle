# 上传与报名

项目仓库：https://github.com/Luzxxxx/mcd-bite-battle

报名申请：[官方 Issue #809](https://github.com/M-China/mcd-developer-innovation-challenge/issues/809)。官方账号 M-China-Official 已回复[“您的作品已成功参赛”](https://github.com/M-China/mcd-developer-innovation-challenge/issues/809#issuecomment-6216025358)。

## 上传 GitHub

上传这个文件夹的**内容**作为仓库根目录。打开仓库首页应直接看到 `README.md`、`CONTEST_DECLARATION.md`、`MCP_INTEGRATION.md` 和 `mcp-config.example.json`，不要再套一层项目目录。

参赛仓库按官方规则需要公开可访问。完整源码、锁文件、Skill、测试与图文说明都已包含；运行时不需要其他工作区文件。没有打包本机 `.env`、旧 Git 历史、安装目录、原始接口响应或原站点账号配置。

如用命令行，在这个目录初始化你自己的仓库，再按 GitHub 新仓库页面的提示上传。请保留隐藏文件 `.gitignore` 和 `.env.example`；GitHub 网页上传时留意它们是否一并选中。

## 文件对应

| 官方要求 | 文件 |
| --- | --- |
| 介绍、安装、示例、目标用户 | [README.md](../README.md) |
| 原样参赛声明 | [CONTEST_DECLARATION.md](../CONTEST_DECLARATION.md) |
| 实际 MCP、Tools、流程、价值 | [MCP_INTEGRATION.md](../MCP_INTEGRATION.md) |
| 脱敏 MCP 配置，只用环境变量占位符 | [mcp-config.example.json](../mcp-config.example.json) |
| 可运行源码 | `web/`、`lib/`、`server.mjs`、`worker/` |
| WorkBuddy 专项 | 未使用，不提交虚构材料 |

声明文件从官方仓库下载，未改动内容或换行。本包检查脚本核对的是 2026-10-16 的官方版本。参赛者已在提交报名时确认同意声明与活动规则。

## 报名记录

报名简介与官方回执见 [SUBMISSION_DRAFT.md](SUBMISSION_DRAFT.md)。原申请 #808 已关闭，以 #809 为准。正文保留官方字段格式，每个字段和值放在同一行，地址使用纯文本。

活动报名截止为 **2026-10-25 23:59（北京时间）**。报名成功不代表最终排名或获奖审核通过。时间、格式和资格以[官方比赛仓库](https://github.com/M-China/mcd-developer-innovation-challenge)及[活动规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md)为准。

## 验收材料

- [本次参赛包检查](RELEASE_CHECK.md)：当前目录的实际验证与边界。
- [文件校验清单](../FILE_MANIFEST.sha256)：交付时各文件的 SHA-256，修改内容后需重新生成。
- [使用与演示](USAGE.md)：现场演示步骤。
- `images/`：桌面、手机和模型入口截图。
- [参考与素材](ATTRIBUTION.md)：项目内容及外部来源。
- 其余 `V02_*`、`V03_*`、`VERIFICATION*` 与 JSON 文件为带日期的开发记录，历史价格不代表当前门店价格。
