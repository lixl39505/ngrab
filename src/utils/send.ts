import { http, https, FollowOptions, FollowResponse } from 'follow-redirects'
import { IncomingMessage, RequestOptions } from 'http'
import { Stream } from 'stream'
import zlib from 'zlib'

// send配置对象
export interface SendOptions extends FollowOptions<RequestOptions> {
    // url
    url?: string
    // method
    method?: 'POST' | 'GET'
    // headers
    headers?: object
    // body data
    data?: object
    // query params
    params?: object
    // proxy
    proxy?: string
    // 最大重试次数
    maxRetry?: number
    // 连接超时阈值(ms)
    timeout?: number
}
// send错误对象
export interface SendError extends Error {
    requestOptions?: RequestOptions
    res?: IncomingMessage & FollowResponse
}
// send返回结果
export interface SendMessage {
    status: number
    headers: object
    body: Buffer
}

// 发送网络请求
async function request(adapter, options): Promise<SendMessage> {
    return new Promise(function (resolve, reject) {
        let req = adapter.request(
            options,
            function (res: IncomingMessage & FollowResponse) {
                let receives = [],
                    stream: Stream

                // 响应失败
                if (res.statusCode !== 200) {
                    let err: SendError = new Error(
                        `Request Failed. Status Code: ${res.statusCode}`
                    )
                    err.requestOptions = Object.assign({}, options)
                    err.res = Object.assign({}, res)

                    return reject(err)
                }
                // 内容解压缩
                switch (res.headers['content-encoding']) {
                    case 'gzip':
                    case 'compress':
                    case 'deflate':
                        // add the unzipper to the body stream processing pipeline
                        stream = res.pipe(zlib.createUnzip())
                        // remove the content-encoding in order to not confuse downstream operations
                        delete res.headers['content-encoding']
                        break
                    default:
                        stream = res
                }
                // 响应成功
                stream.on('data', function (chunk) {
                    receives.push(chunk)
                })
                stream.on('end', function () {
                    let resData = Buffer.concat(receives)

                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: resData,
                    })
                })
            }
        )
        req.on('timeout', () => {
            req.abort()
            reject(
                new Error(
                    `${req.host}${req.path} timeout after ${options.timeout}ms`
                )
            )
        })
        req.on('error', function (e) {
            reject(e)
        })
        // post body
        if (options.method === 'POST' && options.data) {
            req.write(JSON.stringify(options.data))
        }
        // request end
        req.end()
    })
}

// http[s] request
export async function send(config: SendOptions): Promise<SendMessage> {
    let urlObj = new URL(config.url),
        pathname = urlObj.pathname, // 路径
        protocol = '', // 协议
        hostname = '', // 域名
        port = '' // 端口

    // extend query string
    if (config.params) {
        Object.entries(config.params).forEach(([k, v]) => {
            urlObj.searchParams.append(k, v.toString())
        })
    }
    pathname += '?' + urlObj.searchParams.toString()
    // using proxy
    if (config.proxy) {
        let proxyObj = new URL(config.proxy)

        protocol = proxyObj.protocol
        hostname = proxyObj.hostname
        port = proxyObj.port
        pathname = `${urlObj.protocol}//${urlObj.host}${pathname}` // full target url
    } else {
        protocol = urlObj.protocol
        hostname = urlObj.hostname
        port = urlObj.port
    }
    // http[s] options
    let options: RequestOptions = {
            protocol,
            hostname,
            port,
            path: pathname, // 路径(带query)
            method: config.method || 'GET',
        },
        adapter = protocol === 'https:' ? https : http,
        retry = config.maxRetry

    // request start
    if (retry > 1) {
        // retry
        for (var i = 0; i < retry; ) {
            try {
                return await request(adapter, options)
            } catch (e) {
                i++
                // rethrow
                if (i >= retry) {
                    throw e
                }
            }
        }
    } else {
        // one shot
        return await request(adapter, options)
    }
}

// short api get
send.get = function (
    url: string,
    params?: object,
    config?: SendOptions
): Promise<SendMessage> {
    let conf = config

    if (conf) {
        Object.assign(conf, {
            url,
            params,
            method: 'GET',
        })
    } else {
        conf = {
            url,
            params,
            method: 'GET',
        }
    }
    return send(conf)
}
// short api post
send.post = function (
    url: string,
    data?: object,
    config?: SendOptions
): Promise<SendMessage> {
    let conf = config

    if (conf) {
        Object.assign(conf, {
            url,
            data,
            method: 'POST',
        })
    } else {
        conf = {
            url,
            data,
            method: 'POST',
        }
    }
    return send(conf)
}

export default send
