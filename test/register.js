const tsNode = require('ts-node')
const tsConfigPaths = require('tsconfig-paths')
const testTSConfig = require('./tsconfig.json')

// tsc
tsConfigPaths.register({
    baseUrl: './test',
    paths: {
        ...testTSConfig.compilerOptions.paths,
    },
})
// ts-node
tsNode.register({
    files: true,
    transpileOnly: true,
    project: './tsconfig.json',
})
