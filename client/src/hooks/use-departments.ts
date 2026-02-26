import { useQuery } from "@tanstack/react-query";
export interface Department {
    id: number;
    companyId: number;
    name: string;
    description?: string | null;
    active: boolean;
}

/**
 * Fetches active departments from the API.
 * If companyId is provided, only returns departments for that company.
 * Falls back to a static list if the request fails.
 */
export function useDepartments(companyId?: number | null) {
    // Determine which company to filter by
    const effectiveCompanyId = companyId ?? null;

    return useQuery<Department[]>({
        queryKey: ["departments", effectiveCompanyId],
        queryFn: async () => {
            const url = effectiveCompanyId
                ? `/api/departments?companyId=${effectiveCompanyId}`
                : `/api/departments`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch departments");
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes — departments rarely change
        placeholderData: [
            { id: -1, companyId: 0, name: "HO", description: "Head Office", active: true },
            { id: -2, companyId: 0, name: "Warehouse", description: "Warehouse & Logistics", active: true },
            { id: -3, companyId: 0, name: "IT", description: "Information Technology", active: true },
            { id: -4, companyId: 0, name: "Finance", description: "Finance & Accounts", active: true },
        ],
    });
}
