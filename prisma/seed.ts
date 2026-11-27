import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function calculateSalesCommission(revenue: number) {
  const baseSalary = 2_000_000;
  let rate = 0.4;
  if (revenue > 20_000_000) rate = 0.6;
  else if (revenue >= 12_000_000) rate = 0.5;
  else if (revenue >= 6_000_000) rate = 0.45;
  const commissionAmount = Math.round(revenue * rate);
  const grossIncome = baseSalary + commissionAmount;
  const companyRetained = revenue - grossIncome;
  return { baseSalary, rate, commissionAmount, grossIncome, companyRetained };
}

async function main() {
  console.log("Seeding NDAHOME Management database...");

  // Clear existing data in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.marketingCampaign.deleteMany();
  await prisma.device.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.budgetExpense.deleteMany();
  await prisma.departmentBudget.deleteMany();
  await prisma.budgetRequest.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.room.deleteMany();
  await prisma.property.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.payrollDetail.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.salaryPolicy.deleteMany();
  await prisma.commissionPolicy.deleteMany();
  await prisma.attendanceAdjustment.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // 1. Departments (5 phòng ban, 16 nhân sự)
  const deptDirector = await prisma.department.create({
    data: { code: "DIRECTOR", name: "Ban Giám đốc", description: "Điều hành toàn bộ công ty", headcount: 1 },
  });
  const deptAccounting = await prisma.department.create({
    data: { code: "ACCOUNTING", name: "Phòng Kế toán", description: "Quản lý thu chi, lương, thuế và ngân sách", headcount: 1 },
  });
  const deptSales = await prisma.department.create({
    data: { code: "SALES", name: "Phòng Sales", description: "Tư vấn khách thuê, ký hợp đồng phòng trọ", headcount: 7 },
  });
  const deptIT = await prisma.department.create({
    data: { code: "IT", name: "Phòng IT", description: "Hệ thống phần mềm, hạ tầng và thiết bị", headcount: 3 },
  });
  const deptMarketing = await prisma.department.create({
    data: { code: "MARKETING", name: "Phòng Marketing", description: "Quảng cáo, nội dung và khách hàng tiềm năng", headcount: 4 },
  });

  const passwordHash = await bcrypt.hash("123456", 10);

  // 2. 16 Users
  const director = await prisma.user.create({
    data: {
      employeeCode: "NDA-001",
      email: "giamdoc@ndahome.vn",
      passwordHash,
      fullName: "Nguyễn Đức Anh",
      phone: "0901000001",
      role: "ADMIN",
      position: "Giám đốc",
      baseSalary: 25_000_000,
      allowance: 3_000_000,
      departmentId: deptDirector.id,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      employeeCode: "NDA-002",
      email: "ketoan@ndahome.vn",
      passwordHash,
      fullName: "Trần Thị Minh Hằng",
      phone: "0901000002",
      role: "ACCOUNTANT",
      position: "Kế toán tổng hợp",
      baseSalary: 12_000_000,
      allowance: 1_500_000,
      departmentId: deptAccounting.id,
    },
  });

  const salesUsers = [];
  const salesProfiles = [
    { code: "NDA-003", email: "sales1@ndahome.vn", name: "Lê Hoàng Nam", lead: true, pos: "Phụ trách nhóm Sales", target: 25_000_000 },
    { code: "NDA-004", email: "sales2@ndahome.vn", name: "Phạm Thu Thảo", lead: false, pos: "Chuyên viên Sales", target: 20_000_000 },
    { code: "NDA-005", email: "sales3@ndahome.vn", name: "Võ Minh Tuấn", lead: false, pos: "Chuyên viên Sales", target: 18_000_000 },
    { code: "NDA-006", email: "sales4@ndahome.vn", name: "Đặng Ngọc Ánh", lead: false, pos: "Chuyên viên Sales", target: 15_000_000 },
    { code: "NDA-007", email: "sales5@ndahome.vn", name: "Bùi Quốc Bảo", lead: false, pos: "Chuyên viên Sales", target: 15_000_000 },
    { code: "NDA-008", email: "sales6@ndahome.vn", name: "Hoàng Gia Huy", lead: false, pos: "Nhân viên Sales", target: 12_000_000 },
    { code: "NDA-009", email: "sales7@ndahome.vn", name: "Ngô Phương Linh", lead: false, pos: "Nhân viên Sales", target: 12_000_000 },
  ];
  for (let i = 0; i < salesProfiles.length; i++) {
    const s = salesProfiles[i];
    const u = await prisma.user.create({
      data: {
        employeeCode: s.code,
        email: s.email,
        passwordHash,
        fullName: s.name,
        phone: `090100000${3 + i}`,
        role: "SALES",
        position: s.pos,
        isTeamLead: s.lead,
        baseSalary: 2_000_000,
        allowance: 500_000,
        kpiTarget: s.target,
        departmentId: deptSales.id,
      },
    });
    salesUsers.push(u);
  }

  const itUsers = [];
  const itProfiles = [
    { code: "NDA-010", email: "it1@ndahome.vn", name: "Trịnh Công Sơn", lead: true, pos: "Phụ trách nhóm IT", salary: 16_000_000 },
    { code: "NDA-011", email: "it2@ndahome.vn", name: "Phan Thanh Tùng", lead: false, pos: "Lập trình viên Fullstack", salary: 13_000_000 },
    { code: "NDA-012", email: "it3@ndahome.vn", name: "Lý Hải Đăng", lead: false, pos: "Kỹ thuật viên hệ thống", salary: 10_000_000 },
  ];
  for (let i = 0; i < itProfiles.length; i++) {
    const it = itProfiles[i];
    const u = await prisma.user.create({
      data: {
        employeeCode: it.code,
        email: it.email,
        passwordHash,
        fullName: it.name,
        phone: `090100001${i}`,
        role: "IT",
        position: it.pos,
        isTeamLead: it.lead,
        baseSalary: it.salary,
        allowance: 1_000_000,
        departmentId: deptIT.id,
      },
    });
    itUsers.push(u);
  }

  const mktUsers = [];
  const mktProfiles = [
    { code: "NDA-013", email: "mkt1@ndahome.vn", name: "Đỗ Khánh Vy", lead: true, pos: "Phụ trách nhóm Marketing", salary: 13_000_000 },
    { code: "NDA-014", email: "mkt2@ndahome.vn", name: "Nguyễn Thảo Nhi", lead: false, pos: "Chuyên viên Content", salary: 9_500_000 },
    { code: "NDA-015", email: "mkt3@ndahome.vn", name: "Hồ Quang Khải", lead: false, pos: "Chuyên viên Performance Ads", salary: 11_000_000 },
    { code: "NDA-016", email: "mkt4@ndahome.vn", name: "Mai Lan Phương", lead: false, pos: "Thiết kế & Social", salary: 9_000_000 },
  ];
  for (let i = 0; i < mktProfiles.length; i++) {
    const m = mktProfiles[i];
    const u = await prisma.user.create({
      data: {
        employeeCode: m.code,
        email: m.email,
        passwordHash,
        fullName: m.name,
        phone: `090100002${i}`,
        role: "MARKETING",
        position: m.pos,
        isTeamLead: m.lead,
        baseSalary: m.salary,
        allowance: 800_000,
        departmentId: deptMarketing.id,
      },
    });
    mktUsers.push(u);
  }

  // Chủ trọ / Đối tác demo (NDA-017)
  await prisma.user.create({
    data: {
      employeeCode: "NDA-017",
      email: "chutro@ndahome.vn",
      passwordHash,
      fullName: "Ông Trần Văn Hùng (Chủ trọ)",
      phone: "0912345678",
      role: "LANDLORD",
      position: "Chủ trọ / Đối tác",
      baseSalary: 0,
      allowance: 0,
      departmentId: deptDirector.id,
    },
  });

  // 3. Commission & Salary Policies
  await prisma.commissionPolicy.createMany({
    data: [
      { name: "Bậc 1: Dưới 6 triệu", minRevenue: 0, maxRevenue: 5_999_999, baseSalary: 2_000_000, rate: 0.4 },
      { name: "Bậc 2: 6 – 12 triệu", minRevenue: 6_000_000, maxRevenue: 11_999_999, baseSalary: 2_000_000, rate: 0.45 },
      { name: "Bậc 3: 12 – 20 triệu", minRevenue: 12_000_000, maxRevenue: 20_000_000, baseSalary: 2_000_000, rate: 0.5 },
      { name: "Bậc 4: Trên 20 triệu", minRevenue: 20_000_001, maxRevenue: null, baseSalary: 2_000_000, rate: 0.6 },
    ],
  });

  await prisma.salaryPolicy.createMany({
    data: [
      { departmentCode: "ACCOUNTING", name: "Chính sách lương Kế toán", baseSalary: 12_000_000, allowance: 1_500_000, overtimeRate: 1.5 },
      { departmentCode: "IT", name: "Chính sách lương IT", baseSalary: 13_000_000, allowance: 1_000_000, overtimeRate: 1.5 },
      { departmentCode: "MARKETING", name: "Chính sách lương Marketing", baseSalary: 10_500_000, allowance: 800_000, overtimeRate: 1.5 },
    ],
  });

  // 4. Categories
  const catCommission = await prisma.category.create({
    data: { code: "INC_COMMISSION", name: "Hoa hồng hợp đồng", type: "INCOME", description: "Hoa hồng công ty nhận từ tiền cọc" },
  });
  const catIncOther = await prisma.category.create({
    data: { code: "INC_OTHER", name: "Thu nhập khác", type: "INCOME", description: "Dịch vụ hỗ trợ, phí quản lý" },
  });
  const catSalary = await prisma.category.create({
    data: { code: "EXP_SALARY", name: "Lương nhân viên", type: "EXPENSE", description: "Lương cứng, hoa hồng, thưởng" },
  });
  const catIT = await prisma.category.create({
    data: { code: "EXP_IT", name: "Chi phí IT", type: "EXPENSE", description: "Hosting, domain, thiết bị" },
  });
  const catMkt = await prisma.category.create({
    data: { code: "EXP_MARKETING", name: "Chi phí Marketing", type: "EXPENSE", description: "Facebook Ads, TikTok Ads, Google Ads" },
  });
  const catSales = await prisma.category.create({
    data: { code: "EXP_SALES", name: "Chi phí Sales", type: "EXPENSE", description: "Chi phí hoạt động, hỗ trợ kinh doanh" },
  });
  const catAcc = await prisma.category.create({
    data: { code: "EXP_ACCOUNTING", name: "Chi phí Kế toán", type: "EXPENSE", description: "Phần mềm, văn phòng phẩm" },
  });
  const catOps = await prisma.category.create({
    data: { code: "EXP_OPERATION", name: "Chi phí Vận hành", type: "EXPENSE", description: "Điện, nước, internet, thuê văn phòng" },
  });
  const catProj = await prisma.category.create({
    data: { code: "EXP_PROJECT", name: "Chi phí Dự án", type: "EXPENSE", description: "Chi phí triển khai dự án" },
  });

  // 5. Properties & Rooms
  const prop1 = await prisma.property.create({
    data: {
      name: "NDAHome Bình Thạnh 01",
      address: "125 Nguyễn Gia Trí, P.25",
      district: "Bình Thạnh",
      landlordName: "Ông Trần Văn Hùng",
      landlordPhone: "0912345678",
    },
  });
  const prop2 = await prisma.property.create({
    data: {
      name: "NDAHome Quận 7 Sunrise",
      address: "48 Lâm Văn Bền, P.Tân Kiểng",
      district: "Quận 7",
      landlordName: "Bà Nguyễn Thị Mai",
      landlordPhone: "0912345679",
    },
  });
  const prop3 = await prisma.property.create({
    data: {
      name: "NDAHome Phú Nhuận Central",
      address: "88 Phan Xích Long, P.2",
      district: "Phú Nhuận",
      landlordName: "Ông Lê Minh Tâm",
      landlordPhone: "0912345680",
    },
  });

  const rooms = [];
  const roomConfigs = [
    { propId: prop1.id, num: "P101", price: 5_500_000, status: "RENTED", img: "/phongtro01.png" },
    { propId: prop1.id, num: "P102", price: 6_000_000, status: "RENTED", img: "/phongtro02.jpg" },
    { propId: prop1.id, num: "P201", price: 6_500_000, status: "AVAILABLE", img: "/phongtro03.jfif" },
    { propId: prop1.id, num: "P202", price: 5_800_000, status: "RENTED", img: "/phongtro04.jfif" },
    { propId: prop2.id, num: "P301", price: 7_500_000, status: "RENTED", img: "/phongtro05.jfif" },
    { propId: prop2.id, num: "P302", price: 8_000_000, status: "RENTED", img: "/phongtro06.jfif" },
    { propId: prop2.id, num: "P303", price: 7_000_000, status: "RESERVED", img: "/phongtro07.jfif" },
    { propId: prop2.id, num: "P401", price: 8_500_000, status: "AVAILABLE", img: "/phongtro08.jpg" },
    { propId: prop3.id, num: "P101", price: 6_200_000, status: "RENTED", img: "/phongtro09.jfif" },
    { propId: prop3.id, num: "P102", price: 6_800_000, status: "RENTED", img: "/phongtro10.jpg" },
    { propId: prop3.id, num: "P201", price: 7_200_000, status: "RENTED", img: "/phongtro11.jfif" },
    { propId: prop3.id, num: "P202", price: 6_500_000, status: "AVAILABLE", img: "/phongtro12.jfif" },
  ];
  for (const rc of roomConfigs) {
    rooms.push(
      await prisma.room.create({
        data: {
          propertyId: rc.propId,
          roomNumber: rc.num,
          price: rc.price,
          status: rc.status,
          imageUrl: rc.img,
          amenities: "Máy lạnh, tủ lạnh, máy giặt chung, wifi tốc độ cao",
        },
      })
    );
  }

  // 6. Customers & Contracts & Deposits (spanning 2026-08 to 2026-11)
  const customerNames = [
    "Nguyễn Văn An", "Trần Thị Bích", "Lê Quang Dũng", "Phạm Minh Châu", "Vũ Hoàng Yến",
    "Đoàn Thế Vinh", "Ngô Thanh Hà", "Huỳnh Tấn Phát", "Tô Ngọc Lan", "Kiều Anh Tuấn",
    "Lương Bảo Trâm", "Cao Đức Mạnh",
  ];
  const customers = [];
  for (let i = 0; i < customerNames.length; i++) {
    customers.push(
      await prisma.customer.create({
        data: {
          fullName: customerNames[i],
          phone: `09876543${10 + i}`,
          source: i % 3 === 0 ? "FACEBOOK" : i % 3 === 1 ? "TIKTOK" : "ZALO",
          status: i < 10 ? "SIGNED" : "VIEWING",
          salesId: salesUsers[i % salesUsers.length].id,
        },
      })
    );
  }

  const contractSeed = [
    // Current month (2026-11)
    { code: "HD-2026-011", custIdx: 0, roomIdx: 0, salesIdx: 0, dur: 12, dep: 12_000_000, rate: 0.85, date: "2026-11-03", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-012", custIdx: 1, roomIdx: 1, salesIdx: 0, dur: 12, dep: 15_000_000, rate: 0.8, date: "2026-11-06", col: "COLLECTED", land: "UNPAID" },
    { code: "HD-2026-013", custIdx: 2, roomIdx: 3, salesIdx: 1, dur: 12, dep: 18_000_000, rate: 0.85, date: "2026-11-09", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-014", custIdx: 3, roomIdx: 4, salesIdx: 2, dur: 12, dep: 14_000_000, rate: 0.8, date: "2026-11-11", col: "COLLECTED", land: "UNPAID" },
    { code: "HD-2026-015", custIdx: 4, roomIdx: 5, salesIdx: 3, dur: 6, dep: 10_000_000, rate: 0.5, date: "2026-11-14", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-016", custIdx: 5, roomIdx: 8, salesIdx: 4, dur: 6, dep: 12_000_000, rate: 0.5, date: "2026-11-16", col: "PARTIAL", land: "UNPAID" },
    { code: "HD-2026-017", custIdx: 6, roomIdx: 9, salesIdx: 1, dur: 12, dep: 10_000_000, rate: 0.8, date: "2026-11-18", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-018", custIdx: 7, roomIdx: 10, salesIdx: 5, dur: 6, dep: 8_000_000, rate: 0.5, date: "2026-11-19", col: "UNPAID", land: "UNPAID" },
    // Previous months (2026-10, 2026-09, 2026-08)
    { code: "HD-2026-007", custIdx: 8, roomIdx: 2, salesIdx: 0, dur: 12, dep: 16_000_000, rate: 0.8, date: "2026-10-12", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-008", custIdx: 9, roomIdx: 6, salesIdx: 1, dur: 12, dep: 14_000_000, rate: 0.85, date: "2026-10-20", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-005", custIdx: 0, roomIdx: 7, salesIdx: 2, dur: 6, dep: 12_000_000, rate: 0.5, date: "2026-09-15", col: "COLLECTED", land: "PAID" },
    { code: "HD-2026-003", custIdx: 1, roomIdx: 11, salesIdx: 3, dur: 12, dep: 15_000_000, rate: 0.8, date: "2026-08-18", col: "COLLECTED", land: "PAID" },
  ];

  const salesNovRevenue: Record<string, number> = {};
  for (const s of salesUsers) salesNovRevenue[s.id] = 0;

  let txCounter = 1;
  for (const c of contractSeed) {
    const companyRevenue = Math.round(c.dep * c.rate);
    const landlordPayable = c.dep - companyRevenue;
    const signedDate = new Date(c.date);
    const endDate = new Date(signedDate);
    endDate.setMonth(endDate.getMonth() + c.dur);

    const salesUser = salesUsers[c.salesIdx];
    if (c.date.startsWith("2026-11")) {
      salesNovRevenue[salesUser.id] += companyRevenue;
    }

    const contract = await prisma.contract.create({
      data: {
        contractCode: c.code,
        customerId: customers[c.custIdx].id,
        roomId: rooms[c.roomIdx].id,
        salesId: salesUser.id,
        durationMonths: c.dur,
        monthlyRent: rooms[c.roomIdx].price,
        depositAmount: c.dep,
        companyCommissionRate: c.rate,
        companyRevenue,
        landlordPayable,
        signedDate,
        startDate: signedDate,
        endDate,
        status: "ACTIVE",
      },
    });

    const collectedAmount = c.col === "COLLECTED" ? c.dep : c.col === "PARTIAL" ? Math.round(c.dep / 2) : 0;
    await prisma.deposit.create({
      data: {
        contractId: contract.id,
        totalDeposit: c.dep,
        collectedAmount,
        remainingAmount: c.dep - collectedAmount,
        companyShare: companyRevenue,
        landlordShare: landlordPayable,
        landlordPaidAmount: c.land === "PAID" ? landlordPayable : 0,
        collectionStatus: c.col,
        landlordPayoutStatus: c.land,
        collectedAt: collectedAmount > 0 ? signedDate : null,
        landlordPaidAt: c.land === "PAID" ? signedDate : null,
      },
    });

    if (collectedAmount > 0) {
      await prisma.transaction.create({
        data: {
          code: `TC-2026-${String(txCounter++).padStart(3, "0")}`,
          type: "INCOME",
          title: `Hoa hồng hợp đồng ${c.code} (${c.dur} tháng - ${(c.rate * 100).toFixed(0)}%)`,
          amount: companyRevenue,
          categoryId: catCommission.id,
          departmentId: deptSales.id,
          createdById: accountant.id,
          reason: `Doanh thu hoa hồng công ty từ tiền cọc ${c.code}`,
          approvalStatus: "APPROVED",
          paymentStatus: "PAID",
          transactionDate: signedDate,
        },
      });
    }
  }

  // 7. Expenses across departments (including 2 unpaid debts)
  const expensesSeed = [
    { title: "Chi phí chạy Facebook Ads tháng 11", amount: 8_500_000, cat: catMkt.id, dept: deptMarketing.id, user: mktUsers[0].id, date: "2026-11-05", paid: "PAID", debt: false },
    { title: "Chi phí TikTok Ads chiến dịch Q4", amount: 5_200_000, cat: catMkt.id, dept: deptMarketing.id, user: mktUsers[2].id, date: "2026-11-10", paid: "PAID", debt: false },
    { title: "Thuê Server Cloud & Domain NDAHome", amount: 3_200_000, cat: catIT.id, dept: deptIT.id, user: itUsers[0].id, date: "2026-11-02", paid: "PAID", debt: false },
    { title: "Mua màn hình Dell Ultrasharp cho IT", amount: 6_500_000, cat: catIT.id, dept: deptIT.id, user: itUsers[1].id, date: "2026-11-12", paid: "UNPAID", debt: true },
    { title: "Tiền thuê văn phòng & điện nước T11", amount: 12_000_000, cat: catOps.id, dept: deptAccounting.id, user: accountant.id, date: "2026-11-01", paid: "PAID", debt: false },
    { title: "Phần mềm kế toán MISA & văn phòng phẩm", amount: 2_100_000, cat: catAcc.id, dept: deptAccounting.id, user: accountant.id, date: "2026-11-07", paid: "PAID", debt: false },
    { title: "Hỗ trợ xăng xe & tiếp khách Sales T11", amount: 3_500_000, cat: catSales.id, dept: deptSales.id, user: salesUsers[0].id, date: "2026-11-15", paid: "UNPAID", debt: true },
    // Earlier months for charts
    { title: "Chi phí vận hành & Ads tháng 10", amount: 18_500_000, cat: catMkt.id, dept: deptMarketing.id, user: mktUsers[0].id, date: "2026-10-15", paid: "PAID", debt: false },
    { title: "Chi phí vận hành & IT tháng 9", amount: 14_000_000, cat: catOps.id, dept: deptAccounting.id, user: accountant.id, date: "2026-09-18", paid: "PAID", debt: false },
    { title: "Chi phí vận hành tháng 8", amount: 13_200_000, cat: catOps.id, dept: deptAccounting.id, user: accountant.id, date: "2026-08-20", paid: "PAID", debt: false },
  ];

  for (const e of expensesSeed) {
    await prisma.transaction.create({
      data: {
        code: `TC-2026-${String(txCounter++).padStart(3, "0")}`,
        type: "EXPENSE",
        title: e.title,
        amount: e.amount,
        categoryId: e.cat,
        departmentId: e.dept,
        createdById: e.user,
        reason: e.title,
        approvalStatus: "APPROVED",
        paymentStatus: e.paid,
        isDebt: e.debt,
        transactionDate: new Date(e.date),
      },
    });
  }

  // 8. Budget Requests & Department Budgets
  const brMkt = await prisma.budgetRequest.create({
    data: {
      code: "NS-2026-001",
      departmentId: deptMarketing.id,
      createdById: mktUsers[0].id,
      title: "Ngân sách chạy Ads tuyển khách thuê T11/2026",
      amount: 15_000_000,
      reason: "Đẩy mạnh Facebook Ads và TikTok Ads khu vực Bình Thạnh, Quận 7",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      status: "APPROVED",
    },
  });
  const dbMkt = await prisma.departmentBudget.create({
    data: {
      departmentId: deptMarketing.id,
      budgetRequestId: brMkt.id,
      title: brMkt.title,
      month: 11,
      year: 2026,
      allocatedAmount: 15_000_000,
      usedAmount: 13_700_000,
      status: "ACTIVE",
    },
  });
  await prisma.budgetExpense.create({
    data: { departmentBudgetId: dbMkt.id, title: "Facebook Ads + TikTok Ads T11", amount: 13_700_000 },
  });

  const brIT = await prisma.budgetRequest.create({
    data: {
      code: "NS-2026-002",
      departmentId: deptIT.id,
      createdById: itUsers[0].id,
      title: "Ngân sách hạ tầng & thiết bị IT T11/2026",
      amount: 9_000_000,
      reason: "Server cloud và màn hình làm việc cho nhân viên mới",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      status: "APPROVED",
    },
  });
  await prisma.departmentBudget.create({
    data: {
      departmentId: deptIT.id,
      budgetRequestId: brIT.id,
      title: brIT.title,
      month: 11,
      year: 2026,
      allocatedAmount: 9_000_000,
      usedAmount: 9_700_000,
      status: "EXCEEDED",
    },
  });

  await prisma.budgetRequest.create({
    data: {
      code: "NS-2026-003",
      departmentId: deptAccounting.id,
      createdById: accountant.id,
      title: "Ngân sách văn phòng & phần mềm Kế toán T12/2026",
      amount: 5_000_000,
      reason: "Gia hạn chữ ký số và mua văn phòng phẩm cuối năm",
      periodStart: "2026-12-01",
      periodEnd: "2026-12-31",
      status: "PENDING",
    },
  });

  // 9. Approvals
  await prisma.approval.createMany({
    data: [
      {
        code: "DX-2026-001",
        type: "EXPENSE",
        title: "Đề xuất thanh toán chi phí in ấn tờ rơi & bảng hiệu",
        description: "In 1000 tờ rơi và 5 bảng hiệu phòng trọ khu vực Phú Nhuận",
        amount: 2_800_000,
        departmentCode: "SALES",
        createdById: salesUsers[0].id,
        checkerId: accountant.id,
        checkedAt: new Date("2026-11-18"),
        checkerNote: "Đã kiểm tra báo giá hợp lệ, đủ chứng từ",
        status: "ACCOUNTANT_CHECKED",
        history: JSON.stringify([
          { action: "CREATED", by: salesUsers[0].fullName, at: "2026-11-17T09:00:00Z" },
          { action: "ACCOUNTANT_CHECKED", by: accountant.fullName, at: "2026-11-18T14:30:00Z" },
        ]),
      },
      {
        code: "DX-2026-002",
        type: "PROJECT",
        title: "Đề xuất dự án nâng cấp App Mobile xem phòng NDAHome",
        description: "Xây dựng tính năng đặt lịch xem phòng trực tuyến và đồng bộ CRM",
        amount: 12_000_000,
        departmentCode: "IT",
        createdById: itUsers[0].id,
        status: "PENDING",
        history: JSON.stringify([
          { action: "CREATED", by: itUsers[0].fullName, at: "2026-11-19T10:00:00Z" },
        ]),
      },
      {
        code: "DX-2026-003",
        type: "BUDGET_SUPPLEMENT",
        title: "Bổ sung ngân sách chạy Ads cuối tháng 11",
        description: "Tăng ngân sách TikTok Ads thêm 4 triệu để đạt KPI khách hàng tiềm năng",
        amount: 4_000_000,
        departmentCode: "MARKETING",
        createdById: mktUsers[0].id,
        status: "PENDING",
        history: JSON.stringify([
          { action: "CREATED", by: mktUsers[0].fullName, at: "2026-11-20T08:30:00Z" },
        ]),
      },
    ],
  });

  // 10. Payrolls (Tháng 11/2026 - DRAFT/CHECKED)
  const allUsers = [director, accountant, ...salesUsers, ...itUsers, ...mktUsers];
  for (const u of allUsers) {
    if (u.role === "SALES") {
      const rev = salesNovRevenue[u.id] || 0;
      const calc = calculateSalesCommission(rev);
      await prisma.payroll.create({
        data: {
          userId: u.id,
          month: 11,
          year: 2026,
          workDays: 22,
          actualWorkDays: 22,
          baseSalary: calc.baseSalary,
          salesRevenue: rev,
          commissionRate: calc.rate,
          commissionAmount: calc.commissionAmount,
          companyRetained: calc.companyRetained,
          allowance: u.allowance,
          grossIncome: calc.grossIncome + u.allowance,
          netSalary: calc.grossIncome + u.allowance,
          status: "CHECKED",
        },
      });
    } else {
      const gross = u.baseSalary + u.allowance;
      await prisma.payroll.create({
        data: {
          userId: u.id,
          month: 11,
          year: 2026,
          workDays: 22,
          actualWorkDays: 22,
          baseSalary: u.baseSalary,
          allowance: u.allowance,
          grossIncome: gross,
          netSalary: gross,
          status: "CHECKED",
        },
      });
    }
  }

  // 11. Attendance (recent days in 2026-11)
  const dates = ["2026-11-17", "2026-11-18", "2026-11-19"];
  for (const d of dates) {
    for (let i = 0; i < allUsers.length; i++) {
      const u = allUsers[i];
      const isLate = i % 5 === 4 && d === "2026-11-19";
      await prisma.attendance.create({
        data: {
          userId: u.id,
          date: d,
          checkIn: new Date(`${d}T${isLate ? "08:45:00" : "08:00:00"}`),
          checkOut: new Date(`${d}T17:30:00`),
          workHours: isLate ? 7.75 : 8.5,
          status: isLate ? "LATE" : "PRESENT",
          isConfirmed: d !== "2026-11-19",
        },
      });
    }
  }

  await prisma.leaveRequest.create({
    data: {
      userId: salesUsers[4].id,
      leaveType: "ANNUAL",
      startDate: "2026-11-22",
      endDate: "2026-11-22",
      days: 1,
      reason: "Giải quyết việc gia đình",
      status: "PENDING",
    },
  });

  // 12. Projects, Tasks, Devices, Marketing Campaigns
  const prj1 = await prisma.project.create({
    data: {
      code: "PRJ-2026-001",
      name: "Hệ thống Quản lý Nội bộ NDAHome",
      description: "Xây dựng cổng quản lý tài chính, lương, chấm công và phòng ban",
      departmentId: deptIT.id,
      managerId: itUsers[0].id,
      budget: 15_000_000,
      actualCost: 9_700_000,
      progress: 85,
      status: "IN_PROGRESS",
    },
  });
  await prisma.project.create({
    data: {
      code: "PRJ-2026-002",
      name: "Website Giới thiệu Phòng trọ NDAHome v2",
      description: "Tối ưu SEO và form thu hút khách thuê tự động",
      departmentId: deptIT.id,
      managerId: itUsers[1].id,
      budget: 8_000_000,
      actualCost: 0,
      progress: 10,
      status: "PENDING_APPROVAL",
    },
  });

  await prisma.task.createMany({
    data: [
      { title: "Hoàn thiện module tính hoa hồng Sales", priority: "HIGH", status: "DONE", projectId: prj1.id, departmentId: deptIT.id, assigneeId: itUsers[1].id, createdById: itUsers[0].id },
      { title: "Cấu hình backup database định kỳ", priority: "MEDIUM", status: "IN_PROGRESS", projectId: prj1.id, departmentId: deptIT.id, assigneeId: itUsers[2].id, createdById: itUsers[0].id },
      { title: "Chốt danh sách khách xem phòng cuối tuần", priority: "HIGH", status: "IN_PROGRESS", departmentId: deptSales.id, assigneeId: salesUsers[0].id, createdById: director.id },
      { title: "Lên kế hoạch nội dung TikTok tháng 12", priority: "MEDIUM", status: "TODO", departmentId: deptMarketing.id, assigneeId: mktUsers[1].id, createdById: mktUsers[0].id },
    ],
  });

  await prisma.device.createMany({
    data: [
      { code: "DEV-001", name: "MacBook Pro M3 14 inch", category: "LAPTOP", serialNumber: "MBP-2026-01", purchaseCost: 38_000_000, status: "IN_USE", assignedToId: itUsers[0].id },
      { code: "DEV-002", name: "Dell Ultrasharp U2723QE", category: "MONITOR", serialNumber: "DELL-2026-09", purchaseCost: 6_500_000, status: "IN_USE", assignedToId: itUsers[1].id },
      { code: "DEV-003", name: "ThinkPad X1 Carbon", category: "LAPTOP", serialNumber: "TP-2026-03", purchaseCost: 24_000_000, status: "IN_USE", assignedToId: accountant.id },
      { code: "DEV-004", name: "Router MikroTik RB4011", category: "NETWORK", serialNumber: "MK-2026-01", purchaseCost: 4_800_000, status: "IN_USE" },
    ],
  });

  await prisma.marketingCampaign.createMany({
    data: [
      { code: "MKT-2026-001", name: "Chiến dịch Thuê phòng Bình Thạnh T11", channel: "FACEBOOK_ADS", budget: 9_000_000, spent: 8_500_000, leadsCount: 145, conversions: 18, status: "RUNNING", managerId: mktUsers[2].id },
      { code: "MKT-2026-002", name: "Video Review Phòng trọ Quận 7", channel: "TIKTOK_ADS", budget: 6_000_000, spent: 5_200_000, leadsCount: 98, conversions: 11, status: "RUNNING", managerId: mktUsers[1].id },
    ],
  });

  // 13. Notifications & AuditLogs
  await prisma.notification.createMany({
    data: [
      { userId: director.id, title: "Có 3 đề xuất chờ phê duyệt", message: "Vui lòng kiểm tra mục Phê duyệt để xử lý các đề xuất từ Sales, IT và Marketing.", type: "WARNING", link: "/approvals" },
      { userId: accountant.id, title: "Bảng lương T11/2026 đã sẵn sàng", message: "Bảng lương 16 nhân sự đã được tổng hợp, vui lòng kiểm tra trước khi trình Giám đốc.", type: "INFO", link: "/payroll" },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: director.id,
      action: "SYSTEM_INIT",
      entity: "System",
      details: "Khởi tạo dữ liệu hệ thống NDAHOME Management (16 nhân sự, 5 phòng ban)",
    },
  });

  console.log("Seeding completed successfully! (16 users, 5 departments)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
