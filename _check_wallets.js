const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const wallets = await p.wallet.findMany({
    select: {
      address: true,
      type: true,
      privateKeyEncrypted: true
    }
  })

  wallets.forEach(w => {
    console.log(`地址: ${w.address}`)
    console.log(`类型: ${w.type}`)
    console.log(`有私钥: ${w.privateKeyEncrypted ? '是' : '否'}`)
    console.log('---')
  })
}

main().finally(() => p.$disconnect())
