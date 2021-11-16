import { SendMessage } from '../utils/send'

// 响应对象
export interface ResOptions extends SendMessage {}

// 响应对象
class Res {
    // 响应code
    status: number
    // 响应头
    headers: object
    // 响应数据
    body: Buffer

    constructor(resOpts: ResOptions) {
        Object.assign(this, {}, resOpts)
    }
}

export { Res }
