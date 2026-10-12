import { useI18n } from '../i18n'
import { Icon } from './icons'

type Mode = 'local' | 'files' | 'github'

type Props = {
  mode: Mode
  open: boolean
  onSelect: (mode: Mode) => void
}

export function SideRail({ mode, open, onSelect }: Props) {
  const { t } = useI18n()
  return (
    <nav className="cs-siderail" aria-label={t('featureList')}>
      <button
        className={open && mode === 'local' ? 'is-on' : ''}
        title={t('featureList')}
        onClick={() => onSelect('local')}
      >
        <Icon name="tree" size={18} />
      </button>
      <button
        className={open && mode === 'files' ? 'is-on' : ''}
        title={t('files')}
        onClick={() => onSelect('files')}
      >
        <Icon name="files" size={18} />
      </button>
      <button
        className={open && mode === 'github' ? 'is-on' : ''}
        title={t('github')}
        onClick={() => onSelect('github')}
      >
        <Icon name="github" size={18} />
      </button>
    </nav>
  )
}
