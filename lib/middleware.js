import {co} from 'co'

export default function middleware (respond) {
  return function (req, res, next) {
    co(respond(req))
    .then((response) => {
      res.status(response.status)
      if (response.type) {
        res.type(response.type)
      }
      if (response.file) {
        res.sendFile(response.file)
      } else if (response.body) {
        res.end(response.body)
      } else {
        res.end()
      }
    })
    .catch(next)
  }
}
