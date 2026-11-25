"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CompanyLogo } from "./CompanyLogo";
import {
  LayoutDashboard,
  Wallet,
  Building2,
  Users,
  Clock,
  BadgeDollarSign,
  PiggyBank,
  CheckSquare,
  Monitor,
  Megaphone,
  UserCircle,
  Bell,
  LogOut,
  Menu,
  X,
  FileText,
  MapPin,
  Phone,
  Mail,
  ArrowUp,
} from "lucide-react";

export interface CurrentUser {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "SALES" | "IT" | "MARKETING";
  position: string;
  isTeamLead: boolean;
  baseSalary: number;
  allowance: number;
  kpiTarget: number;
  department: { id: string; code: string; name: string };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard Tổng quan", icon: <LayoutDashboard className="w-4 h-4" /> },
  {
    href: "/finance",
    label: "Thu Chi & Công nợ",
    icon: <Wallet className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    href: "/sales",
    label: "Sales & Hợp đồng",
    icon: <Building2 className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT", "SALES"],
  },
  {
    href: "/payroll",
    label: "Quản lý Lương & Hoa hồng",
    icon: <BadgeDollarSign className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    href: "/attendance",
    label: "Chấm công & Nghỉ phép",
    icon: <Clock className="w-4 h-4" />,
  },
  {
    href: "/budgets",
    label: "Ngân sách Phòng ban",
    icon: <PiggyBank className="w-4 h-4" />,
  },
  {
    href: "/approvals",
    label: "Đề xuất & Phê duyệt",
    icon: <CheckSquare className="w-4 h-4" />,
  },
  {
    href: "/it",
    label: "Phòng IT & Dự án",
    icon: <Monitor className="w-4 h-4" />,
    roles: ["ADMIN", "IT"],
  },
  {
    href: "/marketing",
    label: "Phòng Marketing",
    icon: <Megaphone className="w-4 h-4" />,
    roles: ["ADMIN", "MARKETING"],
  },
  {
    href: "/employees",
    label: "Nhân sự & Phân quyền",
    icon: <Users className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    href: "/profile",
    label: "Lương & Hồ sơ cá nhân",
    icon: <UserCircle className="w-4 h-4" />,
  },
  {
    href: "/audit",
    label: "Nhật ký hệ thống",
    icon: <FileText className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
];

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

let cachedUser: CurrentUser | null = null;
let cachedUnreadCount = 0;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [unreadCount, setUnreadCount] = useState(cachedUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const r = await fetch("/api/notifications");
    if (r.ok) {
      const d = await r.json();
      if (d?.notifications) {
        setNotifications(d.notifications);
        const count = d.notifications.filter((n: NotificationItem) => !n.isRead).length;
        cachedUnreadCount = count;
        setUnreadCount(count);
      }
    }
  }

