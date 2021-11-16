import { SendOptions } from '../utils/send'

// 待爬取地址
type Links = string | string[] | Req[]

// 请求对象
export interface Req extends SendOptions {
    _state?: 'pending' | 'downloading'
}

// 响应对象
export interface Res {
    status: number // http-status-code
    headers: object // http头部
    body: string // 内容
}
// 代理配置对象
export interface ProxyConfig {
    url: string
    maxRetry?: number
}
// 基础上下文
export interface BaseContext {
    resolveLink: (...parts: string[]) => string
    followLinks: (urls: Links) => void
}
// 可扩展上下文
export interface DefaultContext {
    [key: string]: any
}
