const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // 1. Create Roles với permissions chi tiết
    const adminRole = await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {
            permissions: JSON.stringify(['ALL'])
        },
        create: {
            name: 'Admin',
            permissions: JSON.stringify(['ALL'])
        }
    });

    const operatorRole = await prisma.role.upsert({
        where: { name: 'Operator' },
        update: {
            permissions: JSON.stringify([
                'READ_FLOOR', 'READ_ROOM',
                'MANAGE_HIERARCHY', 'WRITE_HIERARCHY',
                'READ_FILES', 'BROWSE_FILES', 'DOWNLOAD_FILES'
            ])
        },
        create: {
            name: 'Operator',
            permissions: JSON.stringify([
                'READ_FLOOR', 'READ_ROOM',
                'MANAGE_HIERARCHY', 'WRITE_HIERARCHY',
                'READ_FILES', 'BROWSE_FILES', 'DOWNLOAD_FILES'
            ])
        }
    });

    const userRole = await prisma.role.upsert({
        where: { name: 'User' },
        update: {
            permissions: JSON.stringify([
                'READ_FLOOR', 'READ_ROOM',
                'READ_FILES', 'BROWSE_FILES'
            ])
        },
        create: {
            name: 'User',
            permissions: JSON.stringify([
                'READ_FLOOR', 'READ_ROOM',
                'READ_FILES', 'BROWSE_FILES'
            ])
        }
    });

    const viewerRole = await prisma.role.upsert({
        where: { name: 'Viewer' },
        update: {
            permissions: JSON.stringify(['READ_FLOOR', 'READ_ROOM'])
        },
        create: {
            name: 'Viewer',
            permissions: JSON.stringify(['READ_FLOOR', 'READ_ROOM'])
        }
    });

    console.log('✅ Roles created:', { adminRole, operatorRole, userRole, viewerRole });

    // 2. Create Users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: { roleId: adminRole.id },
        create: {
            username: 'admin',
            password: adminPassword,
            roleId: adminRole.id
        }
    });

    const operatorPassword = await bcrypt.hash('operator123', 10);
    const operator = await prisma.user.upsert({
        where: { username: 'operator' },
        update: { roleId: operatorRole.id },
        create: {
            username: 'operator',
            password: operatorPassword,
            roleId: operatorRole.id
        }
    });

    const userPassword = await bcrypt.hash('user123', 10);
    const user = await prisma.user.upsert({
        where: { username: 'user' },
        update: { roleId: userRole.id },
        create: {
            username: 'user',
            password: userPassword,
            roleId: userRole.id
        }
    });

    console.log('✅ Users created:', { admin: admin.username, operator: operator.username, user: user.username });

    // 3. Create Hierarchy (only if no floors exist)
    const floorCount = await prisma.floor.count();
    if (floorCount === 0) {
        const floor1 = await prisma.floor.create({
            data: {
                name: 'Floor 1',
                level: 1,
                description: 'Main Server Floor',
                rooms: {
                    create: [
                        {
                            name: 'Server Room A',
                            machines: {
                                create: [
                                    {
                                        name: 'NAS-01',
                                        ipAddress: '192.168.1.100',
                                        status: 'online',
                                        mountPoints: {
                                            create: [
                                                {
                                                    name: 'Public Share',
                                                    path: 'public'
                                                },
                                                {
                                                    name: 'Backups',
                                                    path: 'backups'
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: 'Web-Server-01',
                                        ipAddress: '192.168.1.101',
                                        status: 'online'
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });
        console.log('✅ Seeded hierarchy:', floor1);
    } else {
        console.log('ℹ️  Hierarchy already exists, skipping...');
    }

    console.log('\n📋 Default Accounts:');
    console.log('  admin    / admin123    (Full Access)');
    console.log('  operator / operator123 (Manage Infrastructure + Files)');
    console.log('  user     / user123     (View + Browse Files)');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
