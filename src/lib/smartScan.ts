import * as XLSX from "xlsx";

export interface ScannedFinanceItem {
  type: "INCOME" | "EXPENSE";
  title: string;
  amount: number;
  categoryId: string;
  departmentId: string;
  paymentStatus: "PAID" | "UNPAID";
  isDebt: boolean;
  reason: string;
  transactionDate?: string;
}

export interface ScannedPayrollItem {
  employeeCode?: string;
  fullName?: string;
  bonus?: number;
  overtimePay?: number;
  deduction?: number;
  note?: string;
}

function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseVietnameseAmount(raw: string): number {
  const cleaned = raw.trim().toLowerCase();
  const kMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*k$/);
  if (kMatch) {
    return Math.round(Number(kMatch[1].replace(",", ".")) * 1000);
  }
  const trMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*tr(?:ieu)?$/);
  if (trMatch) {
    return Math.round(Number(trMatch[1].replace(",", ".")) * 1_000_000);
  }
  const digits = cleaned.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function extractAmountsFromLine(line: string): number[] {
  const matches = line.match(/\b\d{1,3}(?:[.,]\d{3}){1,3}\b|\b\d{5,10}\b|\b\d+(?:[.,]\d+)?\s*(?:k|tr)\b/gi) || [];
  return matches.map(parseVietnameseAmount).filter((n) => n >= 1000 && n <= 10_000_000_000);
}

export async function extractTextFromFile(
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<{ text: string; excelRows: Record<string, unknown>[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (["xlsx", "xls", "csv"].includes(ext)) {
    onProgress?.(50, "Đang đọc dữ liệu bảng tính...");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const excelRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
    const text = excelRows.map((r) => Object.values(r).join(" ")).join("\n");
    onProgress?.(100, "Đọc tệp hoàn tất");
    return { text, excelRows };
  }

  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) {
    onProgress?.(10, "Đang khởi tạo bộ quét OCR...");
    const Tesseract = await import("tesseract.js");
    try {
      const result = await Tesseract.recognize(file, "vie+eng", {
        logger: (m: { status?: string; progress?: number }) => {
          if (typeof m.progress === "number") {
            onProgress?.(Math.round(15 + m.progress * 80), "Đang nhận diện chữ trên ảnh...");
          }
        },
      });
      onProgress?.(100, "Quét ảnh hoàn tất");
      return { text: result.data.text || "", excelRows: [] };
    } catch {
      const result = await Tesseract.recognize(file, "eng");
      onProgress?.(100, "Quét ảnh hoàn tất");
      return { text: result.data.text || "", excelRows: [] };
    }
  }

  if (["txt", "json"].includes(ext)) {
    const text = await file.text();
    return { text, excelRows: [] };
  }

  return { text: "", excelRows: [] };
}

export function parseFinanceItems(
  text: string,
  excelRows: Record<string, unknown>[],
  categories: { id: string; name: string; type: string }[],
  departments: { id: string; name: string }[],
  fallbackTitle: string
): ScannedFinanceItem[] {
  const findCategory = (type: "INCOME" | "EXPENSE", hint: string) => {
    const normHint = normalizeText(hint);
    const sameType = categories.filter((c) => c.type === type);
    const matched = sameType.find((c) => normHint.includes(normalizeText(c.name)));
    return matched?.id || sameType[0]?.id || categories[0]?.id || "";
  };

  const findDepartment = (hint: string) => {
    const normHint = normalizeText(hint);
    const matched = departments.find((d) => {
      const dn = normalizeText(d.name).replace("phong ", "");
      return normHint.includes(dn);
    });
    return matched?.id || departments[0]?.id || "";
  };

  if (excelRows.length > 0) {
    const items: ScannedFinanceItem[] = [];
    for (const row of excelRows) {
      const entries = Object.entries(row);
      const getCol = (keys: string[]) => {
        const found = entries.find(([k]) => keys.some((key) => normalizeText(k).includes(key)));
        return found ? String(found[1] ?? "").trim() : "";
      };

      const title = getCol(["noidung", "ten", "title", "diengiai", "mota"]) || fallbackTitle;
      const rawAmount = getCol(["sotien", "amount", "tien", "tong", "giatri"]);
      const amount = parseVietnameseAmount(rawAmount);
      if (!amount) continue;

      const rawType = normalizeText(getCol(["loai", "type", "thuchi"]));
      const type: "INCOME" | "EXPENSE" = rawType.includes("thu") || rawType.includes("income") ? "INCOME" : "EXPENSE";
      const rawStatus = normalizeText(getCol(["trangthai", "thanhtoan", "congno", "status"]));
      const isUnpaid = rawStatus.includes("chua") || rawStatus.includes("no") || rawStatus.includes("unpaid");

      items.push({
        type,
        title,
        amount,
        categoryId: findCategory(type, `${title} ${getCol(["danhmuc", "category"])}`),
        departmentId: findDepartment(`${title} ${getCol(["phongban", "department"])}`),
        paymentStatus: isUnpaid ? "UNPAID" : "PAID",
        isDebt: isUnpaid,
        reason: `Quét tự động từ tệp: ${fallbackTitle}`,
      });
    }
    if (items.length > 0) return items;
  }

  // OCR / Text parsing for single receipt/invoice
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const normFull = normalizeText(text);

  const isIncome =
    normFull.includes("phieu thu") ||
    normFull.includes("doanh thu") ||
    normFull.includes("thu tien") ||
    normFull.includes("hoa hong");
  const type: "INCOME" | "EXPENSE" = isIncome ? "INCOME" : "EXPENSE";

  let bestAmount = 0;
  for (const line of lines) {
    const nl = normalizeText(line);
    const nums = extractAmountsFromLine(line);
    if (nums.length === 0) continue;
    if (
      nl.includes("tong") ||
      nl.includes("thanh tien") ||
      nl.includes("thanh toan") ||
      nl.includes("so tien") ||
      nl.includes("total") ||
      nl.includes("cong")
    ) {
      bestAmount = Math.max(bestAmount, ...nums);
    }
  }
  if (bestAmount === 0) {
    const allNums = lines.flatMap(extractAmountsFromLine);
    if (allNums.length > 0) bestAmount = Math.max(...allNums);
  }

  const titleCandidate =
    lines.find((l) => l.length >= 5 && !/^\d[\d.,\s/:-]+$/.test(l) && !normalizeText(l).startsWith("mst")) ||
    `Chứng từ quét (${fallbackTitle})`;

  const isUnpaid = normFull.includes("chua thanh toan") || normFull.includes("cong no");
  const dateMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](20\d{2})/);
  const transactionDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : undefined;

  return [
    {
      type,
      title: titleCandidate.slice(0, 120),
      amount: bestAmount,
      categoryId: findCategory(type, text),
      departmentId: findDepartment(text),
      paymentStatus: isUnpaid ? "UNPAID" : "PAID",
      isDebt: isUnpaid,
      reason: `Quét tự động từ ${fallbackTitle}`,
      transactionDate,
    },
  ];
}

