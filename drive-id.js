// + very basic, it could be a proper module, with buffer support, etc

module.exports = function (id) {
  if (!id) return { type: 'key' }

  if (id.indexOf('/') > -1 || id.indexOf('.') > -1) return { type: 'path' }

  // + should validate
  if (id.length === 52) return { type: 'key' }
  if (id.length === 64) return { type: 'key' }

  return { type: 'path' }
}
