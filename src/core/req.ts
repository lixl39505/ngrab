import { SendOptions } from '../utils/send'

// 请求状态
export type ReqState =
    | 'ready' // 已创建完毕
    | 'pending' // 已加入队列
    | 'downloading' // 已发送请求
    | 'failed' // 下载失败
    | 'download' // 下载成功
// 请求对象
export interface ReqOptions extends SendOptions {
    state?: ReqState
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
    state: ReqState
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
                state: 'ready',
                refer: '',
                retryTimes: 0,
                maxRetry: 0,
            },
            options
        )
    }
}

export { Req }
