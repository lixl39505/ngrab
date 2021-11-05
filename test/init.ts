import chai from 'chai'
import proxyquire from 'proxyquire'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'

// 启用BDD
declare global {
    const should: Chai.Should
    const except: Chai.ExpectStatic
}
Object.assign(global, {
    should: chai.should(),
    except: chai.expect,
})
// 让chai支持promise
chai.use(chaiAsPromised)
// 取消proxyquire cache
proxyquire.noPreserveCache()

// root hook plugin
export const mochaHooks = {
    afterEach() {
        console.log('sinon.restore')
        sinon.restore()
    },
}
