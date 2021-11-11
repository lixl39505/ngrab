import fs from 'fs'
import path from 'path'
//
import { BloomFilter } from 'bloom-filters'
//
import { Req, Res, DefaultContext, ProxyConfig } from './http'
import { send, debounce, groupBy, asyncForEach } from '../utils/helper'
import { Scheduler, SchedulerOptions } from './scheduler'
import { Spider, SpiderOptions } from './spider'

// 待爬取地址
type Links = string | string[] | Req[]
export type Proxy = string | ProxyConfig | ((req: Req) => Promise<ProxyConfig>)

// 布隆配置对象
export interface BloomOptions {
    size?: number // 目标个数
    falseRate?: number // 错误率
}
// 配置参数
export interface CrawlerOptions<Context = DefaultContext>
    extends SchedulerOptions,
        SpiderOptions<Context> {
    // 爬虫名称
    name?: string
    // 频率控制
    interval?: number | ((req: Req) => number) // 请求间隔（深度爬取时，至少间隔n秒才发起下一个请求）
    // 起止控制
    startUrls?: Links // 初始目标地址s
    // 布隆过滤
    bloom?: boolean | BloomOptions
    // 缓存根目录
    cacheRoot?: string
    // 请求代理配置
    proxy?: Proxy
    // 请求上下文参数
    context?: () => Context
}

// 爬虫簇
//// 1. url管理
//// 2. 并发管理(请求发起)
export class Crawler<Context = DefaultContext> extends Spider<Context> {
    // 因子
    protected _name: string
    protected _cacheRoot: string
    protected _bloom: BloomOptions
    protected _startUrls: Links
    protected _interval: number | ((req: Req) => number)
    protected _maxConcurrency: number
    protected _maxRequests: number
    protected _proxy: (req: Req) => Promise<ProxyConfig>
    protected _context: () => Context
    // 内部状态
    private _cacheDir: string
    private _scheduler: Scheduler
    private _bloomFilter: BloomFilter
    private _bloomJSON: Object
    private _crawling = false // 正在爬取
    private _todoPath = '' // 待爬取缓存路径
    private _todoList: Array<Req> = [] // 待爬取队列
    private _hostCrawling: {
        [k: string]: boolean
    } = {} // 域名:是否正在爬取
    private _spiders: Array<Spider<Context>> = [] // 爬虫列表
    private _useSet: Set<Spider<Context> | SpiderOptions<Context>> = new Set() // use缓存
    // 内部方法
    private _saveBloom: Function
    private _saveTodoList: Function

