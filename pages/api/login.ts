// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import httpProxy, { ProxyResCallback } from 'http-proxy'
import Cookies from 'cookies'

type Data = {
	message: string
}

export const config = {
	api: {
		bodyParser: false,
	},
}

const proxy = httpProxy.createProxyServer()

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
	if (req.method !== 'POST') {
		return res.status(404).json({ message: 'method not supported' })
	}

	return new Promise((resolve) => {
		// don't send cookies to API server
		req.headers.cookie = ''

		// handle response login api
		const handleLoginResponse: ProxyResCallback = (proxyRes, req, res) => {
			let body = ''
			// proxy trả về data sau khi handle xong
			proxyRes.on('data', function (chunk) {
				body += chunk // chunk: data type string
			})

			proxyRes.on('end', function () {
				try {
					const isSuccess =
						proxyRes.statusCode && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300
					if (!isSuccess) {
						;(res as NextApiResponse).status(proxyRes.statusCode || 500).json(body)
						return resolve(true)
					}

					const { accessToken, expiredAt } = JSON.parse(body) // converse data string to object

					// convert token to cookies
					const cookies = new Cookies(req, res, { secure: process.env.NODE_ENV !== 'development' })
					// set cookies to cookies chrome
					cookies.set('access_token', accessToken, {
						httpOnly: true,
						sameSite: 'lax',
						expires: new Date(expiredAt),
					})
					// ép kiểu res sang NextApiResponse
					;(res as NextApiResponse).status(200).json({ message: 'login successfully' })
				} catch (error) {
					;(res as NextApiResponse).status(500).json({ message: 'something went wrong' })
				}

				resolve(true)
			})
		}

		// khi có event proxyRes thì gọi hàm handleLoginResponse
		proxy.once('proxyRes', handleLoginResponse)
		proxy.web(req, res, {
			target: process.env.API_URL,
			changeOrigin: true,
			selfHandleResponse: true, // true: proxy sẽ không handle api response mình sẽ tự handle
		})
	})
}
