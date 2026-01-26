// Prisma configuration
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "file:./dev.db"
    }
  }
};