export function parsePayrollItems(
  text: string,
  excelRows: Record<string, unknown>[],
  existingEmployees: { employeeCode: string; fullName: string }[]
): ScannedPayrollItem[] {
  if (excelRows.length > 0) {
    const items: ScannedPayrollItem[] = [];
    for (const row of excelRows) {
      const entries = Object.entries(row);
      const getCol = (keys: string[]) => {
        const found = entries.find(([k]) => keys.some((key) => normalizeText(k).includes(key)));
        return found ? String(found[1] ?? "").trim() : "";
      };

      const employeeCode = getCol(["manv", "ma nv", "code"]);
      const fullName = getCol(["hoten", "ho ten", "nhanvien", "name"]);
      if (!employeeCode && !fullName) continue;

      const bonus = parseVietnameseAmount(getCol(["thuong", "bonus"]));
      const overtimePay = parseVietnameseAmount(getCol(["tangca", "tang ca", "overtime", "ot"]));
      const deduction = parseVietnameseAmount(getCol(["khautru", "khau tru", "phat", "deduction"]));
      const note = getCol(["ghichu", "ghi chu", "note"]);

      items.push({
        employeeCode: employeeCode || undefined,
        fullName: fullName || undefined,
        bonus: bonus || undefined,
        overtimePay: overtimePay || undefined,
        deduction: deduction || undefined,
        note: note || undefined,
      });
    }
    return items;
  }

  // OCR text line matching by NDA-XXX or employee name
  const items: ScannedPayrollItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const emp of existingEmployees) {
    const normCode = normalizeText(emp.employeeCode);
    const normName = normalizeText(emp.fullName);
    const matchedLine = lines.find((l) => {
      const nl = normalizeText(l);
      return nl.includes(normCode) || nl.includes(normName);
    });
    if (!matchedLine) continue;

    const nums = extractAmountsFromLine(matchedLine);
    if (nums.length > 0) {
      const nl = normalizeText(matchedLine);
      if (nl.includes("phat") || nl.includes("khau tru") || nl.includes("tru")) {
        items.push({ employeeCode: emp.employeeCode, fullName: emp.fullName, deduction: nums[0] });
      } else if (nl.includes("tang ca") || nl.includes("ot")) {
        items.push({ employeeCode: emp.employeeCode, fullName: emp.fullName, overtimePay: nums[0] });
      } else if (nl.includes("thuong") || nums.length === 1) {
        items.push({ employeeCode: emp.employeeCode, fullName: emp.fullName, bonus: nums[0] });
      }
    }
  }
  return items;
}
