import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Company { id: number; name: string; shortName?: string; active?: boolean }
interface Plant { id: number; name: string; companyId: number; active: boolean }
interface Gate { id: number; name: string; companyId: number; plantId?: number | null; active: boolean }

interface Assignments {
  companyIds: number[];
  plantIds: number[];
  gateIds: number[];
}

interface Props {
  userId: number;
  onSaved?: () => void;
}

export function UserAssignments({ userId, onSaved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allCompanies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies-all"],
    queryFn: () => fetch("/api/companies", { credentials: "include" }).then(r => r.json()),
  });

  const { data: allPlants = [] } = useQuery<Plant[]>({
    queryKey: ["/api/plants-all"],
    queryFn: () => fetch("/api/plants", { credentials: "include" }).then(r => r.json()),
  });

  const { data: allGates = [] } = useQuery<Gate[]>({
    queryKey: ["/api/gates-all"],
    queryFn: () => fetch("/api/gates", { credentials: "include" }).then(r => r.json()),
  });

  const { data: saved, isLoading } = useQuery<Assignments>({
    queryKey: [`/api/users/${userId}/assignments`],
    queryFn: () => fetch(`/api/users/${userId}/assignments`, { credentials: "include" }).then(r => r.json()),
    enabled: !!userId,
  });

  const [companyIds, setCompanyIds] = useState<number[]>([]);
  const [plantIds, setPlantIds] = useState<number[]>([]);
  const [gateIds, setGateIds] = useState<number[]>([]);

  useEffect(() => {
    if (saved) {
      setCompanyIds(saved.companyIds);
      setPlantIds(saved.plantIds);
      setGateIds(saved.gateIds);
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/users/${userId}/assignments`, { companyIds, plantIds, gateIds }),
    onSuccess: () => {
      toast({ title: "Assignments saved" });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/assignments`] });
      if (onSaved) onSaved();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save assignments", variant: "destructive" });
    },
  });

  const toggle = (id: number, list: number[], setList: (v: number[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  // Plants filtered to selected companies
  const relevantPlants = allPlants.filter(p => companyIds.includes(p.companyId) && p.active !== false);

  // Gates filtered to selected plants (or selected companies if no plant filter)
  const relevantGates = allGates.filter(
    g => companyIds.includes(g.companyId) && g.active !== false
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading assignments...</div>;

  return (
    <div className="space-y-5 pt-2">

      {/* Companies */}
      <div>
        <p className="text-sm font-semibold mb-2">Company Access</p>
        {allCompanies.filter(c => c.active !== false).length === 0 ? (
          <p className="text-xs text-muted-foreground">No companies found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {allCompanies.filter(c => c.active !== false).map(c => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={companyIds.includes(c.id)}
                  onCheckedChange={() => toggle(c.id, companyIds, setCompanyIds)}
                />
                {c.name}{c.shortName ? ` (${c.shortName})` : ""}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Plants */}
      <div>
        <p className="text-sm font-semibold mb-2">Plant Access <span className="font-normal text-muted-foreground">(select companies first)</span></p>
        {relevantPlants.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {companyIds.length === 0 ? "Select at least one company to see plants." : "No plants available for selected companies."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {relevantPlants.map(p => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={plantIds.includes(p.id)}
                  onCheckedChange={() => toggle(p.id, plantIds, setPlantIds)}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Gates */}
      <div>
        <p className="text-sm font-semibold mb-2">Gate Access <span className="font-normal text-muted-foreground">(select companies first)</span></p>
        {relevantGates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {companyIds.length === 0 ? "Select at least one company to see gates." : "No gates available for selected companies."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {relevantGates.map(g => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={gateIds.includes(g.id)}
                  onCheckedChange={() => toggle(g.id, gateIds, setGateIds)}
                />
                {g.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          size="sm"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="bg-primary text-white hover:bg-primary/90"
        >
          {saveMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</> : "Save Assignments"}
        </Button>
      </div>
    </div>
  );
}
