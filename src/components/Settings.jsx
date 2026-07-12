import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings as SettingsIcon } from 'lucide-react'
import { CustomSelect } from './UI.jsx'

export function Settings({ 
  toast 
}) {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const [draftLang, setDraftLang] = useState(currentLang)

  const languages = Object.keys(i18n.store?.data || {}).map(langCode => {
    const translation = i18n.store.data[langCode]?.translation || {}
    return {
      code: langCode,
      name: translation.lang_name || langCode.toUpperCase()
    }
  })

  const handleSave = () => {
    i18n.changeLanguage(draftLang)
    localStorage.setItem('app_lang', draftLang)
    toast(t('ready') + '! Settings updated.', 'info')
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <SettingsIcon size={20} />
          {t('settings_title')}
        </h1>
        <p className="page-subtitle">{t('settings_subtitle')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        <div className="card">
          <div className="card-title">{t('settings_section_interface')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">{t('settings_lang_label')}</label>
              <CustomSelect
                value={draftLang}
                onChange={setDraftLang}
                options={languages.map(l => ({ value: l.code, label: l.name }))}
              />
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {t('settings_save_btn')}
        </button>
      </div>
    </div>
  )
}
