import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.create({
  data: {
    id: "test-user-001",
    email: "kartik@arthvo.test",
    legalName: "KARTIKAY TRIPATHI",
    nameAliases: ["kartikay tripathi", "kartikay"],
  },
});
console.log("✅ User created:", user.email);

await prisma.activityEvent.create({
  data: {
    userId: user.id,
    eventType: "SALARY_UPLOAD",
    metadata: { filename: "salary-april-2026.pdf", employer: "APT BIOTECH" },
  },
});
console.log("✅ Activity logged: SALARY_UPLOAD");

await prisma.salarySlip.create({
  data: {
    userId: user.id,
    periodMonth: new Date("2026-04-01"),
    employer: "APT BIOTECH PRIVATE LIMITED",
    netPay: 184791,
    components: { basic: 92000, hra: 36800, pf: 11040, tds: 15500, netPay: 184791 },
  },
});
console.log("✅ Salary slip saved: April 2026");

const slips = await prisma.salarySlip.findMany({ where: { userId: user.id } });
console.log("✅ Retrieved", slips.length, "slip(s) — Net pay: ₹" + slips[0].netPay);

await prisma.salarySlip.deleteMany({ where: { userId: user.id } });
await prisma.activityEvent.deleteMany({ where: { userId: user.id } });
await prisma.user.delete({ where: { id: user.id } });
console.log("✅ Cleaned up");
console.log("");
console.log("🎉 DATABASE IS WORKING");
process.exit(0);
