import express from 'express'
import middleware from './lib/middleware'
import axios from 'axios'
import resolveRespose from 'contentful-resolve-response'
import * as VM from 'vm'

const dispatcherId = process.env['DISPATCHER_ID']

if (!dispatcherId) {
  throw new Error('Missing "DISPATCHER_ID" env variable')
}

function dispatch (dispatcher, entry) {
  const chains = dispatcher.fields.chains
  const applicableChains = chains.filter((chain) => chain.fields.contentType === entry.sys.contentType.sys.id)
  const transformations = applicableChains.reduce((transformations, chain) => {
    const compiledTransformations = chain.fields.transformationFunctions.map((transformation) => {
      return new VM.Script(transformation.fields.code)
    })

    return transformations.concat(compiledTransformations)
  }, [])

  return transformations.reduce((trsfEntry, transformation) => {
    const module = { exports: {} }

    transformation.runInNewContext({module})

    return module.exports(trsfEntry)
  }, entry)
}

express()
.use(middleware(function* (req) {
  const authHeader = req.headers['authorization']
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

  const dispatcher = yield* loadDispatcher(space, authHeader)
  const transformedEntry = dispatch(dispatcher, response.data)

  return {
    status: 200,
    body: JSON.stringify(transformedEntry, null, 2),
  }
}))
.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

function* loadDispatcher (space, authHeader) {
  const response = yield axios({
    method: 'GET',
    baseURL: 'https://cdn.contentful.com',
    url: `/spaces/${space}/entries`,
    params: {
      'sys.id': dispatcherId,
      include: 2,
    },
    headers: {
      Authorization: authHeader,
    },
  })
  const dispatcher = resolveRespose(response.data)[0]

  return dispatcher
}
