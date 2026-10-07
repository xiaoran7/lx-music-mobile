import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Section from '../components/Section'
// import Button from './components/Button'

import { createStyle, openUrl } from '@/utils/tools'
// import { showPactModal } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { showPactModal } from '@/core/common'

// const qqGroupUrl = 'mqqopensdkapi://bizAgent/qm/qr?url=http%3A%2F%2Fqm.qq.com%2Fcgi-bin%2Fqm%2Fqr%3Ffrom%3Dapp%26p%3Dandroid%26jump_from%3Dwebapi%26k%3Du1zyxek8roQAwic44nOkBXtG9CfbAxFw'
// const qqGroupUrl2 = 'mqqopensdkapi://bizAgent/qm/qr?url=http%3A%2F%2Fqm.qq.com%2Fcgi-bin%2Fqm%2Fqr%3Ffrom%3Dapp%26p%3Dandroid%26jump_from%3Dwebapi%26k%3D-l4kNZ2bPQAuvfCQFFhl1UoibvF5wcrQ'
// const qqGroupWebUrl = 'https://qm.qq.com/cgi-bin/qm/qr?k=jRZkyFSZ4FmUuTHA3P_RAXbbUO_Rrn5e&jump_from=webapi'
// const qqGroupWebUrl2 = 'https://qm.qq.com/cgi-bin/qm/qr?k=HPNJEfrZpBZ9T8szYWbe2d5JrAAeOt_l&jump_from=webapi'

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const openAuthorHome = () => {
    void openUrl('https://github.com/lyswhut')
  }
  const openHomePage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-mobile')
  }
  const openDesktopPage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-desktop')
  }
  const openSyncPage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-sync-server')
  }
  const openSharePage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-share')
  }
  const openIssuePage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-mobile/issues')
  }
  const openGHReleasePage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-mobile/releases')
  }
  const openFAQPage = () => {
    void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/faq')
  }
  const openPactModal = () => {
    showPactModal()
  }
  const openPartPage = () => {
    void openUrl('https://github.com/xiaoran7/lx-music-mobile#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE')
  }

  const textLinkStyle = {
    ...styles.text,
    textDecorationLine: 'underline',
    color: theme['c-primary-font'],
  } as const

  return (
    <Section title={t('setting_about')}>
      <View style={styles.part}>
        <Text style={styles.text}><Text style={styles.boldText}>落雪音乐 (LX Music)</Text> 由原作者 </Text>
        <TouchableOpacity onPress={openAuthorHome}>
          <Text style={textLinkStyle}>lyswhut (落雪无痕)</Text>
        </TouchableOpacity>
        <Text style={styles.text}> 首创开发，官方文档：</Text>
        <TouchableOpacity onPress={openFAQPage}>
          <Text style={textLinkStyle}>官方文档中心</Text>
        </TouchableOpacity>
        <Text style={styles.text}>。在此致以最崇高的敬意！</Text>
      </View>

      <View style={styles.part}>
        <Text style={styles.boldText}>🎧 落雪全家桶 (LX Music Suite) 生态矩阵：</Text>
      </View>
      <View style={{ ...styles.part, paddingLeft: 8 }}>
        <Text style={styles.text}>• 💻 桌面端：</Text>
        <TouchableOpacity onPress={openDesktopPage}>
          <Text style={textLinkStyle}>LX Music Desktop</Text>
        </TouchableOpacity>
        <Text style={styles.text}> (自研听歌统计与私有分享)</Text>
      </View>
      <View style={{ ...styles.part, paddingLeft: 8 }}>
        <Text style={styles.text}>• 📱 移动端：</Text>
        <TouchableOpacity onPress={openHomePage}>
          <Text style={textLinkStyle}>LX Music Mobile</Text>
        </TouchableOpacity>
        <Text style={styles.text}> (后台保活与一键分享)</Text>
      </View>
      <View style={{ ...styles.part, paddingLeft: 8 }}>
        <Text style={styles.text}>• 🔄 同步服务：</Text>
        <TouchableOpacity onPress={openSyncPage}>
          <Text style={textLinkStyle}>LX Music Sync Server</Text>
        </TouchableOpacity>
        <Text style={styles.text}> (WebSocket 同步 + CRDT 统计)</Text>
      </View>
      <View style={{ ...styles.part, paddingLeft: 8 }}>
        <Text style={styles.text}>• 🎵 分享服务：</Text>
        <TouchableOpacity onPress={openSharePage}>
          <Text style={textLinkStyle}>LX Music Share</Text>
        </TouchableOpacity>
        <Text style={styles.text}> (单曲流存、1:1 原生单页、留言板)</Text>
      </View>

      <View style={styles.part}>
        <Text style={styles.text}>本分支开源地址：</Text>
        <TouchableOpacity onPress={openHomePage}>
          <Text style={textLinkStyle}>https://github.com/xiaoran7/lx-music-mobile</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>最新版下载地址：</Text>
        <TouchableOpacity onPress={openGHReleasePage}>
          <Text style={textLinkStyle}>GitHub Releases</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}><Text style={styles.boldText}>本软件没有客服</Text>，遇使用问题请仔细阅读常见问题后，仍有问题可到 GitHub </Text>
        <TouchableOpacity onPress={openIssuePage}>
          <Text style={textLinkStyle}>提交 Issue</Text>
        </TouchableOpacity>
        <Text style={styles.text}>。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>目前本项目的原始发布地址<Text style={styles.boldText}>只有 GitHub</Text>，其他渠道均为第三方转载发布，可信度请自行鉴别。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}><Text style={styles.boldText}>本项目没有微信公众号之类的所谓「官方账号」，也未在小米、华为、vivo 等应用商店发布同名应用，谨防被骗！</Text></Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>若你使用过程中遇到<Text style={styles.boldText}>广告</Text>或者<Text style={styles.boldText}>引流</Text>的信息，则表明你当前运行的软件是「第三方修改版」。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>若在升级新版本时提示「<Text style={styles.boldText}>签名不一致</Text>」，则表明你手机上的旧版本或者将要安装的新版本中<Text style={styles.boldText}>有一方</Text>是「<Text style={styles.boldText}>第三方修改版</Text>」。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>你已签署本软件的</Text>
        <TouchableOpacity onPress={openPactModal}><Text style={styles.text} color={theme['c-primary-font']}> 许可协议 </Text></TouchableOpacity>
        <Text style={styles.text}>，协议在线版本在 </Text>
        <TouchableOpacity onPress={openPartPage}><Text style={textLinkStyle}>这里</Text></TouchableOpacity>
        <Text style={styles.text}>。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>原作者: </Text>
        <Text style={styles.boldText}>落雪无痕</Text>
        <Text style={styles.text}> | 全家桶维护: </Text>
        <Text style={styles.boldText}>xiaoran7</Text>
      </View>
    </Section>
  )
})

const styles = createStyle({
  part: {
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
  },
  boldText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlignVertical: 'bottom',
  },
  throughText: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    textAlignVertical: 'bottom',
  },
  btn: {
    flexDirection: 'row',
  },
})
