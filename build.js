const exec = require('child_process').exec
const path = require('path')
const madge = require('madge')
const glob = require('glob')
const replaceFile = require('replace-in-file')
const fs = require('fs')
const vueCompiler = require('vue-template-compiler')
const rimraf = require('rimraf')
const copy = require('recursive-copy')

const SRC_CODE_DIR  = path.resolve(__dirname, 'src')
const SRC_CODE_DIR_REG = new RegExp(`^${SRC_CODE_DIR}`)
const TMP_DIR = path.resolve(__dirname, 'tmp')

const extractedVueFiles = []



function findLatestTag(){
  return new Promise((resolve, reject) => {
    exec('git tag --list', (err, stdout, stderr) => {
      if(err) console.error(err)
      const tagList = stdout.split('\n').filter(it => it)
      const latestTag = tagList[tagList.length - 2]
      resolve(latestTag)
    })
  })
}

function findChangedFile(latestTag){
  return new Promise((resolve, reject) => {
    exec(`git diff ${latestTag} --name-only --diff-filter=ACMR`, (err, stdout) => {
      if(err) console.error(err)
      const diffFileList = stdout.split('\n').filter(s => s)
      console.log('changedList:', diffFileList)
      const needBundleList = []
      diffFileList.forEach(item => {
        const filePath = item
        const fileAbsolutePath = path.resolve(__dirname, filePath)
        if(SRC_CODE_DIR_REG.test(fileAbsolutePath)){
          needBundleList.push(fileAbsolutePath)
        }

      })
      console.log('needBundleList: ', needBundleList)
      resolve(needBundleList)
    })
  })
}

// findLatestTag().then(tag => {
//   findChangedFile(tag)
// })


// madge(path.resolve(__dirname, 'src/a.js')).then(res => {
//   console.log(res.obj())
// })

function replaceAllFileImportVue(filePath){

}

function extractScriptFromVue(vueFile){
  return new Promise(resolve => {
    const vueContent = fs.readFileSync(vueFile, {encoding:'utf-8'})
    const res = vueCompiler.parseComponent(vueContent, {})
    const scriptContent = res.script.content
    const newFileName = vueFile.replace(/\.vue$/, '.vue.js')
    fs.writeFile(newFileName, scriptContent, (err) => {
      if(err) console.error(err)
      console.log(`File '${vueFile}' has been extracted to ${newFileName}`)
      extractedVueFiles.push(newFileName)
      resolve()
    })
  })
}

function getAllFiles(dirPath){
  // const new RegExp(`${dirPath}/\S.(js|vue)$`)
  const files = glob.sync(`${dirPath}/**/*+(.vue|.js)`)
  return files
}

function getAllVueFiles(files){
  return files.filter(f => /\.vue$/ig.test(f) )
}
function getAllJsFiles(files){
  return files.filter(f => /\.js$/.test(f))
}

async function copyAllFiles(from = SRC_CODE_DIR, dest = TMP_DIR){
  // 删除tmp目录
  await deleteDir(dest)
  // 创建tmp目录
  fs.mkdirSync(dest)
  await copy(from, dest)
      .then(results => {
        console.info(`Copied ${results.length} files`)
      })
      .catch(err => {
        console.log('Copy failed: \n')
        console.error(err)
        return
      })
}

function deleteDir(dirPath){
  return new Promise(resolve => {
    const isExist = checkDirExist(dirPath)
    if(isExist){
      rimraf(dirPath, fs, () => {
        console.log(`${dirPath} has deleted`)
        resolve()
      })
    }else {
      console.error(`Directory '${dirPath}' is not found`)
      resolve()
    }
  })
  .catch(err => {
    console.log('delete directory error: \n')
    console.log(err)
  })
}
function checkDirExist(dirPath){
  let isExist = false
  try{
    fs.accessSync(dirPath, fs.constants.F_OK)
    isExist = true
  }catch(e){
    isExist = false
  }
  return isExist
}

// allVueFiles.forEach(f => {
//   extractScriptFromVue(f)
// })

/**
 * STEP 1: 复制目录
 * STEP 2: 修改所有文件中 import xxx from 'xxx.vue' 为  import xxx from 'xxx.vue.js'
 * STEP 3: 提取vue文件到js文件 并命名为  xxx.vue.js
 * STEP 4: 分析所有入口js文件生成依赖树
 * STEP 5: 修改依赖树中 ".vue.js"后缀的文件名字为 ".vue"
 * STEP 6: 查找src目录中发生变化的文件
 * STEP 7: 利用变化的文件与依赖树比对计算出需要打包的入口文件 
 */

async function main(){
  // 将src整个目录复制到临时目录 TMP_DIR
  await copyAllFiles()

  const allFiles = getAllFiles(SRC_CODE_DIR)
  const allVueFiles = getAllVueFiles(allFiles)

}


main()

