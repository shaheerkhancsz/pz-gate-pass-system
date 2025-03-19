import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';

const createAdmin = async () => {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  
  await db.insert(users).values({
    email: 'admin@parazelsus.pk',
    password: hash,
    fullName: 'Admin User',
    department: 'IT',
    roleId: 1,
    active: true
  });
  
  console.log('Admin user created');
};

createAdmin().catch(console.error); 