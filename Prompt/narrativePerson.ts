export function buildNarrativePersonInstruction(value: unknown, mode: 'blueprint' | 'chapter' = 'chapter') {
  const key = String(value || 'third');
  const prefix = mode === 'blueprint' ? '' : '硬约束：';
  if (key === 'first') {
    return `第一人称${prefix}全文必须以“我/我们”的叙事视角推进，严禁在章节之间切换成第三人称旁白。`;
  }
  if (key === 'second') {
    return `第二人称${prefix}全文必须以“你”的沉浸式叙事视角推进，严禁在章节之间切换成第一或第三人称。`;
  }
  return `第三人称${prefix}全文必须以“他/她/他们/角色姓名”的叙事视角推进，严禁突然切换成第一人称自述。`;
}
