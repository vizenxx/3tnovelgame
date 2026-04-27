export function buildCoverImagePrompt(args: {
  cleanPrompt: string;
  title?: string;
  mainAxis?: string;
  tags?: string[];
}) {
  return [
    '为互动小说生成一张 1:1 方形作品封面，1024x1024，适合移动端作品卡展示。',
    '画面需要有强烈叙事氛围、明确视觉焦点、电影感构图，不要出现水印、二维码、UI 边框或多余文字。',
    args.title ? `作品名：${String(args.title).slice(0, 80)}` : '',
    args.mainAxis ? `故事主轴：${String(args.mainAxis).slice(0, 600)}` : '',
    Array.isArray(args.tags) && args.tags.length > 0 ? `标签：${args.tags.slice(0, 6).join('、')}` : '',
    `作者提示：${args.cleanPrompt}`,
  ].filter(Boolean).join('\n');
}
