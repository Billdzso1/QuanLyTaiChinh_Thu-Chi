"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CompanyLogo } from "./CompanyLogo";
import { TopKpiCelebrationModal } from "./TopKpiCelebrationModal";
import { ChatbotWidget } from "./ChatbotWidget";
import type { ModuleKey, PermissionSet } from "@/lib/permissions";
import { Lock, ChevronDown, Crown, Sparkles, MessageSquare } from "lucide-react";
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
  Briefcase,
  Home,
  Zap,
} from "lucide-react";

export interface CurrentUser {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: "ADMIN" | "ACCOUNTANT" | "SALES" | "IT" | "MARKETING" | "LANDLORD";
  position: string;
  employmentType?: string;
  isTeamLead: boolean;
  baseSalary: number;
  allowance: number;
  kpiTarget: number;
  department: { id: string; code: string; name: string };
  permissions?: Record<ModuleKey, PermissionSet>;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  module?: ModuleKey;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard Tổng quan",
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
    module: "dashboard",
  },
  {
    href: "/finance",
    label: "Thu Chi & Công nợ",
    icon: <Wallet className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
    module: "finance",
  },
  {
    href: "/sales",
    label: "Sales & Hợp đồng",
    icon: <Building2 className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT", "SALES"],
    module: "sales",
  },
  {
    href: "/landlord",
    label: "Cổng Chủ trọ & Phòng",
    icon: <Home className="w-4 h-4" />,
    roles: ["LANDLORD"],
    module: "landlord",
  },
  {
    href: "/landlord/utilities",
    label: "Điện – Nước & Tiền phòng",
    icon: <Zap className="w-4 h-4" />,
    roles: ["LANDLORD"],
    module: "landlord",
  },
  {
    href: "/landlord/operations",
    label: "Cư dân, Tạm trú & Vận hành",
    icon: <Users className="w-4 h-4" />,
    roles: ["LANDLORD"],
    module: "landlord",
  },
  {
    href: "/payroll",
    label: "Quản lý Lương & Hoa hồng",
    icon: <BadgeDollarSign className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
    module: "payroll",
  },
  {
    href: "/attendance",
    label: "Chấm công & Nghỉ phép",
    icon: <Clock className="w-4 h-4" />,
    module: "attendance",
  },
  {
    href: "/approvals",
    label: "Ngân sách & Phê duyệt",
    icon: <CheckSquare className="w-4 h-4" />,
    module: "approvals",
  },
  {
    href: "/it",
    label: "Phòng IT & Dự án",
    icon: <Monitor className="w-4 h-4" />,
    roles: ["ADMIN", "IT"],
    module: "it",
  },
  {
    href: "/marketing",
    label: "Phòng Marketing",
    icon: <Megaphone className="w-4 h-4" />,
    roles: ["ADMIN", "MARKETING"],
    module: "marketing",
  },
  {
    href: "/employees",
    label: "Nhân sự & Phân quyền",
    icon: <Users className="w-4 h-4" />,
    roles: ["ADMIN", "ACCOUNTANT"],
    module: "employees",
  },
  {
    href: "/recruitment",
    label: "Hồ sơ & Lương Giám đốc",
    icon: <Briefcase className="w-4 h-4" />,
    roles: ["ADMIN"],
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
  {
    href: "/chat",
    label: "Nhóm Chat Công ty",
    icon: <MessageSquare className="w-4 h-4" />,
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
let fetchPatched = false;

function ensureTabFetchInterceptor() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    if (url.startsWith("/api/")) {
      const tabToken = sessionStorage.getItem("ndahome_tab_token");
      if (tabToken) {
        const nextHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!nextHeaders.has("x-tab-token")) {
          nextHeaders.set("x-tab-token", tabToken);
        }
        return origFetch(input, { ...init, headers: nextHeaders });
      }
    }
    return origFetch(input, init);
  };
}

