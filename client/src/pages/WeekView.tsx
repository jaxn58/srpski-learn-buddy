import { Sidebar } from "@/components/Sidebar";
import { AnimatedPage } from "@/components/AnimatedPage";

export default function WeekView() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full">
        <AnimatedPage>
        <div>Week View</div>
        </AnimatedPage>
      </div>
    </div>
  );
}

