import { hashPassword } from "../src/lib/password";

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash-password -w @sibs/web -- "sua-senha"');
  process.exit(1);
}
console.log(hashPassword(password));
