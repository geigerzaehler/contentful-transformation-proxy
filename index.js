import express from 'express'
import middleware from './lib/middleware'
import axios from 'axios'
import expressCors from 'cors'
import {mapValues} from 'lodash'
import * as VM from 'vm'
import bodyParser from 'body-parser'

import * as Out from './lib/out-transform'

const dispatcherId = process.env['DISPATCHER_ID']
const port = process.env.PORT || 3000
const transformSpace = process.env['TRANSFORM_SPACE']
const transformSpaceKey = process.env['TRANSFORM_SPACE_KEY']

if (!dispatcherId) {
  throw new Error('Missing "DISPATCHER_ID" env variable')
}

function transformation (code) {
  return function (req) {
    const js = new VM.Script(code)
    const module = { exports: {} }

    js.runInNewContext({ module })

    return module.exports(req)
  }
}

function* loadIncomingTransformations (space, authHeader) {
  const response = yield axios({
    method: 'GET',
    baseURL: 'https://api.contentful.com',
    url: `/spaces/${space}/public/entries`,
    params: {
      content_type: 'incomingTransformation',
    },
    headers: {
      Authorization: `Bearer ${authHeader}`,
    },
  })

  return response.data.items
}

function* createdEntry (space, authHeader, payload) {
  return yield axios({
    method: 'POST',
    baseURL: 'https://api.contentful.com',
    url: `/spaces/${space}/entries`,
    data: payload.data,
    headers: {
      Authorization: `Bearer ${authHeader}`,
      'X-Contentful-Content-Type': payload.contentType,
    },
  })
}

function* handleOutgoingRequest (req) {
  const authHeader = req.headers['authorization']

  const response = yield axios({
    method: 'GET',
    baseURL: 'https://cdn.contentful.com',
    url: req.url,
    headers: {
      'Authorization': authHeader,
    },
  })

  const transformer = yield* Out.load(transformSpace, transformSpaceKey, dispatcherId)
  const transform = Out.makeTransformation(transformer)
  const transformedResponse = applyOnResponse(transform, response.data)

  return {
    status: 200,
    body: JSON.stringify(transformedResponse, null, 2),
  }
}

function* handleInconmingRequest (req) {
  const path = req.path.substr(1).split('/')
  const space = path[1]
  const authHeader = req.query.accessToken
  const incomingTransformations = yield* loadIncomingTransformations(space, authHeader)
  const transformedPayload = transformation(incomingTransformations[0].fields.code['en-US'])(req)

  if (transformedPayload) {
    yield* createdEntry(space, authHeader, transformedPayload)
  }

  return {
    status: 200,
  }
}

express()
.use(expressCors())
.use(bodyParser.urlencoded({ extended: true }))
.use(middleware(function* (req) {
  if (req.method === 'GET') {
    return yield* handleOutgoingRequest(req)
  }

  if (req.method === 'POST') {
    return yield* handleInconmingRequest(req)
  }
}))
.listen(port, () => {
  console.log(`Listening on port ${port}`)
})


/**
 * Applies the function 'f' to all entries in a contentful reponse.
 *
 * If the response is a collection with includes it applies the
 * function to all items and all includes. Otherwise it just applies
 * the function to the response.
 */
function applyOnResponse (f, response) {
  if (response.sys.type === 'Array') {
    return Object.assign({}, response, {
      items: response.items.map(f),
      includes: mapValues(response.includes, f),
    })
  } else {
    return f(response)
  }
}
