const fastify = require('fastify')()

const PORT = '8080'
const HOST = '127.0.0.1'
const SECRET_TOKEN = Buffer.from('thesecrettoken').toString('base64')

fastify.addHook('onRequest', async (req, reply) => {
  const { headers } = req
  const bearer = headers.authorization?.substring('bearer '.length) || ''
  if (bearer === SECRET_TOKEN) {
    return {}
  }
  return reply.code(401).send()
})

fastify.listen(PORT, HOST, (err) => {
  if (err) throw err
})
