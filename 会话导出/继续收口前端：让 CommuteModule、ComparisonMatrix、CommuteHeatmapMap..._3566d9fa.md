# 继续收口前端：让 CommuteModule、ComparisonMatrix、CommuteHeatmapMap...


## **用户** 2026-09-26 23:38

继续收口前端：让 CommuteModule、ComparisonMatrix、CommuteHeatmapMap、LiveListingScraperModal 都只消费统一的房源/通勤数据层，删掉各组件内部重复的筛选、坐标、评分和路线计算；保持页面行为不变，完成后跑“抓房→筛选→通勤→地图”全链路验证。


## **助手** 2026-09-26 23:38

> 🔧 `Read` {'file_path': 'C:\\Users\\王\\.zcode\\cli\\memories\\projects\\project-10c3278848e48f92\\memory\\rentplan-refactor-boundaries.md'}

> 🔧 `Read` {'file_path': 'C:\\Users\\王\\.zcode\\cli\\memories\\projects\\project-10c3278848e48f92\\memory\\rentplan-58-data-source.md'}

我先读记忆里的重构边界方案和现有的统一数据层文件，再看四个组件里还剩哪些重复逻辑。

> 🔧 `Bash` {'command': 'cd "D:\\Dawang\\chat\\0923\\租房规划" && wc -l src/utils/*.ts src/components/CommuteModule.tsx src/components/ComparisonMatrix.tsx src/compon


## **助手** 2026-09-26 23:38

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\listingPipeline.ts'}

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\commuteStats.ts'}

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\useCommuteRoutes.ts'}

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\useCandidatePool.ts'}

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\candidateFilter.ts'}

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\utils\\listingSources.ts'}

记忆里已有两步落地（server 拆分 + 前端房源单链）。现在看统一数据层的现状和四个组件里残留的重复逻辑。


## **助手** 2026-09-26 23:39

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\CommuteModule.tsx'}

统一数据层已成型（listingPipeline / listingSources / useCandidatePool / useCommuteRoutes / commuteStats / candidateFilter）。现在逐个组件找残留的重复逻辑。


## **助手** 2026-09-26 23:39

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\ComparisonMatrix.tsx', 'limit': 400}

CommuteModule 已经基本收口（用 `useCommuteRoutes`+`computeCommuteStats`），但它内联的快照拉取还在——应该换成 `useCandidatePool`。继续看另外三个组件。


## **助手** 2026-09-26 23:39

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\ComparisonMatrix.tsx', 'limit': 450, 'offset': 400}


## **助手** 2026-09-26 23:39

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\ComparisonMatrix.tsx', 'limit': 500, 'offset': 850}


## **助手** 2026-09-26 23:39

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\ComparisonMatrix.tsx', 'offset': 1350}


## **助手** 2026-09-26 23:40

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\CommuteHeatmapMap.tsx'}

ComparisonMatrix 的筛选/排序（408-498 行）与 `candidateFilter.ts` 整段重复，可直接换用。接着看地图和抓取弹窗。


## **助手** 2026-09-26 23:40

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\LiveListingScraperModal.tsx'}

地图组件里舒适阈值/富化/统计/全年耗时四套计算都能换成 `commuteStats` 的共享函数（`annualHoursFromOneWay` 甚至已 import 未用）。再看抓取弹窗和 mapUtils。

> 🔧 `Bash` {'command': 'cd "D:\\Dawang\\chat\\0923\\租房规划" && grep -rn "EnrichedCandidate\\|enrichListingsForMap\\|enrichCandidatesForMap\\|comfortableMinutesForL


## **助手** 2026-09-26 23:41

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\CommuteModule.tsx', 'limit': 140}

注意到一个情况：`grep` 显示 CommuteModule 已在改用 `useCandidatePool`，与我几分钟前读到的内容不同——有并行编辑者在动这些文件。先看当前磁盘状态再动手。

> 🔧 `Bash` {'command': 'cd "D:\\Dawang\\chat\\0923\\租房规划" && ls -la --time-style=full-iso src/components/CommuteModule.tsx src/components/ComparisonMatrix.tsx sr


## **助手** 2026-09-26 23:42

> 🔧 `TodoWrite` {'todos': [{'content': '摸清并行编辑后的现状（CommuteModule/ComparisonMatrix/地图/弹窗）', 'priority': 'high', 'status': 'in_progress'}, {'content': 'ComparisonMatrix

> 🔧 `Bash` {'command': 'cd "D:\\Dawang\\chat\\0923\\租房规划" && grep -n "filterCandidates\\|sortCandidates\\|isCandidateFilterActive\\|candidateFilter\\|filteredCan


## **助手** 2026-09-26 23:42

> 🔧 `Read` {'file_path': 'D:\\Dawang\\chat\\0923\\租房规划\\src\\components\\ComparisonMatrix.tsx', 'limit': 125, 'offset': 395}

ComparisonMatrix 刚被并行会话加了 `candidateFilter` 的 import（23:42），但内联筛选代码还在——像是中途断了。先确认是否还有活跃编辑者，避免互相覆盖。

> 🔧 `Bash` {'command': 'cd "D:\\Dawang\\chat\\0923\\租房规划" && date "+%H:%M:%S" && sleep 8 && ls --time-style=full-iso -la src/components/ComparisonMatrix.tsx src/
