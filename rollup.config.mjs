import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'esm/index.mjs',
                format: 'esm',
                plugins: [terser()],
                sourcemap: true,
            },
        ],
        plugins: [
            typescript({
                tsconfig: './tsconfig.mjs.json',
            }),
            commonjs(),
            resolve(),
        ],
    },
]
