import type { Locale } from './I18nProvider';

const zh = {
  appName: 'Octop',
  tabs: { chat: '对话', experts: '专家', automation: '自动化', me: '我的' },
  drawer: { tokens: 'Token 统计', tasks: '任务', profile: '个人中心' },
  chatHome: {
    greeting: '嗨！你专属的智能伙伴来啦',
    suggestions: ['检查容器状态与资源占用', '磁盘与内存排查', '网络连通诊断', '写运维脚本'],
    inputPlaceholder: '和 AI 小助手说点什么吧',
  },
  chat: {
    agentName: '通用助手',
    demoThreadTitle: '帮我打开腾讯云官网',
    processSummary: (tools: number, thinking: number) =>
      `已调用 ${tools} 次工具，${thinking} 次深度思考`,
    viewBrowser: '查看浏览器',
    askMore: '请问还有什么需要帮忙的吗？',
  },
  me: {
    title: '我的',
    appearance: '外观',
    modeLight: '浅色',
    modeDark: '深色',
    palette: '主题色',
    logout: '退出登录',
    notLoggedIn: '未登录',
  },
  common: { pendingDesign: '该页面待设计' },
};

export type Dict = typeof zh;

const en: Dict = {
  appName: 'Octop',
  tabs: { chat: 'Chats', experts: 'Experts', automation: 'Automation', me: 'Me' },
  drawer: { tokens: 'Token usage', tasks: 'Tasks', profile: 'Profile' },
  chatHome: {
    greeting: 'Hi! Your personal AI companion is here',
    suggestions: [
      'Check container status and resources',
      'Disk and memory diagnostics',
      'Network connectivity check',
      'Write ops scripts',
    ],
    inputPlaceholder: 'Message your AI assistant',
  },
  chat: {
    agentName: 'General assistant',
    demoThreadTitle: 'Open the Tencent Cloud site',
    processSummary: (tools: number, thinking: number) =>
      `${tools} tool calls, ${thinking} thinking steps`,
    viewBrowser: 'View browser',
    askMore: 'Anything else I can help with?',
  },
  me: {
    title: 'Me',
    appearance: 'Appearance',
    modeLight: 'Light',
    modeDark: 'Dark',
    palette: 'Accent color',
    logout: 'Sign out',
    notLoggedIn: 'Not signed in',
  },
  common: { pendingDesign: 'Screen design pending' },
};

const dictionaries: Record<Locale, Dict> = { zh, en };

export function dictFor(locale: Locale): Dict {
  return dictionaries[locale] ?? zh;
}
