import express from 'express'
import middleware from './lib/middleware'
import axios from 'axios'
import * as FS_ from 'fs'
import * as B from 'bluebird'

const FS = B.promisifyAll(FS_)
const port = process.env.PORT || 3000

const dispatcherId = process.env['DISPATCHER_ID']

if (!dispatcherId) {
  throw new Error('Missing "DISPATCHER_ID" env variable')
}

express()
.use(middleware(function* (req) {
  const authHeader = req.headers['authorization']
  const trsfId = req.query.transformation
  const path = req.path.substr(1).split('/')
  const space = path[1]

  const response = yield axios({
    method: 'GET',
    baseURL: 'https://cdn.contentful.com',
    url: req.url,
    headers: {
      'Authorization': authHeader,
    },
  })

  const [trsfVersion, transformSrc] = yield* getTransformation(space, trsfId, authHeader)
  const fileName = `./tmp/${space}-${trsfId}-${trsfVersion}.js`
  console.log(`Writing transformation to ${fileName}`)
  yield FS.writeFileAsync(fileName, transformSrc)
  const transform = require(fileName)

  return {
    status: 200,
    body: JSON.stringify(transform(response.data), null, 2),
  }
}))
.listen(port, () => {
  console.log(`Listening on port ${port}`)
})


function* getTransformation (space, id, authHeader) {
  const response = yield axios({
    method: 'GET',
    baseURL: 'https://cdn.contentful.com',
    url: `/spaces/${space}/entries/${id}`,
    headers: {
      'Authorization': authHeader,
    },
  })
  return [
    response.data.sys.revision,
    response.data.fields.code,
  ]
}
