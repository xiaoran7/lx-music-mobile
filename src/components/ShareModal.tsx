import { useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clipboardWriteText, shareText, toast, openUrl, shareToCustomServer } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'

export interface ShareModalType {
  show: (musicInfo: LX.Music.MusicInfo) => void
}

export default forwardRef<ShareModalType, {}>((props, ref) => {
  const dialogRef = useRef<DialogType>(null)
  const [musicInfo, setMusicInfo] = useState<LX.Music.MusicInfo | null>(null)
  const defaultTtl = useSettingValue('common.shareExpireDays') ?? 7
  const [ttlDays, setTtlDays] = useState<number>(defaultTtl)
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const theme = useTheme()
  const t = useI18n()

  const expireList = useMemo(() => [
    { days: 1, name: t('setting_basic_share_expire_day_1') },
    { days: 3, name: t('setting_basic_share_expire_day_3') },
    { days: 7, name: t('setting_basic_share_expire_day_7') },
    { days: 30, name: t('setting_basic_share_expire_day_30') },
    { days: 0, name: t('setting_basic_share_expire_day_0') },
  ], [t])

  useImperativeHandle(ref, () => ({
    show(info: LX.Music.MusicInfo) {
      setMusicInfo(info)
      setTtlDays(defaultTtl)
      setShareUrl('')
      setLoading(false)
      dialogRef.current?.setVisible(true)
    },
  }))

  const handleGenerate = async() => {
    if (!musicInfo || loading) return
    setLoading(true)
    try {
      const url = await shareToCustomServer(musicInfo, ttlDays)
      setShareUrl(url)
    } catch (err: any) {
      toast(t('share_custom_server_fail', { msg: err.message || String(err) }))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!shareUrl) return
    const title = musicInfo ? `${musicInfo.name}${musicInfo.singer ? ` - ${musicInfo.singer}` : ''}` : ''
    const text = title ? `${title}\n${shareUrl}` : shareUrl
    clipboardWriteText(text)
    const tip = ttlDays > 0
      ? t('share_custom_server_success_ttl', { days: ttlDays })
      : t('share_custom_server_success')
    toast(tip)
  }

  const handleSystemShare = () => {
    if (!shareUrl || !musicInfo) return
    void shareText(
      t('share_card_title_music', { name: musicInfo.name }),
      t('share_title_music'),
      `${musicInfo.name} - ${musicInfo.singer}\n${shareUrl}`,
    )
  }

  const handleOpenBrowser = () => {
    if (!shareUrl) return
    void openUrl(shareUrl)
  }

  return (
    <Dialog ref={dialogRef} title={t('share_modal_title')}>
      <View style={styles.container}>
        {musicInfo ? (
          <View style={styles.musicMeta}>
            <Text style={styles.title} numberOfLines={1}>{musicInfo.name}</Text>
            <Text style={styles.singer} size={13} color={theme['c-font-label']} numberOfLines={1}>
              {musicInfo.singer}{musicInfo.meta?.albumName ? ` · ${musicInfo.meta.albumName}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text size={13} color={theme['c-font-label']} style={styles.sectionLabel}>{t('share_modal_expire_label')}：</Text>
          <View style={styles.expireRow}>
            {expireList.map(({ days, name }) => (
              <CheckBox
                key={days}
                check={ttlDays === days}
                label={name}
                marginRight={12}
                marginBottom={6}
                onChange={() => {
                  setTtlDays(days)
                  if (shareUrl) setShareUrl('') // 切换有效天数后清空旧链接，提示重新生成
                }}
                need
              />
            ))}
          </View>
        </View>

        {shareUrl ? (
          <View style={styles.resultBox}>
            <Text size={12} color={theme['c-font-label']}>{t('share_modal_link_label')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.urlBox,
                {
                  borderColor: theme['c-primary-font'],
                  backgroundColor: 'rgba(0,0,0,0.03)',
                },
              ]}
              onPress={handleCopy}
            >
              <Text numberOfLines={2} size={13} color={theme['c-primary-font']} style={{ fontWeight: '600' }}>
                {shareUrl}
              </Text>
            </TouchableOpacity>

            <View style={styles.btnRow}>
              <Button style={[styles.actionBtn, { backgroundColor: theme['c-primary-font'] }]} onPress={handleCopy}>
                <Text size={13} color="#ffffff" style={{ fontWeight: 'bold' }}>{t('share_modal_copy_btn')}</Text>
              </Button>
              <Button style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={handleSystemShare}>
                <Text size={13} color="#ffffff" style={{ fontWeight: 'bold' }}>{t('share_modal_system_share_btn')}</Text>
              </Button>
              <Button style={[styles.actionBtn, { backgroundColor: '#64748b' }]} onPress={handleOpenBrowser}>
                <Text size={13} color="#ffffff" style={{ fontWeight: 'bold' }}>{t('share_modal_open_browser')}</Text>
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.generateBox}>
            <Button
              style={[styles.generateBtn, { backgroundColor: theme['c-primary-font'] }]}
              disabled={loading}
              onPress={handleGenerate}
            >
              <Text size={15} color="#ffffff" style={{ fontWeight: 'bold' }}>
                {loading ? t('share_modal_generating') : t('share_modal_generate_btn')}
              </Text>
            </Button>
          </View>
        )}
      </View>
    </Dialog>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    minWidth: 290,
  },
  musicMeta: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 17,
    marginBottom: 4,
  },
  singer: {
    opacity: 0.85,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 6,
    fontWeight: '500',
  },
  expireRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  generateBox: {
    marginTop: 10,
  },
  generateBtn: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  resultBox: {
    marginTop: 4,
  },
  urlBox: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 10,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
})
