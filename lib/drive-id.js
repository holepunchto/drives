// + very basic, it could be a proper module, with buffer support, etc

module.exports = function (id) {
  if (!id) return 'key'

  if (id.indexOf('/') > -1 || id.indexOf('.') > -1) return 'path'

  // + should validate
  if (id.length === 52) return 'key'
  if (id.length === 64) return 'key'

  return 'path'
}
