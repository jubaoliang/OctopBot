/** Map app UI locale → BCP-47 tag for system / server STT. */
export function speechLocaleFromUi(locale: string): string {
  return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}
