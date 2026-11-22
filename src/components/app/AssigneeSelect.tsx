import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStaff } from "@/hooks/use-staff";

export function AssigneeSelect({ value, onChange, label = "담당자", className = "w-44" }: { value: string | null; onChange: (v: string | null) => void; label?: string; className?: string }) {
  const { list } = useStaff();
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger className={`${className} bg-card`} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="none">미지정</SelectItem>{list.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name || p.email}</SelectItem>)}</SelectContent>
    </Select>
  );
}
