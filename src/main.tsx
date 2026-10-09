import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider, type Lang } from './i18n'
import { loadPersisted } from './lib/storage'
import './theme/themes.css'

function Root() {
  const [lang, setLang] = useState<Lang>(loadPersisted().lang === 'en' ? 'en' : 'de')
  return (
    <LanguageProvider lang={lang} setLang={setLang}>
      <App />
    </LanguageProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
