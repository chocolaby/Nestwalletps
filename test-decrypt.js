const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const KEY = 'nest-wallet-encryption-key-32chars'

async function test() {
  const w = await prisma.wallet.findUnique({
    where: { address: '0xa420fA379Cb57c36C348529062Fd20B27aaE5462' }
  })

  console.log('加密数据:', w.privateKeyEncrypted.substring(0, 50))

  const parts = w.privateKeyEncrypted.split(':')
  const key = crypto.createHash('sha256').update(KEY).digest()
  const iv = Buffer.from(parts[0], 'hex')

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let d = decipher.update(parts[1], 'hex', 'utf8')
  d += decipher.final('utf8')

  console.log('解密成功:', d.substring(0, 15) + '...')
}

test().finally(() => prisma.$disconnect())
