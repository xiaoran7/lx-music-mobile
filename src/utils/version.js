import { httpGet } from '@/utils/request'
import { author, name } from '../../package.json'
import { downloadFile, stopDownload, temporaryDirectoryPath } from '@/utils/fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]

const repoOwner = 'xiaoran7'
const repoName = 'lx-music-mobile'

const address = [
  [`https://raw.githubusercontent.com/${repoOwner}/${repoName}/master/publish/version.json`, 'direct'],
  [`https://fastly.jsdelivr.net/gh/${repoOwner}/${repoName}@master/publish/version.json`, 'direct'],
  [`https://cdn.jsdelivr.net/gh/${repoOwner}/${repoName}@master/publish/version.json`, 'direct'],
]


const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const getNpmPkgInfo = async(url) => {
  return request(url).then(json => {
    if (!json.versionInfo) throw new Error('failed')
    const info = JSON.parse(json.versionInfo)
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    case 'npm':
      promise = getNpmPkgInfo(url)
      break
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

export const getTargetAbi = async() => {
  const supportedAbis = await getSupportedAbis()
  for (const abi of abis) {
    if (supportedAbis.includes(abi)) return abi
  }
  return abis[abis.length - 1]
}

export const getApkDownloadUrl = async(version) => {
  const abi = await getTargetAbi()
  return `https://github.com/${repoOwner}/${repoName}/releases/download/v${version}/${name}-v${version}-${abi}.apk`
}

let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath

export const downloadNewVersion = async(version, onDownload = noop) => {
  const abi = await getTargetAbi()
  const rawUrl = `https://github.com/${repoOwner}/${repoName}/releases/download/v${version}/${name}-v${version}-${abi}.apk`

  // 镜像加速候选列表：首选高可用公共镜像，自动回退官方源
  const downloadCandidates = [
    `https://ghproxy.net/${rawUrl}`,
    `https://gh-proxy.com/${rawUrl}`,
    rawUrl,
  ]

  let savePath = temporaryDirectoryPath + '/lx-music-mobile.apk'
  if (downloadJobId) stopDownload(downloadJobId)

  let lastError = null
  for (const targetUrl of downloadCandidates) {
    try {
      const { jobId, promise } = downloadFile(targetUrl, savePath, {
        progressInterval: 500,
        connectionTimeout: 15000,
        readTimeout: 30000,
        begin({ statusCode, contentLength }) {
          onDownload(contentLength, 0)
        },
        progress({ contentLength, bytesWritten }) {
          onDownload(contentLength, bytesWritten)
        },
      })
      downloadJobId = jobId
      await promise
      apkSavePath = savePath
      return updateApp()
    } catch (err) {
      lastError = err
      // 当前源失败，循环尝试下一个镜像源
    }
  }

  throw lastError || new Error('All download sources failed')
}

export const updateApp = async() => {
  if (!apkSavePath) throw new Error('apk Save Path is null')
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
