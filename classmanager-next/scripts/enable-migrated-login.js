const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
  const args = {
    username: "",
    password: ""
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--username") {
      args.username = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--password") {
      args.password = argv[i + 1] || "";
      i += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.username || !args.password) {
    throw new Error("Use --username <username> --password <password>");
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { username: args.username },
      select: {
        id: true,
        username: true,
        status: true
      }
    });

    if (!user) {
      throw new Error(`User not found: ${args.username}`);
    }

    const passwordHash = bcrypt.hashSync(args.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: "active"
      }
    });

    console.log(
      JSON.stringify(
        {
          username: user.username,
          status: "active",
          loginEnabled: true
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
