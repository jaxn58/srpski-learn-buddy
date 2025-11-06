import { Sidebar } from "@/components/Sidebar";

export default function WeekView() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
        <div>Week View</div>
      </div>
    </div>
  );
}

