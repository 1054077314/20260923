# RentPlan · 租房决策规划引擎

专业级全周期租房规划与决策工具：覆盖预算测算、候选房源加权比选、看房实地防坑清单、合同避雷指南与搬家流程，支持保存多套方案与模板快速复用。

## 功能模块

| 模块 | 说明 |
| --- | --- |
| 01 预算测算 | 月度收支基数、押付周期、首付现金流与建议房租上限 |
| 02 通勤对比 | 等时圈热力图、多房源通勤耗时与全年路途成本测算 |
| 03 房源对比 | 候选房源加权评分矩阵、筛选排序、周边配套 AI 检索 |
| 04 时间计划 | 目标入住日倒计时、搬家任务清单、验房与抄表交接 |

方案数据自动保存在浏览器 localStorage，可导出/导入 JSON 备份。

## 开发

```bash
npm install
npm run dev        # 默认 http://localhost:3000，可用 PORT=3001 npm run dev 换端口
```

其他脚本：

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 预览构建产物
npm run lint       # tsc --noEmit 类型检查
```

## 环境变量

见 `.env.example`：

- `GEMINI_API_KEY` — Gemini AI（周边配套检索、全网房源抓取）
- `VITE_GOOGLE_MAPS_API_KEY` / `VITE_GEMINI_PUBLIC_MAPS_API_KEY` — Google 地图（缺失或网络受限时自动降级为内置雷达等时圈地图）
- `PORT` — 服务端口，默认 3000

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Express（开发服务器与 AI 接口代理）
