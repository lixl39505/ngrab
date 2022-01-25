import { TypedEmitter } from 'tiny-typed-emitter'
//
import { AsyncSeriesHook } from 'tapable'
import minimatch from 'minimatch'
//
import { Req, Res, DefaultContext, BaseContext } from './http'

// 事件声明
interface RouterEvents {
    done: (el: {
        reqCount: number
        downloadCount: number
        failedCount: number
    }) => void
}

// 请求生命周期
export interface RequestHooks<Context> {
    request: AsyncSeriesHook<[Context & BaseContext]>
    download: AsyncSeriesHook<[Context & BaseContext]>
    failed: AsyncSeriesHook<[Error, Context & BaseContext]>
}
// 路由参数
export interface RouterOptions<Context> {
    protocal?: string // 协议
    host?: string // 主机
    port?: string // 端口
    path?: string // 路径
    success?: (context: Context & BaseContext) => Promise<void> // 成功回调
    fail?: (err: Error, context: Context & BaseContext) => Promise<void> // 失败回调
}

// 路由
//// 1. url匹配
//// 2. request生命周期钩子
export class Router<
    Context = DefaultContext
> extends TypedEmitter<RouterEvents> {
    // 因子
    protected _protocol = ''
    protected _host = ''
    protected _port = ''
    protected _path = ''
    // 状态
    requestHooks: RequestHooks<Context>

    constructor(options: RouterOptions<Context> = {}) {
        super()

        this._protocol = options.protocal || ''
        this._host = options.host || ''
        this._port = options.port || ''
        this._path = options.path || ''
        // requestHooks
        this.requestHooks = {
            request: new AsyncSeriesHook(['context']), // 请求前
            download: new AsyncSeriesHook(['context']), // 下载后
            failed: new AsyncSeriesHook(['err', 'context']), // 请求失败
        }
        // callback
        if (options.success) {
            this.download('__internalSuccess__', options.success)
        }
        if (options.fail) {
            this.failed('__internalFail__', options.fail)
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
        fn: (context: Context & BaseContext) => Promise<void>
    ) {
        this.requestHooks.request.tapPromise(name, fn)
        return this
    }
    // add download hook
    download(
        name: string,
        fn: (context: Context & BaseContext) => Promise<void>
    ) {
        this.requestHooks.download.tapPromise(name, fn)
        return this
    }
    // add fail hook
    failed(
        name: string,
        fn: (err: Error, context: Context & BaseContext) => Promise<void>
    ) {
        this.requestHooks.failed.tapPromise(name, fn)
        return this
    }
}
