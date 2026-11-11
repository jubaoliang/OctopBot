import type { Locale } from './I18nProvider';

const zh = {
  appName: 'Octop',
  tabs: { chat: '对话', experts: '专家', automation: '自动化', me: '我的' },
  drawer: { tokens: 'Token 统计', tasks: '任务' },
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
    connecting: '正在连接服务器…',
    waiting: '等待回复…',
    reconnecting: '连接中断，正在重连…',
    disconnected: '连接已断开',
  },
  me: {
    title: '我的',
    appearance: '外观',
    modeLight: '浅色',
    modeDark: '深色',
    modeSystem: '跟随系统',
    palette: '主题色',
    server: '服务器',
    logout: '退出登录',
    notLoggedIn: '未登录',
  },
  login: {
    tagline: '你的自托管 AI 伙伴',
    serverUrl: '服务器地址',
    username: '用户名',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中…',
    note: '局域网 HTTP 可用（首次会有一次性的明文提示），证书校验不会跳过。',
    errors: {
      invalid_url: '服务器地址无效',
      unreachable: '无法连接服务器，请检查地址与网络',
      bad_credentials: '用户名或密码错误',
      mfa_required: '该账号已开启多因素认证，暂请在网页端完成验证后重试',
      setup: '服务器尚未完成初始化，请先在网页端完成安装向导',
      unknown: '登录失败，请稍后重试',
    },
  },
  automation: {
    emptyTitle: '暂无自动化任务',
    emptyHint: '在专家的对话中创建定时任务后，会显示在这里',
  },
  common: { pendingDesign: '该页面待设计' },
};

export type Dict = typeof zh;

const en: Dict = {
  appName: 'Octop',
  tabs: { chat: 'Chats', experts: 'Experts', automation: 'Automation', me: 'Me' },
  drawer: { tokens: 'Token usage', tasks: 'Tasks' },
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
    connecting: 'Connecting to server…',
    waiting: 'Waiting for reply…',
    reconnecting: 'Connection lost, reconnecting…',
    disconnected: 'Disconnected',
  },
  me: {
    title: 'Me',
    appearance: 'Appearance',
    modeLight: 'Light',
    modeDark: 'Dark',
    modeSystem: 'Follow system',
    palette: 'Accent color',
    server: 'Server',
    logout: 'Sign out',
    notLoggedIn: 'Not signed in',
  },
  login: {
    tagline: 'Your self-hosted AI companion',
    serverUrl: 'Server URL',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    note: 'LAN HTTP is supported with a one-time warning. Certificates are never bypassed.',
    errors: {
      invalid_url: 'Invalid server URL',
      unreachable: 'Cannot reach the server — check the address and network',
      bad_credentials: 'Wrong username or password',
      mfa_required: 'This account uses MFA; complete enrollment on the web console first',
      setup: 'The server is not initialized yet — finish setup in the web console',
      unknown: 'Sign-in failed, please retry',
    },
  },
  automation: {
    emptyTitle: 'No automated tasks yet',
    emptyHint: 'Create a scheduled task in an expert chat and it will show up here',
  },
  common: { pendingDesign: 'Screen design pending' },
};

const dictionaries: Record<Locale, Dict> = { zh, en };

export function dictFor(locale: Locale): Dict {
  return dictionaries[locale] ?? zh;
}
