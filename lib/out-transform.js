import axios from 'axios'
import resolveRespose from 'contentful-resolve-response'
import * as VM from 'vm'

export function* load (space, key, id) {
  const response = yield axios({
    method: 'GET',
    baseURL: 'https://preview.contentful.com',
    url: `/spaces/${space}/entries`,
    params: {
      'sys.id': id,
      include: 2,
    },
    headers: {
      Authorization: `Bearer ${key}`,
    },
  })
  const transformer = resolveRespose(response.data)[0]

  return transformer
}


/**
 * Given a dispatcher payload it returns a transformation function for
 * entries.
 *
 * The transformation function figures out which chain to apply and
 * then reduces over the transformation functions in that chain.
 */
export function makeTransformation (dispatcher) {
  const chains = dispatcher.fields.chains
  return function (entry) {
    for (const chain of chains) {
      if (chainApplies(chain, entry)) {
        return makeChainTransform(chain)(entry)
      }
    }
    return entry
  }
}


/**
 * Given a 'chain' entry returns the transformation function
 */
function makeChainTransform (chain) {
  const trsfs = chain.fields.transformationFunctions.map((trsf) => {
    if (trsf.fields.isEnabled === false) {
      return identity
    } else {
      return runModule(trsf.fields.code)
    }
  })
  return function transform (entry) {
    return trsfs.reduce((entry, t) => t(entry), entry)
  }
}


/**
 * Return true if the transformation chain should be applied to the
 * entry.
 */
function chainApplies (chain, entry) {
  return (
    (entry && entry.sys && entry.sys.type === 'Entry') &&
    (chain.fields.contentType === entry.sys.contentType.sys.id)
  )
}


/**
 * Execute a string of JS code and return the 'module.exports' object
 */
function runModule (code) {
  const module = { exports: {} }
  const context = {module}
  VM.runInNewContext(code, context)
  return module.exports
}


function identity (x) {
  return x
}
