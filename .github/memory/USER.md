# USER.md — Hiểu Về Người Dùng

> Agent đọc file này để **không phải hỏi lại** những điều đã biết về cách người dùng làm việc.

---

## 👤 Thông Tin Cơ Bản

| Thuộc tính | Giá trị |
| ---------- | ------- |
| **Ngôn ngữ giao tiếp** | Tiếng Việt |
| **Múi giờ** | UTC+7 (Việt Nam) |
| **OS của user** | Windows |
| **Terminal ưa thích** | PowerShell / Git Bash |
| **Editor** | VS Code |

---

## 🧠 Phong Cách Làm Việc

### Giao tiếp

- User thích câu trả lời **ngắn gọn, đi thẳng vào vấn đề** — không dài dòng
- Trả lời bằng **tiếng Việt** khi user viết tiếng Việt
- Không cần giải thích lại những thứ user đã biết hoặc đã yêu cầu trước đó
- User không thích bị hỏi quá nhiều câu hỏi xác nhận — **1-2 câu là đủ**

### Làm việc

- User thích **implement trực tiếp** hơn là plan dài dòng
- Không cần hỏi permission trước mỗi bước nhỏ
- User coi trọng **chất lượng code** và **kiến trúc sạch**
- Khi có lỗi, user muốn biết **nguyên nhân gốc rễ**, không chỉ workaround

### Decision Making

- User có xu hướng **ra quyết định nhanh** khi được cung cấp đủ thông tin
- Nếu có trade-off, user muốn **tóm tắt ngắn** rồi đề xuất một lựa chọn rõ ràng
- User không muốn đọc lại những gì đã giải thích lần trước — ghi vào log

---

## 🔧 Preferences Kỹ Thuật

### Code Style

- **Ngôn ngữ code/comment:** English
- **Variable naming:** camelCase (JS/TS), snake_case (Python)
- Tránh `any` trong TypeScript — phải dùng type rõ ràng
- Ưa thích **functional style** hơn class-based khi có thể
- Không thích over-engineering — **YAGNI principle**

### Tech Preferences

| Lĩnh vực | Công nghệ ưa thích |
| -------- | ------------------ |
| Frontend | React + Vite, Tailwind CSS |
| Backend | Express.js, Node.js |
| Database | SQLite (dev), Prisma ORM |
| Process | PM2 |
| Testing | Thiếu — cần bổ sung |
| Deploy | Local network, offline package |

### Workflow Preferences

- **Git:** Commit nhỏ, message rõ ràng bằng tiếng Anh
- **PR:** Không cần PR cho feature nhỏ trên main
- **Documentation:** Bổ sung theo cách Markdown `.md` files, không over-document
- Luôn **test trên môi trường local** trước khi đóng gói offline

---

## 📋 Điều User Thường Quên Nhắc (Agent Tự Nhớ)

- [ ] User hay quên cập nhật `.env` sau khi thêm config mới
- [ ] Offline package cần build lại nếu thêm dependency mới
- [ ] Prisma migration cần chạy sau khi sửa `schema.prisma`
- [ ] `pm2 restart all` sau khi cập nhật server code trong production
- [ ] Client build (`npm run build`) trước khi đóng gói offline

---

## 🚧 Điều Không Nên Hỏi User Nữa

> Agent đã biết những điều này — **không hỏi lại**

- Tên project / repo: đã trong `MEMORY.md`
- Stack hiện tại: Express + React + Prisma + PM2
- Deploy target: local network machines (không có cloud)
- Bản chất offline package: copy node_portable + build files + server
- Ngôn ngữ UI: có i18n, đang dùng `client/src/locales/`

---

## 📅 Cập Nhật Log

> Khi user nói điều gì mới về cách họ muốn được phục vụ → cập nhật file này ngay

| Ngày | Cập nhật |
| ---- | -------- |
| 2026-03-05 | Khởi tạo USER.md lần đầu |

---

<!-- Cập nhật cuối: 2026-03-05 | Version: 1.0.0 -->
