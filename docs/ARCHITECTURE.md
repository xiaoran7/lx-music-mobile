# 架构与设计

## 1. 为什么需要 CRDT

听歌统计是**只增计数器**（累计秒数、每日秒数、各音源秒数），且**多台设备各自独立写入**。

- 不能简单求和：重复同步会重复计数。
- 不能简单覆盖：会丢掉其他设备的数据。

数学上，只增计数器 + 多写入端 → **必须按写入端（设备）分区**才能正确合并。所以采用「按设备分桶的状态型 CRDT」。

## 2. 数据结构（v2）

```ts
interface DeviceStatistics {
  totalDuration: number               // = dailyStats 求和，派生字段
  dailyStats: Record<string, number>  // 'Y-M-D'(零填充) -> 秒，仅本设备
  sourceStats: Record<string, number> // 音源码(kg/tx/wy/...) -> 秒，仅本设备
  firstUseDate: string                // 本设备首次使用日期，用于乐龄
  platform?: string                   // 'lx_music_mobile' / 'lx_music'，展示标签
  deviceName?: string                 // 设备名，展示标签
}
interface StatisticsData {           // = StatisticsStore
  version: 2
  devices: Record<string, DeviceStatistics>  // deviceId -> 桶
}
```

- 本地累加**只写**自己设备的桶。
- 设备 key：同步前用临时 `'local'`；首次连上同步、拿到服务端签发的 `clientId` 后，把 `local` 桶并入 `clientId` 桶，之后只写 `clientId` 桶。

## 3. 合并语义（两端同源逻辑）

合并逻辑是一份**零依赖纯函数**，移动端 `src/core/init/player/statisticsMerge.ts`、桌面端 `src/main/modules/statistics/merge.ts` 与服务端 `src/modules/statistics/merge.ts` **三端同源**（改一处需同步另两处）。

- **合并同一设备的两个副本**（`mergeStore` / `mergeDevice`）：`dailyStats`、`sourceStats` 逐键取 `max`；`firstUseDate` 取 `min`；`totalDuration` 由 `dailyStats` 求和派生。
  - 每台设备的每日/每源秒数在其 owner 上只增不减 → `max` 合并是正确的状态型 CRDT，**幂等 + 可交换**，重复/乱序同步都不串数。
- **聚合给 UI**（`aggregate`）：跨**不同设备**逐键**求和**，`firstUseDate` 取最早。注意：合并取 max、聚合求和，两者语义不同。
- **规范化序列化**（`stableStringify`）：设备 id / 日期 / 音源 key 全排序后 JSON，用于跨端一致的 MD5。

> 因为统计**只增不删**，不需要 dislike 模块那套「快照三方 diff 检测删除」，所以服务端同步逻辑比 list/dislike 更简单：`skipSnapshot: true`，每次直接全量 max-merge。

### 关键正确性点：rekey 必须在发送前

首次同步时，移动端必须在 `statistics_sync_get_data`（把数据发给服务端）**之前**完成 `local → clientId` 的 rekey。否则服务端按 `'local'` 存一份、客户端 rekey 后按 `clientId` 存一份，下次同步两份并存 → 聚合时**重复计数**。实现上放在 handler 的 `ensureDeviceBound`（幂等）。

## 4. 同步协议

- 传输：WebSocket（`/socket`），沿用 lx-music 既有的 RSA/AES 鉴权握手与 `message2call` RPC。
- Feature 协商：两端各声明 `featureVersion.statistics = 1`，版本匹配才启用。旧服务端 / 旧客户端互连时该 feature 不协商，**安全降级**，不影响 list/dislike。
- 动作：单一 action `statistics_data_sync`，载荷为完整 `StatisticsData`，收发双方都按 CRDT merge 处理 → **无需 sync_mode 方向协商**。
- 连接时：服务端取客户端全量数据 → merge 进服务端 → 推回客户端 → 广播给同用户其他在线设备。
- 运行中：移动端本地累加触发节流推送（60s 一次，暂停/停止时立即推）。

## 5. 各端模块清单

### 桌面端 `lx-music-desktop`

桌面端是 Electron，**主进程（Node）与渲染进程（Vue）分离**，这是与移动端单上下文最大的不同。设计：

