const { Client } = require('ssh2');

/**
 * Thực thi command SSH trên remote machine
 * @param {object} config - { host, port, username, password }
 * @param {string} command - Lệnh cần chạy
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
exports.execCommand = (config, command) => {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                let stdout = '';
                let stderr = '';

                stream.on('close', (code) => {
                    conn.end();
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
                });

                stream.on('data', (data) => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            });
        }).on('error', (err) => {
            reject(err);
        }).connect({
            host: config.host,
            port: config.port || 22,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
    });
};

/**
 * Liệt kê files qua SFTP
 */
exports.listFiles = (config, remotePath) => {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            const targetPath = (!remotePath || remotePath === '') ? '.' : remotePath;

            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                sftp.readdir(targetPath, (err, list) => {
                    conn.end();
                    if (err) {
                        return reject(err);
                    }

                    const files = list.map(item => ({
                        name: item.filename,
                        isDirectory: item.longname.startsWith('d'),
                        size: item.attrs.size,
                        path: (targetPath === '.' ? '' : targetPath) + '/' + item.filename
                    }));

                    resolve(files);
                });
            });
        }).on('error', (err) => {
            reject(err);
        }).connect({
            host: config.host,
            port: config.port || 22,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
    });
};

/**
 * Liệt kê system users trên remote machine
 */
exports.listUsers = async (config) => {
    // Lấy danh sách user có shell hợp lệ (không phải nologin/false)
    const result = await exports.execCommand(config,
        `awk -F: '$7 !~ /(nologin|false|sync|shutdown|halt)$/ && $3 >= 0 { print $1":"$3":"$4":"$6":"$7 }' /etc/passwd`
    );

    if (result.code !== 0) {
        throw new Error(result.stderr || 'Failed to list users');
    }

    const users = result.stdout.split('\n').filter(Boolean).map(line => {
        const [username, uid, gid, home, shell] = line.split(':');
        return {
            username,
            uid: parseInt(uid),
            gid: parseInt(gid),
            home,
            shell,
            isSystem: parseInt(uid) < 1000 && parseInt(uid) !== 0
        };
    });

    return users;
};

/**
 * Tạo user mới trên remote machine
 */
exports.createUser = async (config, userData) => {
    const { username, password, shell, createHome } = userData;

    if (!username || !password) {
        throw new Error('Username and password are required');
    }

    // Validate username (chỉ cho phép alphanumeric, underscore, hyphen)
    if (!/^[a-z_][a-z0-9_-]*$/.test(username)) {
        throw new Error('Invalid username. Use lowercase letters, numbers, underscore, hyphen.');
    }

    // Build useradd command
    const homeFlag = createHome !== false ? '-m' : '';
    const shellFlag = shell ? `-s ${shell}` : '-s /bin/bash';

    // Tạo user
    const createResult = await exports.execCommand(config,
        `sudo useradd ${homeFlag} ${shellFlag} ${username} 2>&1`
    );

    if (createResult.code !== 0) {
        // Kiểm tra nếu user đã tồn tại
        if (createResult.stderr.includes('already exists') || createResult.stdout.includes('already exists')) {
            throw new Error(`User '${username}' already exists`);
        }
        throw new Error(createResult.stderr || createResult.stdout || 'Failed to create user');
    }

    // Set password
    const passResult = await exports.execCommand(config,
        `echo "${username}:${password}" | sudo chpasswd 2>&1`
    );

    if (passResult.code !== 0) {
        throw new Error(passResult.stderr || 'Failed to set password');
    }

    return { username, message: `User '${username}' created successfully` };
};

/**
 * Xóa user trên remote machine
 */
exports.deleteUser = async (config, username) => {
    if (!username) throw new Error('Username is required');

    // Không cho xóa root và user đang SSH
    if (username === 'root' || username === config.username) {
        throw new Error(`Cannot delete user '${username}'`);
    }

    const result = await exports.execCommand(config,
        `sudo userdel -r ${username} 2>&1`
    );

    if (result.code !== 0) {
        throw new Error(result.stderr || result.stdout || 'Failed to delete user');
    }

    return { username, message: `User '${username}' deleted successfully` };
};

/**
 * Đổi password user trên remote machine
 */
exports.changeUserPassword = async (config, username, newPassword) => {
    if (!username || !newPassword) {
        throw new Error('Username and new password are required');
    }

    const result = await exports.execCommand(config,
        `echo "${username}:${newPassword}" | sudo chpasswd 2>&1`
    );

    if (result.code !== 0) {
        throw new Error(result.stderr || 'Failed to change password');
    }

    return { username, message: `Password changed for '${username}'` };
};
