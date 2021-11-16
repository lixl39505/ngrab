import { AsyncSeriesHook } from 'tapable'
import minimatch from 'minimatch'
//
import { Req, Res, DefaultContext, BaseContext } from './http'

// 生命周期
export interface Hooks<Context> {
    request: AsyncSeriesHook<[Req, Context & BaseContext]>
    download: AsyncSeriesHook<[Req, Res, Context & BaseContext]>
    fail: AsyncSeriesHook<[Req, Error, Context & BaseContext]>
}
// 路由参数
export interface RouterOptions<Context> {
    protocal?: string // 协议
    host?: string // 主机
    port?: string // 端口
    path?: string // 路径
    success?: (
        req: Req,
        res: Res,
        context: Context & BaseContext
    ) => Promise<void> // 成功回调
    fail?: (
        req: Req,
        err: Error,
        context: Context & BaseContext
    ) => Promise<void> // 失败回调
}

// 路由
//// 1. url匹配
//// 2. request生命周期钩子
export class Router<Context = DefaultContext> {
    // 因子
    protected _protocol = ''
    protected _host = ''
    protected _port = ''
    protected _path = ''
    // 状态
    hooks: Hooks<Context>

    constructor(options: RouterOptions<Context> = {}) {
        this._protocol = options.protocal || ''
        this._host = options.host || ''
        this._port = options.port || ''
        this._path = options.path || ''
        // hooks
        this.hooks = {
            request: new AsyncSeriesHook(['req', 'context']), // 请求前
            download: new AsyncSeriesHook(['req', 'res', 'context']), // 下载后
            fail: new AsyncSeriesHook(['req', 'err', 'context']), // 请求失败
        }
        // callback
        if (options.success) {
            this.download('__internalSuccess__', options.success)
        }
        if (options.fail) {
            this.fail('__internalFail__', options.fail)
        }
    }
    // 匹配算法
    match(req: Req): boolean {
        var urlObj = new URL(req.url)

        // 协议不匹配
        if (this._protocol && this._protocol !== urlObj.protocol) {
            return false
        }
        // 主机不匹配
        if (this._host && !minimatch(this._host, urlObj.hostname)) {
            return false
        }
        // 端口不匹配
        if (this._port && this._port !== urlObj.port) {
            return false
        }
        // 路径不匹配
        if (this._path) {
            return minimatch(urlObj.pathname, this._path, {
                dot: true,
                matchBase: true,
                nocase: true,
            })
        }

        // 默认不匹配
        return false
    }
    // add request hook
    request(
        name: string,
        fn: (req: Req, context: Context & BaseContext) => Promise<void>
    ) {
        this.hooks.request.tapPromise(name, fn)
        return this
    }
    // add download hook
    download(
        name: string,
        fn: (
            req: Req,
            res: Res,
            context: Context & BaseContext
        ) => Promise<void>
    ) {
        this.hooks.download.tapPromise(name, fn)
        return this
    }
    // add fail hook
    fail(
        name: string,
        fn: (
            req: Req,
            err: Error,
            context: Context & BaseContext
        ) => Promise<void>
    ) {
        this.hooks.fail.tapPromise(name, fn)
        return this
    }
}
