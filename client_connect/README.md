# NAS Manager — Client Connect

Thư mục này dùng để **cài đặt trên máy khách (remote machine)** để kết nối với hệ thống NAS Manager.

---

## Yêu Cầu

- Windows 7/10/11 (64-bit)
- Kết nối mạng LAN tới NAS Server
- **Machine ID** lấy từ trang Admin của NAS Manager

---

## Cài Đặt (Chỉ làm 1 lần)

### Bước 1 — Chạy Setup
Double-click vào **`setup_agent.bat`**

Script sẽ tự động:
- ✅ Kiểm tra & cài Node.js nếu chưa có
- ✅ Cài đặt thư viện cần thiết
- ✅ Kết nối và đăng ký với NAS Server

### Bước 2 — Nhập thông tin
```
IP NAS Server : IP máy chủ cài NAS Manager (VD: 192.168.1.10)
Machine ID    : ID máy này trong hệ thống (lấy ở trang Admin)
```

---

## Sử Dụng Hàng Ngày

| File | Tác dụng |
|------|----------|
| `start_agent.bat` | **Kết nối** tới NAS Server (chạy ngầm) |
| `stop_agent.bat`  | **Ngắt kết nối** |
| `setup_agent.bat` | Cài đặt lại / thay đổi cấu hình |

> 💡 **Mẹo**: Thêm `start_agent.bat` vào Startup để tự động kết nối khi khởi động Windows.
> `Win + R` → `shell:startup` → Copy shortcut vào đây.

---

## Khắc Phục Lỗi

| Lỗi | Giải pháp |
|-----|-----------|
| Kết nối thất bại | Kiểm tra IP Server và kết nối mạng LAN |
| Machine ID không hợp lệ | Kiểm tra lại trong trang Admin > Infrastructure |
| Node.js lỗi | Chạy lại `setup_agent.bat` với quyền Admin |

---

*NAS Manager v1.0-beta*
