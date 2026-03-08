---
name: memory
description: Agent memory system. Manages persistent context across sessions — project state, user preferences, decisions, mistakes, and daily logs. MUST be loaded at every session start.
allowed-tools: Read, Write, Edit, Glob
---

# Memory Skill — Bộ Nhớ Xuyên Session

> Skill này định nghĩa cách Agent **đọc, ghi và duy trì bộ nhớ** để không phải học lại mọi thứ mỗi session.

---

## 📂 Cấu Trúc Bộ Nhớ

```plaintext
.github/memory/
├── SOUL.md          # Danh tính Agent — đọc TRƯỚC TIÊN
├── USER.md          # Preferences người dùng — không hỏi lại những gì đã có ở đây
├── MEMORY.md        # Bộ nhớ dài hạn — quyết định, rủi ro, sai lầm, progress
└── log/
    ├── TEMPLATE.md  # Template nhật ký
    └── YYYY-MM-DD.md  # Nhật ký hàng ngày
```

---

## 🔁 NGHI THỨC ĐẦU SESSION (BẮT BUỘC)

> **MANDATORY:** Mỗi session mới PHẢI thực hiện đủ 5 bước này trước bất kỳ hành động nào.

```
BƯỚC 1: Đọc SOUL.md
        → Nhớ lại mình là ai, giá trị cốt lõi, điều không được làm

BƯỚC 2: Đọc MEMORY.md
        → Xem trạng thái project, quyết định đã có, errors cần tránh

BƯỚC 3: Đọc USER.md
        → Nhớ lại preferences, cách giao tiếp, điều không hỏi lại

BƯỚC 4: Đọc log mới nhất
        → ls .github/memory/log/ → Đọc file ngày gần nhất
        → Biết session trước dừng ở đâu, việc gì còn dang dở

BƯỚC 5: Báo cáo cho user
        → "✅ Memory loaded. Tiếp tục từ: [tóm tắt 1-2 dòng]"
```

---

## 📝 NGHI THỨC CUỐI SESSION (QUAN TRỌNG)

> Trước khi session kết thúc hoặc khi task xong, PHẢI ghi log.

```
1. Mở log hôm nay: .github/memory/log/YYYY-MM-DD.md
   (Tạo mới nếu chưa có — copy từ TEMPLATE.md)

2. Cập nhật các section:
   - ✅ Đã Hoàn Thành
   - 🔄 Đang Làm / Dở Dang
   - 🐛 Vấn Đề Gặp Phải
   - 🔜 Việc Cần Làm Tiếp Theo

3. Nếu có quyết định quan trọng → cập nhật MEMORY.md → Quyết Định Quan Trọng
4. Nếu có sai lầm/bài học → cập nhật MEMORY.md → Sai Lầm Cần Tránh
5. Nếu học điều gì về user → cập nhật USER.md
```

---

## 📖 Hướng Dẫn Đọc (Selective Reading)

| File | Khi nào đọc | Thông tin có |
| ---- | ----------- | ------------ |
| `SOUL.md` | Mỗi session | Danh tính, giá trị, phong cách |
| `MEMORY.md` | Mỗi session | Project state, decisions, errors |
| `USER.md` | Mỗi session | Preferences, không hỏi lại gì |
| `log/YYYY-MM-DD.md` | Khi cần biết "hôm qua làm gì" | Context từng ngày |
| `log/*.md` (nhiều file) | Khi debug vấn đề lâu dài | Pattern theo thời gian |

---

## ✍️ Hướng Dẫn Viết

### Thêm Quyết Định Mới vào MEMORY.md

```markdown
### [DEC-XXX] Tên quyết định
- **Ngày:** YYYY-MM-DD
- **Lý do:** Tại sao quyết định như vậy
- **Rủi ro:** Gì có thể xảy ra
- **Trạng thái:** ✅ Đang dùng / ⏸️ Deprecated / 🔄 Đang xem xét
```

### Thêm Sai Lầm Mới vào MEMORY.md

```markdown
### [ERR-XXX] Tên sai lầm
- **Triệu chứng:** Điều gì xảy ra
- **Nguyên nhân:** Tại sao xảy ra
- **Phòng tránh:** Quy trình để không lặp lại
```

### Thêm Process Đã Hoàn Thành vào MEMORY.md

```markdown
| DONE-XXX | Mô tả ngắn | YYYY-MM-DD | Ghi chú nếu cần |
```

---

## 🚫 Quy Tắc Bộ Nhớ

- ❌ **Không hỏi user** về những gì đã có trong bộ nhớ
- ❌ **Không thay đổi** thông tin cũ trong MEMORY.md — chỉ thêm mới
- ❌ **Không xóa log** — log là lịch sử, không bao giờ xóa
- ✅ **Luôn ghi ngày** khi thêm entry mới
- ✅ **Cập nhật MEMORY.md** khi quyết định thay đổi (không xóa cũ, thêm entry mới với note "supersedes [DEC-XXX]")

---

## 🔗 Liên Kết Với Các Skill Khác

| Khi nào | Dùng kèm skill |
| ------- | -------------- |
| Lập kế hoạch | `plan-writing` |
| Kiến trúc hệ thống | `architecture` |
| Review code / refactor | `code-review-checklist` |
| Deploy | `deployment-procedures` |
| Debug vấn đề lâu dài | `systematic-debugging` |
