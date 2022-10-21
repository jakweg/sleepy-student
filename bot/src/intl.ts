import { LANGUAGE } from './config'

const supportedLanguages = ['en-US', 'pl']
if (!supportedLanguages.includes(LANGUAGE))
    throw new Error('Language not supported ' + LANGUAGE)

const importEn = () => import('./lang/en-US')

export default { ...await import('./lang/' + LANGUAGE + '.js') as Awaited<ReturnType<typeof importEn>> }

export const en = await importEn()