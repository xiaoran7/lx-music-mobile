# LX Music Mobile Fork

React Native Android 客户端的本地二开仓。当前 fork 在上游基础上加入听歌统计、按设备分桶的 statistics 同步和统计备份恢复，并停用私有分支自动更新。版本与脚本以 `package.json` 为准；上游发行说明不代表本 fork 已发布。

本机家族入口：[家族文档](../docx/README.md)。`gitea` 保存当前 fork，`fork` 是既有 GitHub 分支，`origin` 仅作上游基线；跨仓修改不得从父目录批量暂存。

## 开发与验证

需要 Node.js 18+、npm、JDK 和 Android SDK：

```powershell
npm.cmd ci
npm.cmd start
# 另开终端
npm.cmd run dev
```

基本门禁：

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run bundle-android
```

Debug APK 可用 `npm.cmd run pack:android:debug`。设备安装、通知、后台播放、蓝牙、权限、保留数据升级和真实同步需要模拟器/真机验证；JS bundle 或 TypeScript 通过不能替代 Gradle 与设备验收。

## Fork 边界

- statistics 使用按设备分桶的状态型 CRDT：同设备逐键取 `max`，跨设备展示时求和。
- 改 feature version、握手、备份或列表字段时，同时核对 Desktop、Sync Server、Mineradio 和 Mineradio Mobile。
- 私有 fork 禁用自动更新不等于删除上游更新代码；恢复前先确认发布渠道和兼容性。
- 播放、歌词和自定义音源受用户账号权益、第三方服务和当地法规约束，不提供绕过付费或重新分发音乐的能力。

## 数据与平台

当前交付目标为 Android；iOS 和 HarmonyOS NEXT 不在本仓当前范围。用户歌单、配置、Cookie、同步连接码和媒体缓存属于本地敏感数据，不得进入 Git、日志或测试夹具。测试真实同步前使用隔离账号和可恢复数据。

## 文档

- [CHANGELOG](CHANGELOG.md)：fork 变更位于 `Unreleased`，其后为上游历史。
- [上游源码使用说明](https://lyswhut.github.io/lx-music-doc/mobile/use-source-code)与[常见问题](https://lyswhut.github.io/lx-music-doc/mobile/faq)。
- [LICENSE](LICENSE)：Apache-2.0；以下使用限制沿用上游 README 的补充说明。

## 许可与使用限制

本项目不拥有使用过程中产生的第三方版权数据。在线平台数据、自定义音源返回内容和用户同步数据的合法性、准确性与可用性由相应来源和使用者负责；请尊重版权并支持正版。

本项目免费开源，仅用于技术学习与研究。禁止在违反当地法律法规的情况下使用，不接受商业合作或广告。使用本项目即表示接受仓库许可证及上游补充条款；如需完整历史措辞，可从 Git 上游 README 版本核对。
