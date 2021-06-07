const server = require('./server')

server.ready(() => {
  require('./challenge')
})