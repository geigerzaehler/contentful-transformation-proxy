import express from 'express'
import middleware from './lib/middleware'
import axios from 'axios'
import expressCors from 'cors'
import {mapValues} from 'lodash'

import * as Out from './lib/out-transform'

const dispatcherId = process.env['DISPATCHER_ID']
const port = process.env.PORT || 3000
const transformSpace = process.env['TRANSFORM_SPACE']
const transformSpaceKey = process.env['TRANSFORM_SPACE_KEY']

if (!dispatcherId) {
  throw new Error('Missing "DISPATCHER_ID" env variable')
}

express()
.use(expressCors())
.use(middleware(function* (req) {
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
