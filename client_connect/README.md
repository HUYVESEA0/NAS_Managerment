# Hướng Dẫn Cài Đặt NAS Agent Trên Máy Khách

## 1. Chuẩn Bị
- Đảm bảo máy khách đã cài đặt **Node.js** (https://nodejs.org/).
- Copy thư mục `agent` sang máy khách.
- Cần biết IP của Server NAS và Machine ID sẽ gán cho máy này.

## 2. Cài Đặt Lần Đầu (Chỉ cần 1 lần)
Chạy file `setup_agent.bat` (Run as Administrator nếu cần):
1. Nhập IP Server.
2. Nhập Machine ID.
3. Nhập SSH User/Password (Tùy chọn, để server tự động SSH).
4. Hệ thống sẽ kiểm tra và cài đặt dependencies tự động.

## 3. Chạy Agent Hàng Ngày
Chạy file `start_agent.bat`:
- Agent sẽ tự động kết nối và chạy ngầm.
- Chạy file này để khởi động lại Agent nếu cần.

## 4. Chạy trên Linux/Mac
Sử dụng commands trong `README_ADVANCED.md` hoặc dùng `node agent.js --setup`.

## Ghi Chú
Nếu muốn thay đổi cấu hình (IP, Machine ID), chỉ cần chạy lại `setup_agent.bat`.
