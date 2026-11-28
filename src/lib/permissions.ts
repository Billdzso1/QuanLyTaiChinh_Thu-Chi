export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface PermissionSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type RoleKey = "ADMIN" | "ACCOUNTANT" | "SALES" | "IT" | "MARKETING" | "LANDLORD";

export type ModuleKey =
  | "dashboard"
  | "finance"
  | "sales"
  | "rooms"
  | "attendance"
  | "payroll"
  | "approvals"
  | "it"
  | "marketing"
  | "employees"
  | "landlord";

export type RolePermissionMatrix = Record<RoleKey, Record<ModuleKey, PermissionSet>>;

export interface PermissionConfigData {
  matrix: RolePermissionMatrix;
  userOverrides: Record<string, Partial<Record<ModuleKey, PermissionSet>>>;
}

export const PERMISSION_MODULES: { key: ModuleKey; label: string; desc: string }[] = [
  { key: "dashboard", label: "Tổng quan", desc: "KPI dòng tiền, biểu đồ & thông báo" },
  { key: "finance", label: "Quản lý thu chi", desc: "Sổ quỹ, hóa đơn & công nợ" },
  { key: "sales", label: "Sales & Hợp đồng", desc: "Khách hàng, lịch xem phòng & hợp đồng" },
  { key: "rooms", label: "Nhà / Phòng", desc: "Sơ đồ vận hành & cập nhật phòng" },
  { key: "attendance", label: "Chấm công & Nghỉ phép", desc: "Check-in/out, đơn từ & chốt công" },
  { key: "payroll", label: "Lương & Hoa hồng", desc: "Tổng hợp, điều chỉnh & chi trả lương" },
  { key: "approvals", label: "Ngân sách & Phê duyệt", desc: "Đề xuất chi, ngân sách & quyết toán" },
  { key: "it", label: "Phòng IT & Dự án", desc: "Dự án, công việc & thiết bị IT" },
  { key: "marketing", label: "Phòng Marketing", desc: "Chiến dịch & leads khách hàng" },
  { key: "employees", label: "Nhân sự & Phân quyền", desc: "Hồ sơ nhân sự, khóa TK & RBAC" },
  { key: "landlord", label: "Cổng Chủ trọ", desc: "Phòng, điện nước, cư dân & vận hành" },
];

export const PERMISSION_ROLES: { key: RoleKey; label: string; desc: string; badgeClass: string }[] = [
  { key: "ADMIN", label: "Admin", desc: "Toàn quyền hệ thống", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "ACCOUNTANT", label: "Kế toán", desc: "Thu chi, lương & công nợ", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "SALES", label: "Sales", desc: "Khách hàng, lịch hẹn & HĐ", badgeClass: "bg-sky-100 text-sky-800 border-sky-300" },
  { key: "IT", label: "IT", desc: "Dự án, task & thiết bị", badgeClass: "bg-violet-100 text-violet-800 border-violet-300" },
  { key: "MARKETING", label: "Marketing", desc: "Chiến dịch & leads", badgeClass: "bg-pink-100 text-pink-800 border-pink-300" },
  { key: "LANDLORD", label: "Chủ trọ", desc: "Phòng, điện nước & cư dân", badgeClass: "bg-neutral-900 text-amber-400 border-amber-500" },
];

const FULL: PermissionSet = { view: true, create: true, edit: true, delete: true };
const VIEW_CREATE_EDIT: PermissionSet = { view: true, create: true, edit: true, delete: false };
const VIEW_CREATE: PermissionSet = { view: true, create: true, edit: false, delete: false };
const VIEW_ONLY: PermissionSet = { view: true, create: false, edit: false, delete: false };
const NONE: PermissionSet = { view: false, create: false, edit: false, delete: false };

export function getDefaultPermissionMatrix(): RolePermissionMatrix {
  return {
    ADMIN: {
      dashboard: { ...FULL },
      finance: { ...FULL },
      sales: { ...FULL },
      rooms: { ...FULL },
      attendance: { ...FULL },
      payroll: { ...FULL },
      approvals: { ...FULL },
      it: { ...FULL },
      marketing: { ...FULL },
      employees: { ...FULL },
      landlord: { ...FULL },
    },
    ACCOUNTANT: {
      dashboard: { ...VIEW_ONLY },
      finance: { ...VIEW_CREATE_EDIT },
      sales: { ...VIEW_ONLY },
      rooms: { ...VIEW_ONLY },
      attendance: { ...VIEW_CREATE_EDIT },
      payroll: { ...VIEW_CREATE_EDIT },
      approvals: { ...VIEW_CREATE_EDIT },
      it: { ...NONE },
      marketing: { ...NONE },
      employees: { ...VIEW_ONLY },
      landlord: { ...NONE },
    },
    SALES: {
      dashboard: { ...NONE },
      finance: { ...NONE },
      sales: { ...VIEW_CREATE_EDIT },
      rooms: { ...VIEW_CREATE_EDIT },
      attendance: { ...VIEW_CREATE },
      payroll: { ...NONE },
      approvals: { ...VIEW_CREATE },
      it: { ...NONE },
      marketing: { ...NONE },
      employees: { ...NONE },
      landlord: { ...NONE },
    },
    IT: {
      dashboard: { ...NONE },
      finance: { ...NONE },
      sales: { ...NONE },
      rooms: { ...NONE },
      attendance: { ...VIEW_CREATE },
      payroll: { ...NONE },
      approvals: { ...VIEW_CREATE },
      it: { ...VIEW_CREATE_EDIT },
      marketing: { ...NONE },
      employees: { ...NONE },
      landlord: { ...NONE },
    },
    MARKETING: {
      dashboard: { ...NONE },
      finance: { ...NONE },
      sales: { ...NONE },
      rooms: { ...NONE },
      attendance: { ...VIEW_CREATE },
      payroll: { ...NONE },
      approvals: { ...VIEW_CREATE },
      it: { ...NONE },
      marketing: { ...VIEW_CREATE_EDIT },
      employees: { ...NONE },
      landlord: { ...NONE },
    },
    LANDLORD: {
      dashboard: { ...NONE },
      finance: { ...NONE },
      sales: { ...NONE },
      rooms: { ...VIEW_CREATE_EDIT },
      attendance: { ...NONE },
      payroll: { ...NONE },
      approvals: { ...NONE },
      it: { ...NONE },
      marketing: { ...NONE },
      employees: { ...NONE },
      landlord: { ...VIEW_CREATE_EDIT },
    },
  };
}
