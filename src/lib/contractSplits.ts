import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

export interface ContractSplitRecord {
  contractId: string;
  onlineSalesId: string;
  offlineSalesId: string;
  onlineShare: number;
  offlineShare: number;
}

const SPLITS_FILE = path.join(process.cwd(), "data", "contract-splits.json");

export async function readContractSplits(): Promise<Record<string, ContractSplitRecord>> {
  try {
    const raw = await readFile(SPLITS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveContractSplit(record: ContractSplitRecord) {
  const all = await readContractSplits();
  all[record.contractId] = record;
  await mkdir(path.dirname(SPLITS_FILE), { recursive: true });
  await writeFile(SPLITS_FILE, JSON.stringify(all, null, 2), "utf-8");
}

export function allocateContractRevenue(
  contracts: { id: string; salesId: string; companyRevenue: number }[],
  splits: Record<string, ContractSplitRecord>
): Record<string, { contractCount: number; revenue: number }> {
  const map: Record<string, { contractCount: number; revenue: number }> = {};
  const add = (uid: string, rev: number) => {
    if (!map[uid]) map[uid] = { contractCount: 0, revenue: 0 };
    map[uid].contractCount += 1;
    map[uid].revenue += rev;
  };

  for (const c of contracts) {
    const split = splits[c.id];
    if (split && split.onlineSalesId && split.offlineSalesId && split.onlineSalesId !== split.offlineSalesId) {
      const onlineRev = Math.round(c.companyRevenue * (split.onlineShare || 0.5));
      const offlineRev = c.companyRevenue - onlineRev;
      add(split.onlineSalesId, onlineRev);
      add(split.offlineSalesId, offlineRev);
    } else {
      add(c.salesId, c.companyRevenue);
    }
  }
  return map;
}
