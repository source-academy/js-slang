import { Context, Result } from '..'

export async function goRunner(program: any, context: Context): Promise<Result> { 
  return { status: 'finished', context, value: undefined }
}