if (typeof window !== "undefined") {
  ensureTabFetchInterceptor();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [unreadCount, setUnreadCount] = useState(cachedUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.notifications) {
          setNotifications(d.notifications);
          const count = d.notifications.filter((n: NotificationItem) => !n.isRead).length;
          cachedUnreadCount = count;
          setUnreadCount(count);
        }
      }
    } catch {
      // Ignore transient network errors
    }
  }

  useEffect(() => {
    ensureTabFetchInterceptor();
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          cachedUser = d.user;
          setUser(d.user);
        } else {
          cachedUser = null;
          router.push("/login");
        }
      })
      .catch(() => undefined);
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
    sessionStorage.removeItem("ndahome_tab_token");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!user) return !item.roles;
    if (user.permissions && item.module) {
      return Boolean(user.permissions[item.module]?.view);
    }
    if (user.role === "LANDLORD") {
      return (
        item.href === "/landlord" ||
        item.href === "/landlord/utilities" ||
        item.href === "/landlord/operations" ||
        item.href === "/profile"
      );
    }
    return !item.roles || item.roles.includes(user.role);
  });

  function getRouteModule(p: string): ModuleKey | null {
    if (p === "/") return "dashboard";
    if (p.startsWith("/finance")) return "finance";
    if (p.startsWith("/sales")) return "sales";
    if (p.startsWith("/landlord")) return "landlord";
    if (p.startsWith("/payroll")) return "payroll";
    if (p.startsWith("/attendance")) return "attendance";
    if (p.startsWith("/approvals") || p.startsWith("/budgets")) return "approvals";
    if (p.startsWith("/it")) return "it";
    if (p.startsWith("/marketing")) return "marketing";
    if (p.startsWith("/employees")) return "employees";
    return null;
  }

  const currentModule = getRouteModule(pathname);
  const isRouteDenied = Boolean(
    user?.permissions && currentModule && !user.permissions[currentModule]?.view
  );

  // Gộp menu ngang theo quy trình nghiệp vụ + màu sắc riêng cho từng nhóm
  const WORKFLOW_GROUPS = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: <LayoutDashboard className="w-4 h-4" />,
      hrefs: ["/"],
      activeCls: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25",
      idleCls: "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700",
      iconCls: "text-indigo-600",
      badgeBg: "bg-indigo-50 text-indigo-600",
    },
    {
      id: "finance",
      label: "Tài chính",
      icon: <Wallet className="w-4 h-4" />,
      hrefs: ["/finance", "/approvals", "/payroll"],
      activeCls: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/25",
      idleCls: "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700",
      iconCls: "text-emerald-600",
      badgeBg: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "business",
      label: "Kinh doanh & Phòng",
      icon: <Building2 className="w-4 h-4" />,
      hrefs: ["/sales", "/landlord", "/landlord/utilities", "/landlord/operations"],
      activeCls: "bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-sm shadow-sky-500/25",
      idleCls: "text-slate-700 hover:bg-sky-50 hover:text-sky-700",
      iconCls: "text-sky-600",
      badgeBg: "bg-sky-50 text-sky-600",
    },
    {
      id: "hr",
      label: "Nhân sự",
      icon: <Users className="w-4 h-4" />,
      hrefs: ["/attendance", "/employees", "/recruitment", "/profile"],
      activeCls: "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-500/25",
      idleCls: "text-slate-700 hover:bg-violet-50 hover:text-violet-700",
      iconCls: "text-violet-600",
      badgeBg: "bg-violet-50 text-violet-600",
    },
    {
      id: "ops",
      label: "Vận hành & Hệ thống",
      icon: <Monitor className="w-4 h-4" />,
      hrefs: ["/it", "/marketing", "/audit"],
      activeCls: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/25",
      idleCls: "text-slate-700 hover:bg-amber-50 hover:text-amber-700",
      iconCls: "text-amber-600",
      badgeBg: "bg-amber-50 text-amber-600",
    },
    {
      id: "chat",
      label: "Nhóm Chat",
      icon: <MessageSquare className="w-4 h-4" />,
      hrefs: ["/chat"],
      activeCls: "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/25",
      idleCls: "text-slate-700 hover:bg-rose-50 hover:text-rose-700",
      iconCls: "text-rose-600",
      badgeBg: "bg-rose-50 text-rose-600",
    },
  ];

  const ROLE_BADGE_MAP: Record<
    string,
    { label: string; cls: string; avatarCls: string; bannerCls: string }
  > = {
    ADMIN: {
      label: "Giám đốc",
      cls: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs shadow-indigo-500/30",
      avatarCls: "from-indigo-600 via-blue-600 to-cyan-500",
      bannerCls: "from-indigo-600 via-blue-600 to-cyan-500",
    },
    ACCOUNTANT: {
      label: "Kế toán",
      cls: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-500/30",
      avatarCls: "from-emerald-500 to-teal-600",
      bannerCls: "from-emerald-500 to-teal-600",
    },
    SALES: {
      label: "Sales",
      cls: "bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-xs shadow-sky-500/30",
      avatarCls: "from-sky-500 to-cyan-500",
      bannerCls: "from-sky-500 to-cyan-600",
    },
    IT: {
      label: "IT",
      cls: "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs shadow-violet-500/30",
      avatarCls: "from-violet-600 to-purple-600",
      bannerCls: "from-violet-600 to-purple-600",
    },
    MARKETING: {
      label: "Marketing",
      cls: "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs shadow-rose-500/30",
      avatarCls: "from-rose-500 to-pink-600",
      bannerCls: "from-rose-500 to-pink-600",
    },
    LANDLORD: {
      label: "Chủ trọ",
      cls: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shadow-amber-500/30",
      avatarCls: "from-amber-500 to-orange-500",
      bannerCls: "from-amber-500 to-orange-500",
    },
  };

  const navGroups = WORKFLOW_GROUPS.map((g) => ({
    ...g,
    items: filteredNav.filter((item) => g.hrefs.includes(item.href)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/30 to-sky-50/40 text-slate-900">
      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col z-10 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <CompanyLogo size={32} />
                <span className="font-extrabold tracking-wider bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
                  NDAHOME
                </span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              {navGroups.map((grp) => (
                <div key={grp.id} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
                    {grp.label}
                  </div>
                  {grp.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                        pathname === item.href
                          ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold shadow-sm"
                          : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Scroll Container with Top Horizontal Navbar */}
      <div
        ref={scrollContainerRef}
        onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 250)}
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto scroll-smooth"
      >
        <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
          {/* Left: Mobile toggle + Brand + Horizontal Grouped Nav */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-indigo-50 cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              href={filteredNav[0]?.href || "/profile"}
              className="flex items-center gap-2.5 shrink-0 pr-2"
            >
              <CompanyLogo size={36} />
              <div className="hidden sm:block leading-tight">
                <div className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  NDAHOME
                </div>
                <div className="text-[10px] font-medium text-slate-500">Quản lý nội bộ</div>
              </div>
            </Link>

            {/* Horizontal Workflow Menu (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1.5">
              {navGroups.map((grp) => {
                const isGroupActive = grp.items.some((it) => pathname === it.href);
                if (grp.items.length === 1) {
                  const single = grp.items[0];
                  return (
                    <Link
                      key={grp.id}
                      href={single.href}
                      prefetch={true}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                        isGroupActive ? grp.activeCls : grp.idleCls
                      }`}
                    >
                      <span className={isGroupActive ? "text-white" : grp.iconCls}>{grp.icon}</span>
                      <span>{grp.items.length === 1 && grp.id !== "overview" ? single.label : grp.label}</span>
                    </Link>
                  );
                }

                const isOpen = openGroup === grp.id;
                return (
                  <div
                    key={grp.id}
                    className="relative"
                    onMouseEnter={() => setOpenGroup(grp.id)}
                    onMouseLeave={() => setOpenGroup((cur) => (cur === grp.id ? null : cur))}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGroup((cur) => (cur === grp.id ? null : grp.id))}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        isGroupActive || isOpen ? grp.activeCls : grp.idleCls
                      }`}
                    >
                      <span className={isGroupActive || isOpen ? "text-white" : grp.iconCls}>{grp.icon}</span>
                      <span>{grp.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full pt-1.5 w-64 z-40">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 py-1.5 px-1.5 overflow-hidden space-y-0.5">
                          {grp.items.map((item) => {
                            const active = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                prefetch={true}
                                onClick={() => setOpenGroup(null)}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all ${
                                  active
                                    ? `${grp.activeCls} font-bold`
                                    : "text-slate-700 hover:bg-slate-50 font-medium"
                                }`}
                              >
                                <span
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    active ? "bg-white/20 text-white" : grp.badgeBg
                                  }`}
                                >
                                  {item.icon}
                                </span>
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-xl text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                title="Thông báo nội bộ"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-[10px] flex items-center justify-center font-bold">
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
            {user && (() => {
              const roleBadge = ROLE_BADGE_MAP[user.role] || {
                label: user.role,
                cls: "bg-gradient-to-r from-slate-600 to-slate-700 text-white",
                avatarCls: "from-indigo-600 to-cyan-500",
                bannerCls: "from-indigo-600 to-cyan-500",
              };
              const RoleIcon = user.role === "ADMIN" ? Crown : Sparkles;
              return (
                <div className="relative pl-3 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="group flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5 bg-gradient-to-r from-white via-slate-50 to-indigo-50/50 hover:from-indigo-50/70 hover:to-cyan-50/70 border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                    title="Tài khoản & Đăng xuất"
                  >
                    <div className="relative shrink-0">
                      <div className={`p-0.5 rounded-full bg-gradient-to-tr ${roleBadge.avatarCls} transition-transform duration-300 group-hover:scale-105`}>
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.fullName}
                            className="w-8 h-8 rounded-full object-cover bg-white ring-2 ring-white"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleBadge.avatarCls} text-white flex items-center justify-center font-bold text-xs`}
                          >
                            {user.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                          </div>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white" />
                      </span>
                    </div>

                    <div className="hidden md:block text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          {user.fullName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-transform duration-200 group-hover:scale-105 ${roleBadge.cls}`}
                        >
                          <RoleIcon className="w-2.5 h-2.5" />
                          {roleBadge.label}
                        </span>
                        {user.employmentType === "INTERN" && (
                          <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] font-bold shadow-2xs">
                            TTS
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {user.department.name}
                        {user.isTeamLead ? " • Phụ trách nhóm" : ""}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 hidden md:block transition-transform duration-200 ${
                        userMenuOpen ? "rotate-180 text-indigo-600" : ""
                      }`}
                    />
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2.5 w-68 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/15 z-40 overflow-hidden">
                        <div className={`px-4 py-3.5 bg-gradient-to-r ${roleBadge.bannerCls} text-white`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs border border-white/40 flex items-center justify-center font-extrabold text-sm">
                              {user.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold truncate">{user.fullName}</div>
                              <div className="text-[11px] text-white/80 truncate">{user.email}</div>
                            </div>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white text-[10px] font-bold border border-white/30">
                              <RoleIcon className="w-2.5 h-2.5" />
                              {roleBadge.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-black/15 text-white text-[10px] font-medium">
                              {user.department.name}
                            </span>
                            {user.isTeamLead && (
                              <span className="px-2 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-bold">
                                Phụ trách nhóm
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="py-1.5">
                          <Link
                            href="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 font-semibold transition-colors"
                          >
                            <UserCircle className="w-4 h-4 text-indigo-600" />
                            Hồ sơ &amp; Lương cá nhân
                          </Link>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            Đăng xuất
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </header>

        <main key={pathname} className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {isRouteDenied ? (
            <div className="max-w-lg mx-auto mt-16 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-lg space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-rose-600" />
              </div>
              <h2 className="text-lg font-bold text-neutral-900">Không có quyền truy cập phân hệ này</h2>
              <p className="text-xs text-neutral-500">
                Tài khoản của bạn hiện chưa được cấp quyền <strong>Xem</strong> mục này trong Ma trận Phân quyền. Vui lòng liên hệ Giám đốc nếu cần mở quyền.
              </p>
              <Link
                href={filteredNav[0]?.href || "/profile"}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-bold"
              >
                Quay về trang được phép
              </Link>
            </div>
          ) : (
            children
          )}
        </main>

        <footer className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-300 border-t border-indigo-500/25 px-4 lg:px-8 py-10 mt-8 no-print">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Cột 1: Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CompanyLogo size={40} />
                <div>
                  <div className="font-bold text-base tracking-wider text-cyan-300">NDAHOME</div>
                  <div className="text-[11px] tracking-widest text-slate-400 uppercase">Management</div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cầu nối uy tín giữa người cho thuê và người cần thuê.
              </p>
            </div>

            {/* Cột 2: Liên kết nhanh */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">Liên kết nhanh</div>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link
                    href={
                      user?.role === "LANDLORD"
                        ? "/landlord"
                        : user?.role === "SALES"
                          ? "/sales"
                          : user?.role === "IT"
                            ? "/it"
                            : user?.role === "MARKETING"
                              ? "/marketing"
                              : "/"
                    }
                    className="hover:text-amber-400 transition-colors"
                  >
                    Trang làm việc chính
                  </Link>
                </li>
                <li>
                  <Link
                    href={user?.role === "LANDLORD" ? "/landlord" : "/sales"}
                    className="hover:text-amber-400 transition-colors"
                  >
                    Quản lý Nhà / Phòng
                  </Link>
                </li>
                <li>
                  <Link href="/profile" className="hover:text-amber-400 transition-colors">
                    Hồ sơ &amp; Lương cá nhân
                  </Link>
                </li>
                {(user?.role === "ADMIN" || user?.role === "ACCOUNTANT") && (
                  <li>
                    <Link href="/employees" className="hover:text-amber-400 transition-colors">
                      Nhân sự &amp; Phân quyền
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Cột 3: Hỗ trợ */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Hỗ trợ &amp; Quy trình</div>
              <ul className="space-y-2 text-xs">
                {user?.role !== "LANDLORD" && (
                  <>
                    <li>
                      <Link href="/attendance" className="hover:text-amber-400 transition-colors">
                        Chấm công &amp; Nghỉ phép
                      </Link>
                    </li>
                    <li>
                      <Link href="/approvals" className="hover:text-amber-400 transition-colors">
                        Ngân sách &amp; Phê duyệt
                      </Link>
                    </li>
                  </>
                )}
                {user?.role === "LANDLORD" && (
                  <>
                    <li>
                      <Link href="/landlord/utilities" className="hover:text-amber-400 transition-colors">
                        Điện – Nước &amp; Tiền phòng
                      </Link>
                    </li>
                    <li>
                      <Link href="/landlord/operations" className="hover:text-amber-400 transition-colors">
                        Cư dân, Tạm trú &amp; Vận hành
                      </Link>
                    </li>
                  </>
                )}
                {(user?.role === "ADMIN" || user?.role === "IT") && (
                  <li>
                    <Link href="/it" className="hover:text-amber-400 transition-colors">
                      Hỗ trợ kỹ thuật (Phòng IT)
                    </Link>
                  </li>
                )}
                {user?.role === "ADMIN" && (
                  <li>
                    <Link href="/audit" className="hover:text-amber-400 transition-colors">
                      Nhật ký hệ thống
                    </Link>
                  </li>
                )}
                <li>
                  <a href="mailto:contact@ndahome.com" className="hover:text-amber-400 transition-colors">
                    Liên hệ hỗ trợ (Email)
                  </a>
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
            className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 cursor-pointer no-print"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>
      <ChatbotWidget />
      <TopKpiCelebrationModal userRole={user?.role} userName={user?.fullName} />
    </div>
  );
}
