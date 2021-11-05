export interface SchedulerOptions {
    maxConcurrency?: number // 最大并发数（同时存在的最大请求数量）
    maxRequests?: number // 最大请求数（请求达到总数，则停止深度爬取）
}

// 调度器
export class Scheduler {
    // 因子
    private _maxConcurrency = 1
    private _maxRequests = Infinity
    // 状态
    private _todos = [] // 待执行任务队列
    private _runningCount = 0 // 执行中任务数量
    private _doneCount = 0 // 已完成任务数量
    private _round = 0 // 轮次

    constructor(options) {
        Object.entries(options).forEach(([k, v]) => {
            if (v) {
                this['_' + k] = v
            }
        })

        if (this._maxConcurrency < 1) {
            throw new Error('maxConcurrency必须为大于0的整数')
        }
    }
    // 添加任务(自动执行)
    push(...targets) {
        this._todos.push(...targets)

        if (this._todos.length <= 0) {
            return
        }
        // 首次运行
        if (this._round === 0) {
            this._round++
        }
        // 异步执行
        setImmediate(() => this.exec())
    }
    // 执行任务
    exec() {
        // 最大任务数限制
        if (this._runningCount + this._doneCount <= this._maxRequests) {
            // 并发数量限制
            let remain = this._maxConcurrency - this._runningCount

            if (remain > 0) {
                let tasks = this._todos.splice(0, remain)
                this._runningCount += remain
                ;(() => {
                    // 记住当前轮次
                    let myRound = this._round

                    Promise.all([
                        tasks.map((fn) =>
                            fn().finally(() => {
                                // 非过期任务
                                if (myRound == this._round) {
                                    this._runningCount--
                                    this._doneCount++

                                    // 激活队列
                                    if (this._todos.length > 0) {
                                        this.exec()
                                    }
                                }
                            })
                        ),
                    ])
                })()
            }
        } else {
            this.clear()
        }
    }
    // 移除所有剩余任务
    clear() {
        this._todos = []
    }
    // 重置
    reset() {
        this._round++
        this._runningCount = 0
        this._doneCount = 0
        this.clear()
    }
}
