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

function findChangedFile(preTag){
  return new Promise((resolve, reject) => {
    exec(`git diff ${preTag} --name-only --diff-filter=ACMR`, (err, stdout) => {
      if(err) console.error(err)
      const diffFileList = stdout.split('\n').filter(s => s)
      const needBundleList = []
      diffFileList.forEach(item => {
        const filePath = item
        const fileAbsolutePath = path.resolve(__dirname, filePath)
        // 过滤掉跟源码目录无关的文件
        // if(SRC_CODE_DIR_REG.test(fileAbsolutePath)){
        //   needBundleList.push(fileAbsolutePath)
        // }
        needBundleList.push(fileAbsolutePath)

      })
      resolve(needBundleList)
    })
  })
}

async function getChangedFileList(){
  let fileList = []
  try{
    const tag = await findLatestTag()
    fileList = await findChangedFile(tag)
  }catch(e){
    console.log('Get Changed File List Error Occurred\n')
    console.error(e)
  }
  return fileList
}

function extractScriptFromVue(vueFile){
  return new Promise(resolve => {
    const vueContent = fs.readFileSync(vueFile, {encoding:'utf-8'})
    const res = vueCompiler.parseComponent(vueContent, {})
    const scriptContent = res.script && res.script.content || ''
    if(!scriptContent){
      console.log(`'${vueFile}' file content is empty`)
      return resolve()
    }
    const newFileName = vueFile.replace(/\.vue$/, '.vue.js')
    fs.writeFile(newFileName, scriptContent, (err) => {
      if(err) console.error(err)
      console.log(`File '${vueFile}' has been extracted to ${newFileName}`)
      extractedVueFiles.push(newFileName)
      resolve()
    })
  })
  .catch(err => {
    console.log(`Extract '${vueFile}' occurred Error \n`)
    console.error(err)
  })
}

function extractAllVue(files){
  const pList = files.map(f => extractScriptFromVue(f))
  return Promise.all(pList)
}

function getAllFiles(dirPath){
  const files = glob.sync(`${dirPath}/**/*+(.vue|.js)`)
  return files
}

function getAllVueFiles(files = []){
  return files.filter(f => /\.vue$/ig.test(f) )
}
function getAllJsFiles(files = []){
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

function replaceImport(file){
  const options = {
    files: file,
    from: /\.vue/,
    to: `.vue.js`
  }
  return replaceFile(options).then(results => {
    console.log(`替换结果: \n`)
    console.log(results)
  })
  .catch(err => {
    console.error('Error occurred: \n', err)
  })
}

function getEntries(dir){
  const allFiles = getAllFiles(path.join(dir, 'pages'))
  return getAllJsFiles(allFiles)
}

async function makeDepTree(entries = []){
  const depTree = {}
  const options = {
    baseDir: TMP_DIR,
    fileExtensions: ['.js'],
    detectiveOptions: {
      "es6": {
        "mixedImports": true
      }
    }
  }
  const resList = await Promise.all(entries.map(f => madge(f,options)))
  resList.forEach((res, index) => {
    const key = entries[index]
    const v = res.obj()
    console.log(v)
    depTree[key] = v
  })
  return formatDepTree(depTree)
}

function formatDepTree(tree){
  const newDepTree = {}
  for(const key in tree){
    const v = tree[key]
    const deps = Object.values(v).reduce((pre, cur) => {
      return pre.concat(cur) 
    }, [])
    deps.forEach((dep, index) => {
    })
    const newDeps = deps.map(dep => {
      dep = dep.replace(`.vue.js`, '.vue')
      dep = path.join(TMP_DIR, dep)  // 拼接绝对路径
      dep = dep.replace(TMP_DIR, SRC_CODE_DIR) // 将TMP_DIR  替换成SRC_DIR
      return dep
    })
    const newKey = key.replace(TMP_DIR, SRC_CODE_DIR)
    newDepTree[newKey] = newDeps
  }
  return newDepTree
}

function getNeedBundleEntryFileList(depTree, changedList){
  const needBundleEntryList = []
  for(const key in depTree){
    const deps = depTree[key].concat([key]) // 将入口文件自己也视为自己的依赖方便查找
    if(deps.some(dep => changedList.includes(dep))){ // 依赖文件中含有变化了的文件则将其入口文件推入待编译数组
      needBundleEntryList.push(key)
    }
  }
  return needBundleEntryList
}


/**
 * STEP 1: 复制目录
 * STEP 2: 修改所有文件中 import xxx from 'xxx.vue' 为  import xxx from 'xxx.vue.js'
 * STEP 3: 提取vue文件到js文件 并命名为  xxx.vue.js
 * STEP 4: 找到所有入口文件 

 * STEP 5: 分析所有入口js文件生成依赖树
 * STEP 6: 修改依赖树中 ".vue.js"后缀的文件名字为 ".vue"
 * STEP 7: 查找src目录中发生变化的文件
 * STEP 8: 利用变化的文件与依赖树比对计算出需要打包的入口文件 
 */

async function main(){
  // // 将src整个目录复制到临时目录 TMP_DIR
  await copyAllFiles()

  const allFiles = getAllFiles(TMP_DIR)
  const allVueFiles = getAllVueFiles(allFiles)
  await replaceImport(allFiles)
  await extractAllVue(allVueFiles)
  const entries = getEntries(TMP_DIR)
  console.log('\n\n******************所有入口文件 ******************\n')
  console.log(entries)
  const depTree = await makeDepTree(entries)
  console.log('\n\n所有入口文件的依赖树: \n\n')
  console.log(depTree)
  console.log('删除临时目录： ', TMP_DIR)
  await deleteDir(TMP_DIR)
  console.log('\n\n发生变化的文件\n\n')
  const changedFileList = await getChangedFileList()
  console.log(changedFileList)
  const needBundleEntryList = getNeedBundleEntryFileList(depTree, changedFileList)
  console.log('\n\n 需要被编译的入口文件： \n')
  console.log(needBundleEntryList)
}


main()

