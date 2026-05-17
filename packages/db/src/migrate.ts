import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const client = postgres(url!, { max: 1 });
  const db = drizzle(client);
  console.log('Ensuring zameen schema exists...');
  await client`create schema if not exists zameen`;
  console.log('Applying Drizzle migrations...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Done.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
