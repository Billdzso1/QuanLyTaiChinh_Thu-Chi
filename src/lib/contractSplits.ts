import path from "path";
import { getKvJsonWithFallback, setKvJson } from "./dbStore";

export interface ContractSplitRecord {
  contractId: string;
  onlineSalesId: string;
  offlineSalesId: string;
  onlineShare: number;
  offlineShare: number;
}

const SPLITS_FILE = path.join(process.cwd(), "data", "contract-splits.json");
const SPLITS_KV_KEY = "contract_splits";

export async function readContractSplits(): Promise<Record<string, ContractSplitRecord>> {
  return getKvJsonWithFallback<Record<string, ContractSplitRecord>>(SPLITS_KV_KEY, SPLITS_FILE, {});
}

export async function saveContractSplit(record: ContractSplitRecord) {
  const all = await readContractSplits();
  all[record.contractId] = record;
  await setKvJson(SPLITS_KV_KEY, all);
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
