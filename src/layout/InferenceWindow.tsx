import { useI18n } from '../i18n'
import { Icon } from './icons'

type Props = {
  onClose: () => void
}

export function InferenceWindow({ onClose }: Props) {
  const { t } = useI18n()
  return (
    <section className="cs-window cs-inference" aria-label={t('inference')}>
      <header className="cs-window-title">
        <Icon name="chat" size={14} />
        <span className="cs-window-name">{t('inference')}</span>
        <button className="cs-window-close" title={t('closeWindow')} onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="cs-inference-body" />
    </section>
  )
}
