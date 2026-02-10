const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const wallets = await prisma.wallet.findMany({
    select: {
      address: true,
      type: true,
      createdAt: true
    }
  })
  console.log('Wallet list:')
  wallets.forEach((w, i) => {
    console.log(`${i + 1}. ${w.address} (${w.type})`)
  })
}

main()
  .finally(() => prisma.$disconnect())
