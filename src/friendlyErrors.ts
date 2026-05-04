export const getFriendlyServerError = (error: unknown, fallback = '操作失败，请稍后重试。') => {
  const message = String(error instanceof Error ? error.message : error || '');
  if (/quota|RESOURCE_EXHAUSTED|exceeded/i.test(message)) {
    return '服务器额度暂时不足。作品库会尽量显示本机缓存；请稍后再试。';
  }
  if (/permission|insufficient|unauthorized|forbidden/i.test(message)) {
    return '权限不足，请检查登录状态或资料权限。';
  }
  if (/abort|timeout|timed out/i.test(message)) {
    return `${fallback.replace(/[。.]$/, '')}：连接超时。`;
  }
  return message || fallback;
};
