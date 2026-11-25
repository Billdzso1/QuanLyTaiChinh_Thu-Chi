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
  CLOSED: "Đã đóng",
  POTENTIAL: "Tiềm năng",
  VIEWING: "Đang xem phòng",
  DEPOSITED: "Đã đặt cọc",
  SIGNED: "Đã ký HĐ",
  LOST: "Đã hủy",
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
