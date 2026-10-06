import { memo, useMemo, useCallback } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import InputItem from '../../components/InputItem'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

type ShareType = LX.AppSetting['common.shareType']

const setShareType = (type: ShareType) => {
  updateSetting({ 'common.shareType': type })
}

const useActive = (type: ShareType) => {
  const shareType = useSettingValue('common.shareType')
  return useMemo(() => shareType == type, [shareType, type])
}

const Item = ({ id, name }: {
  id: ShareType
  name: string
}) => {
  const isActive = useActive(id)
  return <CheckBox marginBottom={3} marginRight={8} check={isActive} label={name} onChange={() => { setShareType(id) }} need />
}

const ExpireItem = ({ days, name }: { days: number, name: string }) => {
  const currentDays = useSettingValue('common.shareExpireDays')
  const isActive = currentDays === days
  return (
    <CheckBox
      marginBottom={3}
      marginRight={8}
      check={isActive}
      label={name}
      onChange={() => { updateSetting({ 'common.shareExpireDays': days }) }}
      need
    />
  )
}

export default memo(() => {
  const t = useI18n()
  const shareType = useSettingValue('common.shareType')
  const serverUrl = useSettingValue('common.shareServerUrl')
  const serverToken = useSettingValue('common.shareServerToken')

  const list = useMemo(() => {
    return [
      {
        id: 'system',
        name: t('setting_basic_share_type_system'),
      },
      {
        id: 'clipboard',
        name: t('setting_basic_share_type_clipboard'),
      },
      {
        id: 'custom_server',
        name: t('setting_basic_share_type_custom_server'),
      },
    ] as const
  }, [t])

  const expireList = useMemo(() => {
    return [
      { days: 1, name: t('setting_basic_share_expire_day_1') },
      { days: 3, name: t('setting_basic_share_expire_day_3') },
      { days: 7, name: t('setting_basic_share_expire_day_7') },
      { days: 30, name: t('setting_basic_share_expire_day_30') },
      { days: 0, name: t('setting_basic_share_expire_day_0') },
    ]
  }, [t])

  const handleSetUrl = useCallback((value: string, callback: (val: string) => void) => {
    const trimmed = value.trim()
    callback(trimmed)
    updateSetting({ 'common.shareServerUrl': trimmed })
  }, [])

  const handleSetToken = useCallback((value: string, callback: (val: string) => void) => {
    const trimmed = value.trim()
    callback(trimmed)
    updateSetting({ 'common.shareServerToken': trimmed })
  }, [])

  return (
    <SubTitle title={t('setting_basic_share_type')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => <Item name={name} id={id} key={id} />)
        }
      </View>
      {
        shareType === 'custom_server' ? (
          <View style={styles.serverConfig}>
            <InputItem
              value={serverUrl}
              label={t('setting_basic_share_server_url')}
              onChanged={handleSetUrl}
              placeholder="https://music.tannerlab.cn"
            />
            <InputItem
              value={serverToken}
              label={t('setting_basic_share_server_token')}
              onChanged={handleSetToken}
              placeholder="留空即无需 Token"
            />
            <View style={styles.expireBox}>
              <View style={styles.list}>
                {
                  expireList.map(({ days, name }) => <ExpireItem days={days} name={name} key={days} />)
                }
              </View>
            </View>
          </View>
        ) : null
      }
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serverConfig: {
    marginTop: 8,
  },
  expireBox: {
    marginTop: 6,
  },
})
