import { SendOptions } from '../utils/send'

// 请求对象
export interface ReqOptions extends SendOptions {
    state?: 'pending' | 'downloading'
}

// 请求对象
class Req {
    // 重试次数
    retryTimes: number
    // url
    url: string
    // 来源页面
    refer: string
    // method
    method: 'POST' | 'GET'
    // body data
    data: object

    // headers
    headers: object
    // 状态
    state: 'pending' | 'downloading'
    // query params
    params: object
    // proxy
    proxy: string
    // 最大重试次数
    maxRetry: number
    // 连接超时阈值(ms)
    timeout: number

    constructor(options: ReqOptions) {
        Object.assign(
            this,
            {
                state: 'pending',
                refer: '',
                retryTimes: 0,
                maxRetry: 0,
            },
            options
        )
    }
}

export { Req }
