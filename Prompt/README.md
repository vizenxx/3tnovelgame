# Prompt Folder

这里集中存放 app 所有生成类 API 会使用的 prompt 模板。修改这些文件后，只要重新部署或 push 触发 Vercel 部署，线上生成逻辑就会跟着更新。

- `quickStoryBlueprint.ts`: 快速生成故事的蓝图 prompt，负责标题、主轴、人物、章节大纲、结局与支线结构。
- `chapterContinuation.ts`: 快速生成后续章节的 prompt，负责第 2-7 章逐章补全。
- `interventionRewrite.ts`: 玩家干涉故事时的重写 prompt，负责第 N 章到第 7 章的影响范围、支线融合和标记变化。
- `finalSummary.ts`: 三次干涉或命运确定后的最终结语 prompt。
- `coverImage.ts`: 作者手动生成作品封面的图片 prompt。快速生成故事不会调用这个文件。
- `storyStateDigest.ts`: 故事状态摘要 prompt，负责提取原版世界基准和干涉后的偏移记录。
- `narrativePerson.ts`: 人称约束的共用说明，供蓝图和章节生成复用。

注意：这些文件仍是 TypeScript，因为 prompt 里需要插入故事标题、章节文本、支线、人物等动态资料。建议只调整模板文字和规则，不要随意删除函数参数名。
