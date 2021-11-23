import { promisify } from 'util'
import { customAlphabet } from 'nanoid'
import { h64 } from 'xxhashjs'
import UA from 'user-agents'
//
import { send } from './send'

const ua = new UA({
    platform: 'Win32',
})

// http[s] request 函数
export { send }

// 生成随机用户代理
export function userAgent(): string {
    return ua.random().toString()
}

// 异步队列
export function runQueue<T>(
    queue: Array<T>,
    fn: (payload: T, cb: (err: any, goOn: boolean) => void) => void,
    cb: (err: any, complete: boolean) => void
) {
    const stopQueue = (err, index) => {
        // (err, complete)
        cb && cb(err, index >= queue.length)
    }

    const step = (index) => {
        if (index >= queue.length) {
            stopQueue(null, index)
        } else {
            if (queue[index]) {
                fn(queue[index], (err, goOn) => {
                    err || goOn === false
                        ? stopQueue(err, index)
                        : step(index + 1)
                })
            } else {
                step(index + 1)
            }
        }
    }

    Promise.resolve().then(() => step(0))
}
// 异步队列，promise版本
runQueue.promise = promisify(runQueue)

// 8位短id生成（大约2千万条时，会发生冲突）
export const octetId = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    8
)

// once
export function once(fn) {
    var called = false,
        result

    return function (...args) {
        if (called === false) {
            called = true
            result = fn.call(this, ...args)
        }

        return result
    }
}

// 节流
interface throttleOptions {
    leading?: boolean
    trailing?: boolean
    immediate?: boolean
}
export function throttle(
    delay: number,
    callback: Function,
    options: throttleOptions = {},
    debounceMode: boolean
) {
    var timeoutId,
        lastTimeoutId,
        lastExec = 0

    var { leading = true, trailing = true, immediate = false } = options

    function wrapper() {
        var self = this
        var elapsed = Number(new Date()) - lastExec
        var args = arguments

        // Execute `callback` and update the `lastExec` timestamp.
        function exec() {
            lastExec = Number(new Date())
            callback.apply(self, args)
        }

        function clear() {
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = undefined
            }

            if (lastTimeoutId) {
                clearTimeout(lastTimeoutId)
                lastTimeoutId = undefined
            }
        }

        // Clear any existing timeout.
        clear()

        // debounce mode
        if (debounceMode) {
            // 第一次立即执行
            if (lastExec === 0 && immediate) {
                return exec()
            }

            timeoutId = setTimeout(exec, delay)
        }
        // throttle mode
        else {
            // 第一次执行
            if (lastExec === 0) {
                // 立即执行
                if (leading) {
                    return exec()
                } else {
                    // 更新时间点
                    return (lastExec = Number(new Date()))
                }
            } else {
                // 间隔有效
                if (elapsed > delay) {
                    exec()
                }
                // 总是允许最后一次执行
                else if (trailing) {
                    lastTimeoutId = setTimeout(exec, delay - elapsed)
                }
            }
        }
    }

    // useful for unit test
    wrapper._original = callback
    // Return the wrapper function.
    return wrapper
}
// 防抖
export function debounce(
    delay: number,
    callback: Function,
    options: throttleOptions = {}
) {
    return throttle(delay, callback, options, true)
}

// 异步ForEach
export async function asyncForEach<T>(
    array: Array<T>,
    cb: (value: T, index: number, arr: Array<T>) => Promise<void>
) {
    for (let index = 0; index < array.length; index++) {
        await cb(array[index], index, array)
    }
}

// arrary.groupBy
export function groupBy<T>(
    arr: T[],
    iteratee: string | ((value: T, index: number) => string | number)
) {
    let f: (value: T, index: number) => string | number

    if (typeof iteratee === 'string') {
        var _id = iteratee

        f = function (e): string | number {
            return e[_id]
        }
    }

    let groups = {},
        key = ''

    if (typeof iteratee === 'function') {
        f = iteratee

        arr.forEach((v, i) => {
            var key = f(v, i)
            groups[key] ? groups[key].push(v) : (groups[key] = [v])
        })
    }

    if (typeof iteratee !== 'function') {
        throw new TypeError('iteratee must be String or Functiom')
    }

    return groups
}

// hash
const seed = h64(1)
export function hash(s) {
    return seed.update(s).digest().toString()
}
