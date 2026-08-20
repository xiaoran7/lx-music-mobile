# 踩坑点 / Gotchas

本文件记录本仓库（`xiaoran7/lx-music-mobile` fork）二次开发时遇到的环境/工具坑，
不是上游 `lyswhut/lx-music-mobile` 的通用问题记录。排查前先看，避免重复诊断。

- **Windows 打包脚本坑**：本机全局若设了 `NoDefaultCurrentDirectoryInExePath=1`（禁用 cmd.exe 隐式当前目录可执行文件查找），`package.json` 里凡是裸写 `gradlew.bat`（不带 `.\` 前缀）都会报"'gradlew.bat' 不是内部或外部命令"，哪怕文件确实在 cwd 下。2026-07-14 把 `pack:android`/`pack:android:debug`/`clear` 三个脚本统一改成 `cd android && .\gradlew.bat ...` 后确认 gradle 能正常起 daemon、走到依赖解析阶段。这是机器级设置，换机器需要重新确认是否还中招；其它子项目（如 mineradio-moblie）脚本裸调 `.bat`/`.exe` 也会中招。

相关：桌面端与移动端是独立客户端，共用同步协议但不互相取代。自动更新已禁用；改 statistics 或同步格式时必须同时核对桌面端和服务端兼容性。
