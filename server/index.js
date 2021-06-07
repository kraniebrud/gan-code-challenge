const fastify = require('fastify')({ logger: 'info' })
const path = require('path')
const fs = require('fs-extra')

const PORT = '8080'
const HOST = '127.0.0.1'
const SECRET_TOKEN = Buffer.from('thesecrettoken').toString('base64')
const ADDRESSES_FILE = path.resolve(__dirname, '..', 'challenge/addresses.json')

const getAllAddresses = async () => {
  const data = await fs.readFile(ADDRESSES_FILE)
  return JSON.parse(data)
}

const calculateDistance = (from, to) => {
  // > https://www.movable-type.co.uk/scripts/latlong.html, -- thank GOD for Google! ;)

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

  const distance = R * c // in metres
  const km = (distance / 1000).toFixed(2) // to km & fixed 2 decimals

  return Number(km)
}

fastify.addHook('onRequest', async (req, reply) => {
  const { headers } = req
  const bearer = headers.authorization?.substring('bearer '.length) // go ahead and replace 'bearer' with 'cheese' if you want ;)
  const authenticated = bearer && bearer === SECRET_TOKEN
  if (!authenticated) {
    reply.status(401).send()
  }
  return
})

fastify.get('/cities-by-tag', async (req, reply) => {
  const { query } = req
  const addresses = await getAllAddresses()
  const cities = addresses.filter((addr) => { 
    return addr.tags.includes(query.tag) && addr.isActive === Boolean(query.isActive)
  })
  return { cities }
})

fastify.get('/distance', async (req, reply) => {
  const { query } = req
  const addresses = await getAllAddresses()

  const from = addresses.find((f) => f.guid === query.from)
  const to = addresses.find((f) => f.guid === query.to)
  const distance = calculateDistance(from, to)

  return { from, to, distance, unit: 'km' }
})

const inMemoryAreaQueue = {
  queue: [],
  enqueue: async ({ from, distance }) => {
    const allAddresses = await getAllAddresses()
    const fromAddress = allAddresses.find((f) => f.guid === from)
    const result = allAddresses.filter((toAdress) => {
      const x = calculateDistance(fromAddress, toAdress)
      return x <= distance && toAdress.guid !== fromAddress.guid
    })
    return result
  },
  create: (area) => {
    const guid = '2152f96f-50c7-4d76-9e18-f7033bd14428'
    const enqueue = inMemoryAreaQueue.enqueue(area)
    inMemoryAreaQueue.queue.push({ guid, enqueue })
    return { guid }
  },
  get: (guid) => {
    const enqueued = inMemoryAreaQueue.queue.find((f) => f.guid === guid)
    return enqueued
  },
}

fastify.get('/area', (req, reply) => {
  const { protocol, hostname, query } = req
  const { guid } = inMemoryAreaQueue.create({ from: query.from, distance: query.distance })
  const resultsUrl = `${protocol}://${hostname}/area-result/${guid}`

  reply.code(202)
  return { resultsUrl }
})

fastify.get('/area-result/:guid', async (req, reply) => {
  const { params } = req
  const enqueued = inMemoryAreaQueue.get(params.guid)?.enqueue
  if (enqueued) {
    const cities = await enqueued
    return { cities }
  }
  reply.code(202)
  return []
})

fastify.get('/all-cities', async (req, reply) => {
  const file = path.resolve(ADDRESSES_FILE)
  const data = fs.createReadStream(file, 'utf8')
  return data
})

fastify.listen(PORT, HOST, (err) => {
  if (err) throw err
})

module.exports.ready = fastify.ready
