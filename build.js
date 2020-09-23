const exec = require('child_process').exec
const path = require('path')

const codeDir  = path.resolve(__dirname, 'src')
const codeDirReg = new RegExp(`^${codeDir}`)



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
      console.log(stdout)
      const diffFileList = stdout.split('\n').slice(0, -1)
      const needBundleList = []
      diffFileList.forEach(item => {
        const status = item.split('\t')[0]
        const filePath = item.split('\t')[1]
        const fileAbsolutePath = path.resolve(__dirname, filePath)
        if(status !== 'D' && codeDirReg.test(fileAbsolutePath)){
          needBundleList.push(fileAbsolutePath)
        }

      })
      resolve(needBundleList)
    })
  })
}

findLatestTag().then(tag => {
  findChangedFile(tag)
})
