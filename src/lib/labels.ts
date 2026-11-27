export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  CHECKED: "Đã kiểm tra",
  ACCOUNTANT_CHECKED: "Kế toán đã kiểm tra",
  TEAM_CHECKED: "Nhóm đã kiểm tra",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  REVISION_REQUESTED: "Yêu cầu sửa",
  PAID: "Đã chi trả",
  UNPAID: "Chưa thanh toán",
  PENDING: "Chờ duyệt",
  PENDING_APPROVAL: "Chờ duyệt",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  ON_HOLD: "Tạm dừng",
  RUNNING: "Đang chạy",
  PAUSED: "Tạm dừng",
  IN_USE: "Đang sử dụng",
  AVAILABLE: "Sẵn sàng",
  MAINTENANCE: "Bảo trì",
  RETIRED: "Ngừng dùng",
  TODO: "Chưa làm",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  ACTIVE: "Đang hoạt động",
  EXCEEDED: "Vượt ngân sách",
  SETTLEMENT_PENDING: "Chờ duyệt quyết toán",
  CLOSED: "Đã quyết toán & đóng",
  POTENTIAL: "Tiềm năng",
  VIEWING: "Đang xem phòng",
  DEPOSITED: "Đã đặt cọc",
  RESERVED: "Đã đặt cọc",
  FORFEITED: "Hủy cọc (Đã đối soát)",
  RENTED: "Đã thuê",
  SIGNED: "Đã ký HĐ",
  LOST: "Đã hủy",
  COLLECTED: "Đã thu đủ",
  PARTIAL: "Thu một phần",
  PRESENT: "Đúng giờ",
  LATE: "Đi muộn",
  ABSENT: "Vắng mặt",
  HALF_DAY: "Nửa ngày",
  ON_LEAVE: "Nghỉ phép",
};

export const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  ZALO: "Zalo",
  REFERRAL: "Giới thiệu",
  WALK_IN: "Vãng lai",
};

export const CHANNEL_LABELS: Record<string, string> = {
  FACEBOOK_ADS: "Quảng cáo Facebook",
  TIKTOK_ADS: "Quảng cáo TikTok",
  GOOGLE_ADS: "Quảng cáo Google",
  ZALO_OA: "Zalo OA",
  EVENT_OFFLINE: "Sự kiện / Offline",
  OTHER: "Kênh khác",
};

export const DEVICE_CATEGORY_LABELS: Record<string, string> = {
  LAPTOP: "Laptop",
  MONITOR: "Màn hình",
  NETWORK: "Thiết bị mạng",
  PRINTER: "Máy in",
  PHONE: "Điện thoại",
  OTHER: "Thiết bị khác",
};

export const ROLE_VI_LABELS: Record<string, string> = {
  ADMIN: "Giám đốc (Admin)",
  ACCOUNTANT: "Kế toán",
  SALES: "Nhân viên Sales",
  IT: "Nhân viên IT",
  MARKETING: "Nhân viên Marketing",
  LANDLORD: "Chủ trọ / Đối tác",
};

export const APPROVAL_TYPE_LABELS: Record<string, string> = {
  BUDGET: "Đề xuất ngân sách",
  EXPENSE: "Đề xuất chi phí",
  PROCUREMENT: "Đề xuất mua sắm",
  PROJECT: "Đề xuất dự án",
  BUDGET_SUPPLEMENT: "Bổ sung ngân sách",
  PAYMENT: "Đề xuất thanh toán",
  SALARY_ADJUSTMENT: "Điều chỉnh lương",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Nghỉ phép năm",
  SICK: "Nghỉ ốm",
  PERSONAL: "Việc riêng",
  UNPAID: "Nghỉ không lương",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}
