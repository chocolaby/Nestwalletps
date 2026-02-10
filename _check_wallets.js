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
    console.log(`Address: ${w.address}`)
    console.log(`Type: ${w.type}`)
    console.log(`Has private key: ${w.privateKeyEncrypted ? 'Yes' : 'No'}`)
    console.log('---')
  })
}

main().finally(() => p.$disconnect())
