import urlJoin from 'url-join'
//
import { Router, RouterOptions } from './router'
import { Req, Res, DefaultContext } from './http'

// 爬虫参数
export interface SpiderOptions<Context = DefaultContext>
    extends RouterOptions<Context> {
    // 请求参数
    request?: {
        timeout?: number // 超时时间
    }
}

// 爬虫
//// 1. 爬虫常用逻辑封装
export class Spider<Context = DefaultContext> extends Router<Context> {
    // 因子
    protected _request: SpiderOptions<Context>['request']

    constructor(options: SpiderOptions<Context> = {}) {
        super(options)
        // 默认超时时间 2s
        this._request = options.request || {
            timeout: 2000,
        }
    }
    // 计算url
    resolveLink(url: string, ...parts: string[]) {
        let first = parts[0],
            urlObj = new URL(url),
            origin = urlObj.origin,
            pathname = urlObj.pathname

        // absolute path
        if (first && first.startsWith('/')) {
            pathname = ''
        }
        if (first && first.startsWith('http')) {
            return urlJoin(...parts)
        }

        return urlJoin(origin, pathname, ...parts)
    }
    // 标准化urls
    normalizeUrls(urls: string | Array<string | Req>): Req[] {
        if (typeof urls === 'string') {
            urls = [urls]
        }

        return urls.reduce<Req[]>((acc, v) => {
            let req: Req = {}
            if (typeof v === 'string') {
                // 空
                if (v === '') {
                    return acc
                }
                Object.assign(req, this._request, {
                    url: v,
                    method: 'GET' as Req['method'],
                    headers: {},
                })
            } else if (typeof v === 'object') {
                req = Object.assign(
                    {
                        method: 'GET',
                        headers: {},
                    },
                    this._request,
                    v
                )
                // 统一使用完整url
                let urlObj = new URL(req.url)
                if (req.params) {
                    Object.entries(req.params).forEach(([k, v]) => {
                        urlObj.searchParams.append(k, v.toString())
                    })
                }
                req.url = urlObj.href
                delete req.params
            }
            // add runtime state
            Object.defineProperty(req, '_state', {
                writable: true,
                enumerable: false,
                value: 'pending',
            })
            acc.push(req)
            return acc
        }, [])
    }
}
