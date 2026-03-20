const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const workspaceRoot = path.resolve(__dirname, "..");
const legacyDbPath = path.resolve(workspaceRoot, "..", "database", "classmanager.db");
const outputDir = path.join(workspaceRoot, "out", "legacy-export");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function parseArgs(argv) {
  const args = {
    userId: "",
    username: ""
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--user") {
      args.userId = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--username") {
      args.username = argv[i + 1] || "";
      i += 1;
    }
  }

  return args;
}

function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(legacyDbPath)) {
    throw new Error(`Legacy database not found: ${legacyDbPath}`);
  }

  ensureDir(outputDir);

  const db = new Database(legacyDbPath, { readonly: true });

  try {
    const users = db
      .prepare(
        `
        SELECT id, username, email, role, created_at, last_login
        FROM users
        ORDER BY id ASC
      `
      )
      .all();
    const filteredUsers = users.filter((user) => {
      if (args.userId && String(user.id) !== String(args.userId)) {
        return false;
      }
      if (args.username && String(user.username || "") !== String(args.username)) {
        return false;
      }
      return true;
    });

    if ((args.userId || args.username) && filteredUsers.length === 0) {
      throw new Error(
        `Legacy user not found for filter userId=${args.userId || "-"} username=${args.username || "-"}`
      );
    }
    const userIds = new Set(filteredUsers.map((user) => user.id));

    const classDataRows = db
      .prepare(
        `
        SELECT user_id, data_key, data_value, updated_at
        FROM class_data
        ORDER BY user_id ASC, data_key ASC
      `
      )
      .all()
      .filter((row) => userIds.size === 0 || userIds.has(row.user_id));

    const userMap = new Map();
    for (const user of filteredUsers) {
      userMap.set(user.id, {
        user,
        data: {},
      });
    }

    for (const row of classDataRows) {
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, {
          user: { id: row.user_id },
          data: {},
        });
      }

      userMap.get(row.user_id).data[row.data_key] = {
        updatedAt: row.updated_at,
        value: parseValue(row.data_value),
      };
    }

    const exportedUsers = Array.from(userMap.values());
    const exportedAt = new Date().toISOString();
    const summary = {
      exportedAt,
      legacyDbPath,
      filters: {
        userId: args.userId || null,
        username: args.username || null
      },
      userCount: filteredUsers.length,
      classDataRowCount: classDataRows.length,
      users: exportedUsers.map((entry) => ({
        id: entry.user.id,
        username: entry.user.username || null,
        role: entry.user.role || null,
        keys: Object.keys(entry.data),
      })),
    };

    writeJson(path.join(outputDir, "summary.json"), summary);
    writeJson(
      path.join(outputDir, "users.json"),
      exportedUsers.map((entry) => entry.user)
    );

    for (const entry of exportedUsers) {
      const safeUsername = (entry.user.username || `user-${entry.user.id}`).replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      writeJson(
        path.join(outputDir, `${String(entry.user.id).padStart(4, "0")}-${safeUsername}.json`),
        entry
      );
    }

    console.log(`Legacy export completed: ${outputDir}`);
    console.log(`Users: ${filteredUsers.length}`);
    console.log(`class_data rows: ${classDataRows.length}`);
  } finally {
    db.close();
  }
}

main();
