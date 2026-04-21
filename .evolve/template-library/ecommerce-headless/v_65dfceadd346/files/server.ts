import http from 'node:http'
import { getProduct, listProducts } from './api/products.ts'
import { addLineItem, createCart, getCart, removeLineItem } from './api/cart.ts'
import { checkout } from './api/checkout.ts'
import { stripeWebhook } from './webhooks/stripe.ts'

const port = Number.parseInt(process.env.PORT ?? '{{port}}', 10)

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: '{{serviceName}}', baseCurrency: '{{baseCurrency}}' }))
    return
  }

  if (url.pathname === '/api/products' && request.method === 'GET') return listProducts(request, response)
  const productMatch = /^\/api\/products\/([^/]+)$/.exec(url.pathname)
  if (productMatch && request.method === 'GET') return getProduct(request, response, productMatch[1])

  if (url.pathname === '/api/carts' && request.method === 'POST') return createCart(request, response)
  const cartMatch = /^\/api\/carts\/([^/]+)$/.exec(url.pathname)
  if (cartMatch && request.method === 'GET') return getCart(request, response, cartMatch[1])

  const itemsMatch = /^\/api\/carts\/([^/]+)\/items$/.exec(url.pathname)
  if (itemsMatch && request.method === 'POST') return addLineItem(request, response, itemsMatch[1])
  const itemMatch = /^\/api\/carts\/([^/]+)\/items\/([^/]+)$/.exec(url.pathname)
  if (itemMatch && request.method === 'DELETE') return removeLineItem(request, response, itemMatch[1], itemMatch[2])

  const checkoutMatch = /^\/api\/carts\/([^/]+)\/checkout$/.exec(url.pathname)
  if (checkoutMatch && request.method === 'POST') return checkout(request, response, checkoutMatch[1])

  if (url.pathname === '/webhooks/stripe' && request.method === 'POST') return stripeWebhook(request, response)

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`{{serviceName}} listening on ${port}`)
})
