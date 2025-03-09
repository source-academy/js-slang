import ext_lib from './External libraries.json'
import source_1 from './source_1.json'
import source_1_typed from './source_1_typed.json'
import source_2 from './source_2.json'
import source_2_typed from './source_2_typed.json'
import source_3 from './source_3.json'
import source_3_concurrent from './source_3_concurrent.json'
import source_3_typed from './source_3_typed.json'
import source_4 from './source_4.json'
import source_4_explicit_control from './source_4_explicit-control.json'
import source_4_typed from './source_4_typed.json'

export const SourceDocumentation = {
  builtins: {
    '1': source_1,
    '1_typed': source_1_typed,
    '2': source_2,
    '2_typed': source_2_typed,
    '3': source_3,
    '3_concurrent': source_3_concurrent,
    '3_typed': source_3_typed,
    '4': source_4,
    '4_typed': source_4_typed,
    '4_explicit-control': source_4_explicit_control
  },
  ext_lib
} as const
