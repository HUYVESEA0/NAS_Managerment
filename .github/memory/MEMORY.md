# MEMORY.md — Bộ Nhớ Dài Hạn Dự Án

> **ĐỌC FILE NÀY TRƯỚC KHI LÀM BẤT KỲ ĐIỀU GÌ QUAN TRỌNG.**
> Đây là nguồn sự thật duy nhất về trạng thái, quyết định và bài học của dự án.

---

## 📌 Thông Tin Dự Án

| Thuộc tính | Giá trị |
| ---------- | ------- |
| **Tên dự án** | NAS_Management |
| **Mô tả** | Hệ thống quản lý máy tính trong mạng nội bộ (NAS-style) |
| **GitHub Repo** | https://github.com/HUYVESEA0/NAS_Managerment |
| **Owner** | HUYVESEA0 |
| **Branch chính** | `main` |
| **Workspace path** | `c:\ER\NAS_Managerment` |
| **Khởi tạo** | 2026-03-05 |

---

## 🏗️ Kiến Trúc Hiện Tại

### Stack

| Layer | Tech | Path |
| ----- | ---- | ---- |
| Frontend | React 18 + Vite + Tailwind CSS | `client/` |
| Backend | Express.js + Node.js | `server/` |
| Database | SQLite via Prisma ORM | `server/prisma/` |
| Process Manager | PM2 | `ecosystem.config.js` |
| i18n | Custom locales | `client/src/locales/` |
| Agent (client connector) | Node.js agent | `client_connect/` |

### Các Máy Được Quản Lý

```
machine-master  → Máy chủ trung tâm
machine-1 → machine-6  → Máy client
Storage path: server/storage/machine-{id}/
```

### Deployment Model

- **Không có cloud** — deploy hoàn toàn trên local network
- **Offline package:** `_OFFLINE_PACKAGE/` — chứa toàn bộ app + node_portable
- **Agent offline:** `_AGENT_OFFLINE_PACKAGE/` — agent riêng cho client connect
- Build script: `pack_offline.bat`, `pack_agent_offline.bat`

---

## 🔑 Quyết Định Quan Trọng

> Mỗi quyết định có ID để tham chiếu trong log.

### [DEC-001] Dùng SQLite thay vì PostgreSQL
- **Ngày:** Trước 2026-03-05
- **Lý do:** Không có cloud, môi trường offline, SQLite đủ cho quy mô hiện tại
- **Rủi ro:** Giới hạn concurrent writes, không scale tốt nếu > 100 machines
- **Trạng thái:** ✅ Đang dùng

### [DEC-002] Offline Package với node_portable
- **Ngày:** Trước 2026-03-05
- **Lý do:** Các máy client có thể không có internet, cần cài đặt độc lập
- **Rủi ro:** Phải rebuild package mỗi khi thêm dependency
- **Trạng thái:** ✅ Đang dùng — `_OFFLINE_PACKAGE/`, `_AGENT_OFFLINE_PACKAGE/`

### [DEC-003] PM2 cho process management
- **Ngày:** Trước 2026-03-05
- **Lý do:** Auto-restart, log management, process monitoring
- **Config:** `ecosystem.config.js`
- **Trạng thái:** ✅ Đang dùng

### [DEC-004] Tách agent (client_connect) khỏi server chính
- **Ngày:** Trước 2026-03-05
- **Lý do:** Agent chạy trên mỗi máy client, server chạy trên master
- **Config:** `client_connect/agent.config.json`
- **Trạng thái:** ✅ Đang dùng

---

## ⚠️ Rủi Ro Đang Tồn Tại

| ID | Mô tả | Mức độ | Trạng thái |
| -- | ----- | ------ | ---------- |
| RISK-001 | Không có authentication mạnh (nếu mạng nội bộ bị xâm nhập) | Cao | Đang theo dõi |
| RISK-002 | Offline package nặng (node_portable ~50MB+) | Thấp | Chấp nhận |
| RISK-003 | Không có test coverage tự động | Trung | Cần cải thiện |
| RISK-004 | SQLite không hỗ trợ concurrent write tốt | Thấp | Chấp nhận với quy mô hiện tại |
| RISK-005 | Prisma migrations cần được quản lý khi deploy | Trung | Cần process rõ ràng |

---

## ❌ Sai Lầm Cần Tránh

> Đây là những lỗi đã xảy ra hoặc nhận ra — **KHÔNG LẶP LẠI**

### [ERR-001] Thay đổi Prisma schema mà không chạy migration
- **Triệu chứng:** Database và schema không đồng bộ, app crash
- **Phòng tránh:** Luôn `npx prisma migrate dev` sau khi sửa `schema.prisma`
- **Kiểm tra:** `npx prisma db push --dry-run` trước khi migrate production

### [ERR-002] Build offline package mà không build client trước
- **Triệu chứng:** Offline package nhưng thiếu assets mới nhất
- **Phòng tránh:** Luôn `npm run build` trong `client/` trước `pack_offline.bat`

### [ERR-003] Sửa code server trực tiếp mà không restart PM2
- **Triệu chứng:** Các thay đổi không có hiệu lực trên production
- **Phòng tránh:** Sau mọi thay đổi server code: `pm2 restart all`

### [ERR-004] Quên cập nhật agent.config.json khi đổi server port/address
- **Triệu chứng:** Agent không kết nối được với server
- **File:** `client_connect/agent.config.json`, `_AGENT_OFFLINE_PACKAGE/client_connect/agent.config.json`

### [ERR-005] Push secrets/env lên GitHub
- **Phòng tránh:** Kiểm tra `.gitignore` — file `.env` phải luôn được ignore

---

## 🔄 Quá Trình Đã Hoàn Thành (Không Lặp Lại)

> Track những setup/migration chỉ cần làm một lần

| ID | Mô tả | Ngày | Ghi chú |
| -- | ----- | ---- | ------- |
| DONE-001 | Khởi tạo hệ thống memory/SOUL.md | 2026-03-05 | File này |
| DONE-002 | Setup Prisma schema ban đầu | Trước 2026-03-05 | Migration đã có |
| DONE-003 | Tạo offline package structure | Trước 2026-03-05 | `_OFFLINE_PACKAGE/` |

---

## 📦 Dependencies Quan Trọng

### Server (`server/package.json`)

```
express, @prisma/client, cors, helmet, multer, socket.io (kiểm tra thực tế)
```

### Client (`client/package.json`)

```
react, react-dom, react-router-dom, vite, tailwindcss, axios (kiểm tra thực tế)
```

> **Lưu ý:** Cập nhật danh sách này mỗi khi thêm dependency quan trọng mới

---

## 🗝️ Biến Môi Trường Cần Thiết

```bash
# server/.env (KHÔNG commit lên git)
DATABASE_URL="file:./dev.db"
PORT=3000
JWT_SECRET=...
NODE_ENV=production

# client/.env (nếu có)
VITE_API_URL=http://localhost:3000
```

---

## 📅 Lịch Sử Cập Nhật Memory

| Ngày | Cập nhật |
| ---- | -------- |
| 2026-03-05 | Khởi tạo MEMORY.md lần đầu — thiết lập bộ nhớ dự án |

---

<!-- Cập nhật cuối: 2026-03-05 | Version: 1.0.0 -->