- **主进程持有 store（唯一真相源）**——与 list/dislike 同构，便于同步握手就地完成：
  - `src/main/modules/statistics/merge.ts` — 纯函数 CRDT（三端同源）。
  - `src/main/modules/statistics/statistics.ts` — 分桶 store；持久化用 `getStore(STORE_NAMES.DATA)` 落到 `DATA_KEYS.listeningStatistics`；含 v1→v2 迁移、设备 rekey、节流同步推送、聚合给 UI；同步惰性初始化（`getStore` 读文件同步，免去与同步层时序耦合）。
  - `src/main/modules/sync/statisticsEvent.ts` — 同步桥接层（就地读写 store，无跨进程）。
  - `src/main/modules/sync/client/modules/statistics/{handler,localEvent,index}.ts` — 同步客户端模块。
- **渲染进程只采集与展示**：
  - `src/renderer/core/statistics/index.ts` — 复用 `window.app_event`（play/pause/stop/error/musicToggled）+ `playProgress.maxPlayTime` 做会话计时与防刷限幅，把限幅后的累计秒数经 `statistics_collect_time` IPC 投递给主进程累加（低频，10s 心跳/暂停即时）。
  - `src/renderer/views/Statistics/index.vue` — 统计页；挂载时 `get_statistics` invoke 拉取聚合，订阅 `statistics_updated` 推送。
- 注册点：`client/modules/index.ts`、`client/sync/handler.ts`（getEnabledFeatures，`skipSnapshot: true`）、`client/client.ts`（`moduleReadys.statistics` + `remoteQueueStatistics`）、`winMain/rendererEvent/{index,statistics}.ts`（IPC 注册 + 启动初始化）、`router.ts` + `NavBar.vue` + `Icons.vue`（页面入口）。
- 类型：`src/common/types/{statistics,statistics_sync}.d.ts`，及 `common/types/sync.d.ts`、`main/types/{sync,sync_common}.d.ts` 扩展；IPC 名在 `common/ipcNames.ts`。
- `platform` 标签为 `lx_music`；设备名取 `getComputerName()`（与 auth 上报给服务端的一致）。

> 验证入口：分别对 `src/main/tsconfig.json`、`src/renderer/tsconfig.json` 执行 `tsc --noEmit`，另跑 lint；这些命令不等于已完成运行时或完整 Vue 模板检查。

### 移动端 `lx-music-mobile`
- `src/core/init/player/statisticsMerge.ts` — 纯函数 CRDT（结构 + merge + aggregate + migrate + rekey + stableStringify）。
- `src/core/init/player/playStatistics.ts` — 采集与持久化。`getStatistics()` 返回**扁平聚合**结构，统计页 UI 零改动；内部存分桶；含 v1→v2 迁移、节流推送、设备 rekey。
- `src/plugins/sync/statisticsEvent.ts` — 桥接层（取本地数据 / 合并远程 / 注册推送 / 绑定设备）。
- `src/plugins/sync/client/modules/statistics/{handler,localEvent,index}.ts` — 同步客户端模块。
- 类型 `src/types/statistics.d.ts`、`statistics_sync.d.ts`，及 `sync.d.ts` / `sync_common.d.ts` 扩展。
- 注册点：`client/modules/index.ts`、`client/sync/handler.ts`（getEnabledFeatures）、`client/client.ts`、`plugins/sync/constants.ts`。
- 备份：`Backup/actions.ts` 导出/导入带上统计（见 changes.md）。

### 服务端 `lx-music-sync-server`
- `src/modules/statistics/` — `merge.ts`（与移动端同源）、`statisticsDataManage.ts`、`snapshotDataManage.ts`、`manage.ts`、`event.ts`、`sync/{handler,sync,localEvent,index}.ts`、`index.ts`。
- 注册点：`modules/index.ts`、`constants.ts`（`FeaturesList` + `File`）、`event.ts`（`global.event_statistics`）、`user/index.ts`（`statisticsManage`）、`server/server.ts`（`moduleReadys`/`feature`/`remoteQueueStatistics`）。
- 类型：`types/statistics.d.ts`、`statistics_sync.d.ts`，及 `sync_common.d.ts` / `common.d.ts` / `ws.d.ts` / `app.d.ts` 扩展。
- 数据落盘：`data/users/<用户>/statistics/snapshot/` + `snapshotInfo.json`，与 list/dislike 同构。
