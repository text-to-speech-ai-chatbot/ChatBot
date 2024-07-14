import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';
const USER_ID=uuidv4();
const app = express()

app.use(cors())

app.use(
  '/proxy',
  createProxyMiddleware({
    target: 'http://127.0.0.1:9000',
    changeOrigin: true,
    pathRewrite: {
      '^/proxy': '',
    },
  })
)

const port = 3001
app.listen(port, () => {
  console.log(`CORS proxy server is running at http://localhost:${port}`)
})

app.get('/user-id', (req, res) => {
  res.json({ USER_ID });
});


export{
  USER_ID
}