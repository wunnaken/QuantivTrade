"use client";
import dynamic from "next/dynamic";

const CalendarView = dynamic(() => import("./CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 p-6">
      <div className="skeleton h-10 w-48 rounded-lg" />
      <div className="flex gap-2">
        {[0,1,2,3,4,5,6].map((i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-2">
        {[0,1,2,3,4,5,6,7].map((i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  ),
});

export default function CalendarPage() {
  return <CalendarView />;
}