    constructor(options: CrawlerOptions<Context> = {}) {
        super(options)
        // map
        this._name = options.name
        this._cacheRoot = options.cacheRoot
        this._startUrls = options.startUrls || []
        this._interval = options.interval
        this._maxConcurrency = options.maxConcurrency
        this._maxRequests = options.maxRequests
        this._context = options.context

        // 默认名称
        if (!this._name) {
            throw new Error('必须指定crawler的名称')
        }
        // 默认缓存目录
        if (!this._cacheRoot) {
            this._cacheRoot = '.crawlers'
        }
        // 布隆过滤
        let bloom = options.bloom
        if (bloom === true) {
            // 默认配置，百万条/50MB±
            this._bloom = {
                size: 1000000,
                falseRate: 1 / 1000000,
            }
            // 缓存bloom过滤器
            this._saveBloom = debounce(200, () => {
                this._bloomJSON = this._bloomFilter.saveAsJSON()
                fs.writeFileSync(
                    path.join(this._cacheDir, 'bloom.json'),
                    JSON.stringify(this._bloomJSON)
                )
            })
        }
        if (typeof bloom === 'object') {
            this._bloom = bloom
        }
        // 代理
        let proxy = options.proxy
        if (proxy) {
            if (typeof proxy === 'string') {
                this._proxy = () =>
                    Promise.resolve({
                        url: proxy as string,
                    })
            } else if (typeof proxy === 'object') {
                this._proxy = () => Promise.resolve(proxy as ProxyConfig)
            } else {
                this._proxy = proxy
            }
        }

        // 缓存
        this._cacheDir = path.resolve(this._cacheRoot, this._name)
        this._todoPath = path.join(this._cacheDir, 'todo.json')
        // 存储todo队列
        this._saveTodoList = debounce(200, () => {
            fs.writeFileSync(this._todoPath, JSON.stringify(this._todoList))
        })
    }
    // 开始执行
    run() {
        if (!this._crawling) {
            this._crawling = true
        }
        // 调度器
        if (!this._scheduler) {
            this._scheduler = new Scheduler({
                maxConcurrency: this._maxConcurrency || 1,
                maxRequests: this._maxRequests || Infinity,
                interval: this._interval || 0,
            })
        }
        // 创建缓存目录
        if (!fs.existsSync(this._cacheDir)) {
            fs.mkdirSync(this._cacheDir, { recursive: true })
        }
        // 创建布隆过滤器
        if (this._bloom) {
            let bloomCache = path.join(this._cacheDir, 'bloom.json')
            if (fs.existsSync(bloomCache)) {
                this._bloomJSON = JSON.parse(
                    fs.readFileSync(bloomCache, 'utf8')
                )
                this._bloomFilter = BloomFilter.fromJSON(this._bloomJSON)
            } else {
                this._bloomFilter = BloomFilter.create(
                    this._bloom.size,
                    this._bloom.falseRate
                )
                this._bloomJSON = this._bloomFilter.saveAsJSON()
            }
        }
        // 还原todoList
        let urls: Req[]
        if (fs.existsSync(this._todoPath)) {
            urls = this.normalizeUrls(
                JSON.parse(fs.readFileSync(this._todoPath, 'utf8'))
            )
        } else {
            urls = this.normalizeUrls(this._startUrls)
        }

        this.followLinks(urls, true)
    }
    // 结束当前爬取
    stop() {
        this._crawling = false
        this._scheduler.clear()
    }
    // 深度爬取
    followLinks(urls: Req[], immediate: Boolean = false) {
        // url布隆去重
        if (this._bloomFilter) {
            urls = urls.filter((v) => {
                return this._bloomFilter.has(v.url) === false
            })
        }
        // 加入队列
        this._todoList.push(...urls)
        // 消费队列
        if (immediate) {
            this.applyCrawling()
        }
    }
    // 消费todoList
    applyCrawling() {
        let pendings = this._todoList.filter((v) => v._state === 'pending'),
            group = groupBy<Req>(pendings, (v) => new URL(v.url).hostname)

        Object.entries<Req[]>(group).forEach(([hostname, list]) => {
            // 支持并发请求不同域名url
            let crawling = this._hostCrawling[hostname]
            if (!crawling) {
                // lock
                this._hostCrawling[hostname] = true
                list.forEach((v) => (v._state = 'downloading'))

                this.pushTasks(list, crawling === undefined, () => {
                    // unlock
                    this._hostCrawling[hostname] = false
                    this.applyCrawling()
                })
            }
        })
    }
    // 添加爬取任务(尾递归调用)
    pushTasks(reqs: Req[], immediate: Boolean, cb?: Function) {
        let req = reqs.shift()
        if (!req) {
            cb && cb()
            return
        }

        // 队列间隔控制
        setTimeout(
            () => {
                let routes = this._spiders.filter((v) => v.match(req)),
                    context: Context,
                    me = this

                if (this._context) {
                    context = this._context()
                }

                // 默认作为全局route
                routes.unshift(this)

                this._scheduler.push(async () => {
                    let res: Res
                    // hook:request
                    await asyncForEach(
                        routes,
                        async (v) => await v.hooks.request.promise(req, context)
                    )
                    // start
                    try {
                        // proxy 代理设置
                        if (this._proxy) {
                            let proxy = await this._proxy(req)
                            req.proxy = proxy.url
                            req.maxRetry = proxy.maxRetry || 3
                        }
                        // send
                        let { status, body, headers } = await send(req)
                        res = {
                            status,
                            headers,
                            body: body.toString(),
                            // 计算url
                            resolveLink(...parts: string[]) {
                                return me.resolveLink(req.url, ...parts)
                            },
                            // 深度爬取接口
                            followLinks(urls: Links) {
                                me.followLinks(me.normalizeUrls(urls))
                            },
                        }
                    } catch (err) {
                        // hook:fail 请求失败
                        await asyncForEach(
                            routes,
                            async (v) =>
                                await v.hooks.fail.promise(req, err, context)
                        )
                    }
                    // todo 区分有效res与无效res
                    if (res) {
                        // hook:download
                        await asyncForEach(
                            routes,
                            async (v) =>
                                await v.hooks.download.promise(
                                    req,
                                    res,
                                    context
                                )
                        )
                        // end
                        this.commitUrl(req)
                        // next
                        this.pushTasks(reqs, false, cb)
                    }
                })
            },
            immediate
                ? 0
                : typeof this._interval === 'function'
                ? this._interval(req)
                : this._interval || 0
        )
    }
    // 提交一个url，将其视为已爬取
    commitUrl(req: Req) {
        // set bloom-filter
        if (this._bloomFilter) {
            this._bloomFilter.add(req.url)
            this._saveBloom()
        }
        // remove from todo-list
        let idx = this._todoList.findIndex((v) => v.url === req.url)
        if (idx >= 0) {
            this._todoList.splice(idx, 1)
            this._saveTodoList()
        }
    }
    // 获取缓存目录
    getCacheDir() {
        return this._cacheDir
    }
    // 添加route
    use(options: Spider<Context> | SpiderOptions<Context>): Spider<Context> {
        if (this._useSet.has(options)) {
            return
        }

        let spider
        if (options instanceof Spider) {
            spider = options
        } else {
            spider = new Spider(options)
        }

        this._spiders.push(spider)

        return spider
    }
}
