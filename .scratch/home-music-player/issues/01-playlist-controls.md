Status: resolved
Type: task

# 首页音乐播放列表与控制按钮

## 问题

音乐卡当前硬编码单曲且仅一个播放按钮，按 README 开发计划改造为读取
`public/music/` 列表循环播放，并补充上一首/播放暂停/下一首/选歌控制。

## 答案

- [x] 新增 `public/music/list.json` 曲目清单（Close To You / Christmas），组件运行时读取，失败回退兜底列表
- [x] 上一首 / 播放暂停 / 下一首按钮（首尾循环）
- [x] 「三个横杆」列表按钮展开选歌弹层，点选即播放，当前曲目高亮并标注播放状态（弹层贴播放器右侧，空间不足自动回落下方/上方）
- [x] 播完自动切下一首循环播放；单曲列表从头循环重播（修复原实现播完即停的问题）
- [x] 音乐卡 `noTapScale` 防点击落空（沿用导航卡/随机推荐卡方案）
- [x] README 改动记录与开发计划同步更新

## Comments

实现见 `src/components/music-card.tsx` 与 `public/music/list.json`；
详细决策见 spec.md。
