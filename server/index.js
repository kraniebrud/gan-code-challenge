const fastify = require('fastify')()
const path = require('path')
const fs = require('fs-extra')

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

const getAllAddresses = async () => {
  const fpath = path.resolve(__dirname, '..', 'challenge/addresses.json')
  const file = await fs.readFile(fpath)
  return JSON.parse(file)
}

const calcDist = (from, to) => {
  /**
   * https://www.movable-type.co.uk/scripts/latlong.html
   */

  const [ lat1, lat2 ] = [ from.latitude, to.latitude ]
  const [ lon1, lon2 ] = [ from.longitude, to.longitude ]
  
  const R = 6371e3 // metres, "the earth is a perfect sphere and has a radius is 6371 km"

  const φ1 = lat1 * Math.PI/180 // φ, λ in radians
  const φ2 = lat2 * Math.PI/180
  const Δφ = (lat2-lat1) * Math.PI/180
  const Δλ = (lon2-lon1) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  const dist = R * c // in metres
  const km = (dist / 1000).toFixed(2) // to km & fixed 2 decimals

  return Number(km)
}

fastify.get('/cities-by-tag', async (req, reply) => {
  const { query } = req

  const addresses = await getAllAddresses()

  const cities = addresses.filter((addr) => { 
    return addr.tags.includes(query.tag) && addr.isActive === Boolean(query.isActive)
  })

  reply.code(200).send({ cities })
})

fastify.get('/distance', async (req, reply) => {
  const { query } = req

  const addresses = await getAllAddresses()

  const from = addresses.find((f) => f.guid === query.from)
  const to = addresses.find((f) => f.guid === query.to)
  const distance = calcDist(from, to)

  const result = { from, to, distance, unit: 'km' }

  reply.code(200).send(result)
})

fastify.listen(PORT, HOST, (err) => {
  if (err) throw err
})
