module.exports = function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