  useEffect(() => {
    if (!cachedUser) {
      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.user) {
            cachedUser = d.user;
            setUser(d.user);
          } else {
            router.push("/login");
          }
        });
    }
    loadNotifications();
  }, [router]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    loadNotifications();
  }

  async function handleLogout() {
    cachedUser = null;
    cachedUnreadCount = 0;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="h-screen overflow-hidden flex bg-neutral-50 text-neutral-900">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:h-screen bg-neutral-950 text-white shrink-0 border-r border-amber-500/20">
        <div className="h-16 shrink-0 flex items-center gap-3 px-5 border-b border-neutral-800">
          <CompanyLogo size={36} />
          <div>
            <div className="font-bold text-sm tracking-wide text-amber-400">NDAHOME</div>
            <div className="text-[11px] text-neutral-400">Quản lý nội bộ</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {filteredNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active
                  ? "bg-amber-500 text-neutral-950 font-bold"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-amber-400"
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-neutral-950 text-white flex flex-col z-10">
            <div className="h-16 flex items-center justify-between px-5 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <CompanyLogo size={30} />
                <span className="font-bold text-amber-400">NDAHOME</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {filteredNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${pathname === item.href ? "bg-amber-500 text-neutral-950 font-bold" : "text-neutral-300 hover:bg-neutral-900"
                    }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 250)}
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto scroll-smooth"
      >
        <header className="h-16 bg-white border-b border-neutral-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-neutral-600 hidden sm:block">
              Công ty NDAHOME • <span className="font-bold text-neutral-950">Hệ thống Quản lý Tài chính & Nội bộ</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-neutral-700 hover:bg-amber-50 transition-colors cursor-pointer"
                title="Thông báo nội bộ"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-neutral-200 shadow-xl z-40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
                      <span className="text-xs font-bold text-neutral-900">Thông báo nội bộ ({unreadCount})</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-[11px] text-amber-700 hover:underline font-medium cursor-pointer"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-xs text-neutral-500 text-center">Chưa có thông báo nào</div>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            href={n.link || "/profile"}
                            onClick={() => setNotifOpen(false)}
                            className={`block px-4 py-3 hover:bg-amber-50/50 transition-colors ${!n.isRead ? "bg-amber-50/40" : ""
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-bold text-neutral-900">{n.title}</div>
                              {!n.isRead && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />}
                            </div>
                            <div className="text-[11px] text-neutral-600 mt-0.5 line-clamp-2">{n.message}</div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {user && (
              <div className="relative pl-3 border-l border-neutral-200">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-amber-50 transition-colors cursor-pointer"
                  title="Tài khoản & Đăng xuất"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-amber-500/60 bg-white"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-950 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/40">
                      {user.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                    </div>
                  )}
                  <div className="hidden md:block text-right">
                    <div className="text-xs font-bold text-neutral-950">{user.fullName}</div>
                    <div className="text-[11px] text-neutral-500">{user.department.name}</div>
                  </div>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-neutral-200 shadow-xl py-1.5 z-40">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-800 hover:bg-amber-50 font-medium"
                      >
                        <UserCircle className="w-4 h-4 text-amber-600" />
                        Hồ sơ &amp; Lương cá nhân
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>

        <footer className="bg-neutral-950 text-neutral-300 border-t border-amber-500/30 px-4 lg:px-8 py-10 mt-8 no-print">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Cột 1: Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CompanyLogo size={40} />
                <div>
                  <div className="font-bold text-base tracking-wider text-amber-400">NDAHOME</div>
                  <div className="text-[11px] tracking-widest text-neutral-400 uppercase">Management</div>
                </div>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cầu nối uy tín giữa người cho thuê và người cần thuê.
              </p>
            </div>

            {/* Cột 2: Liên kết nhanh */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Liên kết nhanh</div>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/" className="hover:text-amber-400 transition-colors">
                    Trang làm việc chính
                  </Link>
                </li>
                <li>
                  <Link href="/sales" className="hover:text-amber-400 transition-colors">
                    Quản lý Nhà / Phòng
                  </Link>
                </li>
                <li>
                  <Link href="/profile" className="hover:text-amber-400 transition-colors">
                    Cài đặt hệ thống
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cột 3: Hỗ trợ */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Hỗ trợ</div>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/profile" className="hover:text-amber-400 transition-colors">
                    Câu hỏi thường gặp
                  </Link>
                </li>
                <li>
                  <Link href="/audit" className="hover:text-amber-400 transition-colors">
                    Chính sách bảo mật
                  </Link>
                </li>
                <li>
                  <Link href="/approvals" className="hover:text-amber-400 transition-colors">
                    Điều khoản sử dụng
                  </Link>
                </li>
                <li>
                  <Link href="/it" className="hover:text-amber-400 transition-colors">
                    Liên hệ hỗ trợ
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cột 4: Liên hệ */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Liên hệ</div>
              <ul className="space-y-2.5 text-xs text-neutral-300">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Tòa nhà More Building, Số 36 Mạc Đĩnh Chi, Phường Tân Định, TP.HCM</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>098.48.43.052</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>contact@ndahome.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto mt-8 pt-5 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
            <div>© 2026 Công ty NDAHOME — Hệ thống Quản lý Tài chính &amp; Hoạt động Nội bộ</div>
            <div className="text-amber-400/80">Lưu hành nội bộ • Phòng IT NDAHOME</div>
          </div>
        </footer>

        {showBackToTop && (
          <button
            type="button"
            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Quay lại đầu trang"
            title="Quay lại đầu trang"
            className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:-translate-y-1 cursor-pointer no-print"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
}
