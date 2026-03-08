# NAS Client Connect v2.0 — Setup Guide

## Cài đặt trên máy remote (Windows)

1. Copy toàn bộ folder `client_connect` sang máy remote.

2. **Cách 1: Tự động (Khuyên dùng)**
   - Chạy `setup_client_connect.bat`: Sẽ hỏi thông tin (IP Server, Machine ID).
   - Chạy `start_client_connect.bat`: Để khởi động client sau khi đã setup.

3. **Cách 2: Thủ công (Command Line)**
   - Cài dependencies:
     ```bash
     npm install
     ```
   - Chạy setup wizard:
     ```bash
     node client_connect.js --setup --server ws://[IP_SERVER]:3001/ws/agent --machine-id [ID]
     ```

## Cài đặt trên máy remote (Linux/Mac)

1. Copy folder `client_connect` sang máy remote.
2. Cài dependencies:
   ```bash
   npm install
   ```
3. Chạy setup wizard:
   ```bash
   node client_connect.js --setup --server ws://[IP_SERVER]:3001/ws/agent --machine-id [ID]
   ```

## Setup Wizards (Chi tiết)
Setup wizard sẽ:
- ✅ Kiểm tra SSH service có đang chạy không
- ✅ Detect tất cả IP addresses
- ✅ Kiểm tra storage (disk space)
- ✅ Kết nối và bind thông tin lên NAS Server
- ✅ Lưu config vào `client_connect.config.json`
- ✅ Tự động start client connect sau khi setup

## Cách 2: Chạy trực tiếp
```bash
node client_connect.js --server ws://[IP_SERVER]:3001/ws/agent --machine-id [ID]
```

## Cách 3: Dùng saved config
Sau khi đã setup, client sẽ lưu config. Lần sau chỉ cần:
```bash
node client_connect.js
```

## Tất cả tùy chọn
| Option | Short | Mô tả |
|--------|-------|--------|
| `--server <url>` | `-s` | WebSocket URL của NAS server (bắt buộc) |
| `--machine-id <id>` | `-m` | Machine ID trên hệ thống NAS |
| `--paths <dirs>` | `-p` | Thư mục muốn share, ngăn cách bởi dấu phẩy |
| `--name <name>` | `-n` | Tên client (mặc định: hostname) |
| `--setup` | | Chạy setup wizard |
| `--ssh-user <user>` | | SSH username để auto-bind |
| `--ssh-pass <pass>` | | SSH password để auto-bind |
| `--ssh-port <port>` | | SSH port (mặc định: 22) |
| `--help` | `-h` | Hiện hướng dẫn |

## Ví dụ
```bash
# Setup wizard đầy đủ
node client_connect.js --setup -s ws://192.168.1.84:3001/ws/agent -m 3 --ssh-user admin --ssh-pass 123456

# Chạy bình thường
node client_connect.js -s ws://192.168.1.84:3001/ws/agent -m 3

# Share nhiều thư mục
node client_connect.js -s ws://192.168.1.84:3001/ws/agent -m 2 -p "/home,/var/data,/mnt/nas"
```

> **Lưu ý:** Thay `192.168.1.84` bằng IP thực tế của máy chủ NAS. **KHÔNG dùng `localhost`** khi chạy trên máy khác.