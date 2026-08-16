# 首页音乐播放列表

## 背景

README「未完成开发计划 · 10. 首页小改造」中的「音乐播放列表」：音乐卡由硬编码单曲
（`['/music/close-to-you.mp3']`）改为读取 `public/music/` 列表循环播放。

用户补充要求：首页音乐播放组件支持 上一首 / 播放暂停 / 下一首，以及「三个横杆」
（列表图标）展开选歌，而不是当前仅一个播放按钮。

## 方案

- 新增 `public/music/list.json` 作为曲目清单（`{ name, src }[]`），运行时
  `fetch('/music/list.json')` 读取；拉取失败时回退到组件内置的兜底列表（与清单一致），
  保证功能始终可用。新增曲目：往 `public/music/` 放文件并登记清单即可，无需改代码。
- 组件状态：`tracks / currentIndex / isPlaying / progress / playlistOpen`；
  `ended` 事件自动切下一首循环播放，单曲列表时从头循环重播。
- 控制区：上一首、播放/暂停（主按钮）、下一首、列表图标（lucide `ListMusic`，即「三个横杆」）。
  列表弹层可点选任意曲目并立即播放；当前曲目高亮，标注「播放中 / 已暂停」；
  弹层外点击或路由切换时自动收起。
- 弹层放置：贴播放器正右侧弹出（垂直居中于卡片）；右侧空间不足时依次回落下方/上方，
  避免溢出视口产生横向滚动条。
- 音乐卡启用 `noTapScale`（同导航卡/随机推荐卡先例），避免整卡按压缩小导致按钮点击落空。
- 不改动 `card-styles.json` 中 musicCard 尺寸（like-position 等依赖其高度），
  控制区按现有 350×66 卡内空间排布（上一首/下一首/列表按钮 32px，主播放按钮 40px）。

## 交付

- `public/music/list.json`（清单：Close To You / Christmas）
- `src/components/music-card.tsx`（播放列表 + 四键控制 + 选歌弹层）
- README 改动记录新增条目，开发计划第 10 项标记已实现
