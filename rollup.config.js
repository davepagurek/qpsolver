// @ts-check
import terser from '@rollup/plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'

import pkg from './package.json' with { type: 'json' }
import tsc from './tsconfig.json' with { type: 'json' }

export const input = `${tsc.compilerOptions.outDir}/QPSolver.js`
export const output = {
  iife: pkg.exports['.'].browser,
  esm: pkg.exports['.'].import,
}

export default [
  {
    input,
    output: {
      file: output.iife,
      name: 'QPSolver',
      format: 'iife',
      plugins: [terser()],
    },
    plugins: [
      resolve(),
      commonjs(),
      terser()
    ],
  },
  {
    input,
    output: { file: output.esm.default, format: 'esm' },
    plugins: [
      resolve(),
      commonjs(),
      terser()
    ],
  },
  {
    input: input.replace(/\.js$/, '.d.ts'),
    output: { file: output.esm.types, format: 'esm' },
    plugins: [dts()],
  },
]
