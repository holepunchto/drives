const { minimatch } = require('minimatch')

const ignore = /\/(\.drives|\.git|\.github|\.DS_Store|package-lock\.json|node_modules\/\.package-lock\.json)(\/|$)/i

module.exports = function generateFilter (custom) {
  return function (key) {
    if (ignore.test(key)) return false

    if (custom) {
      for (let filter of custom) {
        if (filter[0] !== '/') filter = '**/' + filter
        if (minimatch(key, filter, { nocase: true, dot: true })) return false
      }
    }

    return true
  }
}
