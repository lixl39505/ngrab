import { SendOptions } from '../utils/send'
import { Req, ReqOptions } from './req'
import { Res, ResOptions } from './res'

// re-export
export { Req, ReqOptions, Res, ResOptions }

// 待爬取地址
export type Links = string | string[] | SendOptions[]

// 代理配置对象
export interface ProxyConfig {
    url: string
    maxRetry?: number
}

// 代理对象
export type Proxy = string | ProxyConfig | ((req: Req) => Promise<ProxyConfig>)

// 基础上下文
export interface BaseContext {
    req?: Req
    res?: Res
    resolveLink: (...parts: string[]) => string
    followLinks: (urls: Links) => void
    skip: (req: Req) => void
    defer: (req: Req) => void
    stop: () => void
    sleep: (time: number) => void
}
// 可扩展上下文
export interface DefaultContext {
    [key: string]: any
}
