const exec = require('child_process').exec




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
    exec(`git diff ${latestTag} --name-status`, (err, stdout) => {
      if(err) console.error(err)
      const diffFileList = stdout.split('\n')
      .filter(str => {
        if(!str) return false
        const status = str.split('\t')[0]
        const file = str.split('\t')[1]
        return status !== 'D'
      })
      .map(str => {
        const file = str.split('\t')[1]
        return file
      })
      console.log(diffFileList)
    })
  })
}
findLatestTag().then(tag => {
  findChangedFile(tag)
})